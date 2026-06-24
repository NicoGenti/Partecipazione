import { blobService, containerName } from '../shared/storage';
import { handleCors } from '../shared/cors';
import type { RsvpRecord, Intolerance, Recipient } from '../shared/types';

/* ──────────────────────────────────────────────────────────────
 * Modello v3 di Azure Functions (Node): context + req, $return per
 * la risposta. Non importiamo '@azure/functions' per evitare
 * mismatch col modello v4.
 * ────────────────────────────────────────────────────────────── */

interface V3Context {
  log: {
    info: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
  res?: V3Response;
}

interface V3Request {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

interface V3Response {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

const INTOLERANCES: Intolerance[] = [
  'vegetarian',
  'vegan',
  'celiac',
  'lactose-free',
  'nut-allergy',
  'other',
];

const RECIPIENTS: Recipient[] = ['nicolas', 'giulia'];

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

function sanitizeDeviceId(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  if (!trimmed || trimmed.length > 64) return null;
  // UUID-like o stringa alfanumerica semplice.
  if (!/^[\w-]+$/.test(trimmed)) return null;
  return trimmed;
}

function isValidRsvpRecord(v: unknown): v is RsvpRecord {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Partial<RsvpRecord>;

  if (typeof r.deviceId !== 'string' || r.deviceId.length > 64) return false;
  if (typeof r.fullName !== 'string' || r.fullName.length > 200) return false;
  if (typeof r.submittedAt !== 'string' || r.submittedAt.length > 50) return false;
  if (!RECIPIENTS.includes(r.recipient as Recipient)) return false;

  const adults = Number(r.adults);
  if (!Number.isInteger(adults) || adults < 1 || adults > 20) return false;

  const childrenCount = Number(r.childrenCount);
  if (!Number.isInteger(childrenCount) || childrenCount < 0 || childrenCount > 20) return false;

  if (typeof r.bringingChildren !== 'boolean') return false;
  if (r.bringingChildren && childrenCount < 1) return false;
  if (!r.bringingChildren && childrenCount !== 0) return false;

  if (typeof r.needsRoom !== 'boolean') return false;
  const roomGuests = Number(r.roomGuests);
  if (!Number.isInteger(roomGuests) || roomGuests < 0 || roomGuests > 20) return false;
  if (r.needsRoom && roomGuests < 1) return false;
  if (!r.needsRoom && roomGuests !== 0) return false;
  if (r.roomLocation !== 'Villa Montegranelli') return false;

  if (!Array.isArray(r.intolerances)) return false;
  if (r.intolerances.some((it) => !INTOLERANCES.includes(it as Intolerance))) return false;
  if (
    r.intolerances.includes('other') &&
    (typeof r.intolerancesOther !== 'string' || r.intolerancesOther.length > 200)
  ) {
    return false;
  }

  return true;
}

async function RsvpSubmit(context: V3Context, req: V3Request): Promise<V3Response> {
  const cors = handleCors(req, context);
  if (cors.handled) return context.res as V3Response;

  if (req.method?.toUpperCase() !== 'POST') {
    return buildResponse(405, { error: 'Metodo non consentito' }, cors.headers);
  }

  let body: unknown;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return buildResponse(400, { error: 'Body JSON non valido' }, cors.headers);
  }

  if (!isValidRsvpRecord(body)) {
    return buildResponse(400, { error: 'Dati RSVP non validi' }, cors.headers);
  }

  const deviceId = sanitizeDeviceId(body.deviceId);
  if (!deviceId) {
    return buildResponse(400, { error: 'deviceId non valido' }, cors.headers);
  }

  const record: RsvpRecord = {
    ...body,
    deviceId,
    fullName: body.fullName.trim(),
    intolerancesOther: body.intolerancesOther?.trim() ?? '',
  };

  try {
    const containerClient = blobService.getContainerClient(containerName);
    const blobName = `rsvp/${deviceId}.json`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.upload(
      JSON.stringify(record, null, 2),
      Buffer.byteLength(JSON.stringify(record, null, 2)),
      {
        blobHTTPHeaders: { blobContentType: 'application/json' },
      },
    );

    context.log.info(`RSVP salvato per deviceId=${deviceId}`);
    return buildResponse(200, { ok: true }, cors.headers);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Errore sconosciuto';
    context.log.error(`Errore in RsvpSubmit: ${message}`);
    return buildResponse(500, { error: 'Errore interno del server' }, cors.headers);
  }
}

module.exports = RsvpSubmit;
