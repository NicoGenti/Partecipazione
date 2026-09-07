import { createHash, timingSafeEqual } from 'crypto';
import { blobService, privateContainerName } from '../shared/storage';
import { handleCors } from '../shared/cors';
import { rateLimited, getClientIp } from '../shared/rateLimit';

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

export interface GuestIntolerances {
  name: string;
  intolerances: Intolerance[];
  intolerancesOther: string;
}

export interface RsvpRecord {
  deviceId: string;
  recipient?: Recipient;
  fullName: string;
  adults: number;
  guestNames?: string[];
  bringingChildren: boolean;
  childrenCount: number;
  intolerances: Intolerance[];
  intolerancesOther: string;
  /** Per-guest intolerances (new format). Falls back to top-level `intolerances` for legacy records. */
  guestIntolerances?: GuestIntolerances[];
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

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/* ──────────────────────────────────────────────────────────────
 * Autorizzazione
 *
 * Il client DEVE inviare l'header 'x-admin-key' (Node HTTP lowercase)
 * contenente la passphrase configurata come app setting ADMIN_KEY.
 * Confronto a tempo costante tramite timingSafeEqual su hash SHA-256.
 * ────────────────────────────────────────────────────────────── */

function secureCompare(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

function authorized(req: V3Request): boolean {
  const expected = process.env.ADMIN_KEY;
  if (!expected || expected.length < 16) return false;

  const headers = req.headers ?? {};
  const received = (headers['x-admin-key'] ?? '').trim();
  if (!received) return false;

  return secureCompare(received, expected);
}

/* ──────────────────────────────────────────────────────────────
 * Lettura blob rsvp/
 * ────────────────────────────────────────────────────────────── */

async function fetchAllRsvpRecords(): Promise<RsvpRecord[]> {
  // RsvpSubmit scrive nel container privato: la dashboard DEVE leggere da lì.
  const containerClient = blobService.getContainerClient(privateContainerName);

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
    typeof r.deviceId === 'string' && r.deviceId.length <= 64 &&
    typeof r.fullName === 'string' && r.fullName.length <= 200 &&
    typeof r.submittedAt === 'string' && r.submittedAt.length <= 50 &&
    typeof r.adults === 'number' &&
    typeof r.childrenCount === 'number' &&
    Array.isArray(r.intolerances)
  );
}

function collectIntolerances(r: RsvpRecord): { list: Intolerance[]; others: string[] } {
  if (r.guestIntolerances && r.guestIntolerances.length > 0) {
    const list: Intolerance[] = [];
    const others: string[] = [];
    for (const g of r.guestIntolerances) {
      for (const it of g.intolerances) {
        if (!list.includes(it)) list.push(it);
      }
      if (g.intolerances.includes('other') && g.intolerancesOther?.trim()) {
        others.push(`${g.name}: ${g.intolerancesOther.trim()}`);
      }
    }
    return { list, others };
  }
  // Legacy: use top-level fields
  return {
    list: r.intolerances ?? [],
    others: r.intolerances?.includes('other') && r.intolerancesOther?.trim()
      ? [r.intolerancesOther.trim()]
      : [],
  };
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

    const { list, others } = collectIntolerances(r);
    for (const it of list) {
      if (it in intolerances) {
        intolerances[it] += 1;
      }
    }
    intolerancesOther.push(...others);

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
  return {
    status,
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  };
}

async function RsvpDashboard(context: V3Context, req: V3Request): Promise<V3Response> {
  const cors = handleCors(req, context);
  if (cors.handled) return context.res as V3Response;

  const origin = (req.headers?.['origin'] ?? 'unknown').replace(/[\r\n]/g, '');
  context.log.info(`HTTP trigger RsvpDashboard ricevuto da ${origin}`);

  const clientIp = getClientIp(req);
  if (rateLimited(`dashboard:${clientIp}`, 10)) {
    return buildResponse(429, { error: 'Troppi tentativi. Riprova tra un minuto.' }, cors.headers);
  }

  if (!authorized(req)) {
    return buildResponse(401, { error: 'X-Admin-Key mancante o errato' }, cors.headers);
  }

  try {
    const rows = await fetchAllRsvpRecords();
    const summary = summarize(rows);
    const reply: DashboardReply = { summary, rows };
    return buildResponse(200, reply, cors.headers);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Errore sconosciuto';
    context.log.error(`Errore in RsvpDashboard: ${message}`);
    return buildResponse(500, { error: 'Errore interno del server' }, cors.headers);
  }
}

module.exports = RsvpDashboard;
