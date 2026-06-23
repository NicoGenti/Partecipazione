import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';

/* ──────────────────────────────────────────────────────────────
 * Tipi minimi compatibili col runtime v3 di Azure Functions (Node).
 * Non importiamo '@azure/functions' per evitare mismatch col modello v4.
 * ────────────────────────────────────────────────────────────── */

interface V3Context {
  log: {
    info: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    verbose: (...args: unknown[]) => void;
  };
  res?: V3Response;
}

interface V3Request {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
}

interface V3Response {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

/* ──────────────────────────────────────────────────────────────
 * Contratto condiviso con il frontend — src/dashboard/types.ts.
 * Qualsiasi modifica qui DEVE essere rispecchiata lato client.
 * ────────────────────────────────────────────────────────────── */

export type Recipient = 'nicolas' | 'giulia';

export type Intolerance =
  | 'vegetarian'
  | 'vegan'
  | 'celiac'
  | 'lactose-free'
  | 'nut-allergy'
  | 'other';

export interface RsvpRecord {
  deviceId: string;
  recipient: Recipient;
  fullName: string;
  adults: number;
  bringingChildren: boolean;
  childrenCount: number;
  intolerances: Intolerance[];
  intolerancesOther: string;
  needsRoom: boolean;
  roomGuests: number;
  roomLocation: 'Villa Montegranelli';
  submittedAt: string;
}

interface IntolerancesCount {
  vegetarian: number;
  vegan: number;
  celiac: number;
  'lactose-free': number;
  'nut-allergy': number;
  other: number;
}

interface DailyBucket {
  date: string;
  count: number;
}

interface DashboardSummary {
  total: number;
  adultsTotal: number;
  childrenTotal: number;
  guestsTotal: number;
  roomsBooked: number;
  roomGuestsTotal: number;
  byRecipient: { nicolas: number; giulia: number };
  intolerances: IntolerancesCount;
  intolerancesOther: string[];
  lastSevenDays: DailyBucket[];
}

interface DashboardReply {
  summary: DashboardSummary;
  rows: RsvpRecord[];
}

const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? '').split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/* ──────────────────────────────────────────────────────────────
 * Accesso Storage
 *
 * Due modalità, in ordine di preferenza:
 *   1. Storage account name + key (credenziali complete).
 *   2. SAS read-only scoper a 'rsvp/' impostata come app setting
 *      RSVP_READ_SAS (senza punto interrogativo iniziale).
 * ────────────────────────────────────────────────────────────── */

function buildBlobServiceClient(): BlobServiceClient {
  const accountName = process.env.STORAGE_ACCOUNT_NAME;
  const accountKey = process.env.STORAGE_ACCOUNT_KEY;
  const accountUrl = process.env.STORAGE_ACCOUNT_URL
    ?? (accountName ? `https://${accountName}.blob.core.windows.net` : null);
  const sas = process.env.RSVP_READ_SAS?.replace(/^\?/, '');

  if (!accountUrl) {
    throw new Error('STORAGE_ACCOUNT_URL non configurato');
  }

  if (accountName && accountKey) {
    const credential = new StorageSharedKeyCredential(
      accountName,
      accountKey,
    );
    return new BlobServiceClient(accountUrl, credential);
  }

  if (sas) {
    return new BlobServiceClient(`${accountUrl}?${sas}`);
  }

  throw new Error(
    'Configurazione Storage mancante: imposta STORAGE_ACCOUNT_NAME + STORAGE_ACCOUNT_KEY oppure RSVP_READ_SAS',
  );
}

/* ──────────────────────────────────────────────────────────────
 * Autorizzazione
 *
 * Il client DEVE inviare l'header 'x-admin-key' (Node HTTP lowercase)
 * contenente la passphrase configurata come app setting ADMIN_KEY.
 * Confronto a tempo costante per evitare timing leak.
 * ────────────────────────────────────────────────────────────── */

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    let acc = a.length ^ b.length;
    for (let i = 0; i < b.length; i++) acc |= a.charCodeAt(i % a.length) ^ b.charCodeAt(i);
    return acc === 0 && a.length === b.length;
  }
  let acc = 0;
  for (let i = 0; i < a.length; i++) acc |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return acc === 0;
}

function authorized(req: V3Request): boolean {
  const expected = process.env.ADMIN_KEY;
  if (!expected || expected.length < 16) return false;

  const headers = req.headers ?? {};
  const received = (headers['x-admin-key'] ?? '').trim();

  if (!received) return false;
  return timingSafeEqual(received, expected);
}

/* ──────────────────────────────────────────────────────────────
 * Lettura blob rsvp/
 * ────────────────────────────────────────────────────────────── */

async function fetchAllRsvpRecords(): Promise<RsvpRecord[]> {
  const client = buildBlobServiceClient();
  const containerName =
    process.env.RSVP_CONTAINER_NAME ?? process.env.AZURE_CONTAINER;
  if (!containerName) {
    throw new Error('RSVP_CONTAINER_NAME non configurato');
  }

  const containerClient = client.getContainerClient(containerName);

  const records: RsvpRecord[] = [];
  // listBlobsFlat: elenca TUTTI i blob sotto 'rsvp/' ricorsivamente.
  const iter = containerClient.listBlobsFlat({ prefix: 'rsvp/' });

  for await (const item of iter) {
    if (!item.name.endsWith('.json')) continue;

    const blobClient = containerClient.getBlobClient(item.name);
    const download = await blobClient.download();
    const text = await streamToText(download.readableStreamBody);

    try {
      const parsed = JSON.parse(text) as unknown;
      if (isRsvpRecord(parsed)) {
        records.push(parsed);
      }
    } catch {
      // Singolo blob malformato: skip, non blocca la dashboard.
    }
  }

  return records;
}

function isRsvpRecord(v: unknown): v is RsvpRecord {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Partial<RsvpRecord>;
  return (
    typeof r.deviceId === 'string' &&
    typeof r.fullName === 'string' &&
    typeof r.adults === 'number' &&
    typeof r.childrenCount === 'number' &&
    typeof r.submittedAt === 'string' &&
    Array.isArray(r.intolerances)
  );
}

async function streamToText(
  stream: NodeJS.ReadableStream | undefined,
): Promise<string> {
  if (!stream) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

/* ──────────────────────────────────────────────────────────────
 * Aggregazioni
 * ────────────────────────────────────────────────────────────── */

function summarize(rows: RsvpRecord[]): DashboardSummary {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastSevenDays: DailyBucket[] = Array.from(
    { length: 7 },
    (_, i) => {
      const d = new Date(today.getTime() - (6 - i) * DAY_IN_MS);
      return { date: d.toISOString().slice(0, 10), count: 0 };
    },
  );

  const intolerances: IntolerancesCount = {
    vegetarian: 0,
    vegan: 0,
    celiac: 0,
    'lactose-free': 0,
    'nut-allergy': 0,
    other: 0,
  };

  const intolerancesOther: string[] = [];

  const byRecipient = { nicolas: 0, giulia: 0 };

  let adultsTotal = 0;
  let childrenTotal = 0;
  let roomsBooked = 0;
  let roomGuestsTotal = 0;

  for (const r of rows) {
    adultsTotal += r.adults ?? 0;
    childrenTotal += r.bringingChildren ? r.childrenCount ?? 0 : 0;

    if (r.needsRoom) {
      roomsBooked += 1;
      roomGuestsTotal += r.roomGuests ?? 0;
    }

    if (r.recipient === 'nicolas' || r.recipient === 'giulia') {
      byRecipient[r.recipient] += 1;
    }

    for (const it of r.intolerances ?? []) {
      if (it in intolerances) {
        intolerances[it] += 1;
      }
    }

    if (r.intolerances?.includes('other') && r.intolerancesOther?.trim()) {
      intolerancesOther.push(r.intolerancesOther.trim());
    }

    const submittedDay = (r.submittedAt ?? '').slice(0, 10);
    const slot = lastSevenDays.find((d) => d.date === submittedDay);
    if (slot) slot.count += 1;
  }

  return {
    total: rows.length,
    adultsTotal,
    childrenTotal,
    guestsTotal: adultsTotal + childrenTotal,
    roomsBooked,
    roomGuestsTotal,
    byRecipient,
    intolerances,
    intolerancesOther,
    lastSevenDays,
  };
}

/* ──────────────────────────────────────────────────────────────
 * Handler HTTP (modello v3: context + req, contesto.res per risposta)
 * ────────────────────────────────────────────────────────────── */

function buildResponse(
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): V3Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders,
  };
  if (CORS_ORIGINS.length > 0) {
    headers['Access-Control-Allow-Origin'] = CORS_ORIGINS.join(', ');
    headers['Vary'] = 'Origin';
  }
  return { status, body: JSON.stringify(body), headers };
}

async function RsvpDashboard(
  context: V3Context,
  req: V3Request,
): Promise<V3Response> {
  const origin = req.headers?.['origin'] ?? 'unknown-origin';
  context.log.info(`HTTP trigger RsvpDashboard ricevuto da ${origin}`);

  if (CORS_ORIGINS.length > 0) {
    const reqOrigin = req.headers?.['origin'] ?? '';
    if (reqOrigin && !CORS_ORIGINS.includes(reqOrigin)) {
      return buildResponse(403, { error: 'Origin non autorizzato' });
    }
  }

  if (!authorized(req)) {
    return buildResponse(401, { error: 'X-Admin-Key mancante o errato' });
  }

  try {
    const rows = await fetchAllRsvpRecords();
    const summary = summarize(rows);
    const reply: DashboardReply = { summary, rows };
    return buildResponse(200, reply);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Errore sconosciuto';
    context.log.error(`Errore in RsvpDashboard: ${message}`);
    return buildResponse(500, { error: 'Errore interno del server' });
  }
}

module.exports = RsvpDashboard;