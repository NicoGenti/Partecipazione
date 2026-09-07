import { createHash } from 'crypto';
import { blobService, privateContainerName } from '../shared/storage';
import { handleCors } from '../shared/cors';
import { rateLimited, getClientIp } from '../shared/rateLimit';
import type { ConsentRecord } from '../shared/types';

interface V3Context {
  log: {
    info: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
  res?: V3Response;
}

interface V3Request {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

interface V3Response {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

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
  if (!/^[\w-]+$/.test(trimmed)) return null;
  return trimmed;
}

/* ──────────────────────────────────────────────────────────────
 * Sanitizzazione del fingerprint `device`: whitelist delle chiavi
 * note, cap sulle lunghezze e limite sulla dimensione totale
 * prima di persistere il record.
 * ────────────────────────────────────────────────────────────── */

const DEVICE_ALLOWED_KEYS = [
  'userAgent',
  'platform',
  'language',
  'languages',
  'screen',
  'devicePixelRatio',
  'timezone',
  'touch',
] as const;

const DEVICE_MAX_STRING = 200;
const DEVICE_MAX_ARRAY_ITEMS = 10;
const DEVICE_MAX_ARRAY_ITEM_STRING = 50;
const DEVICE_MAX_SERIALIZED_BYTES = 2048;

function sanitizeDevice(v: unknown): Record<string, unknown> | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;

  const source = v as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const key of DEVICE_ALLOWED_KEYS) {
    if (!(key in source)) continue;
    const value = source[key];

    if (typeof value === 'string') {
      sanitized[key] = value.slice(0, DEVICE_MAX_STRING);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      const items: string[] = [];
      for (const item of value.slice(0, DEVICE_MAX_ARRAY_ITEMS)) {
        if (typeof item !== 'string') return null;
        items.push(item.slice(0, DEVICE_MAX_ARRAY_ITEM_STRING));
      }
      sanitized[key] = items;
    } else {
      // Tipo non supportato: rifiuta l'intero fingerprint.
      return null;
    }
  }

  const serialized = JSON.stringify(sanitized);
  if (Buffer.byteLength(serialized, 'utf8') > DEVICE_MAX_SERIALIZED_BYTES) return null;

  return sanitized;
}

function isValidConsentRecord(v: unknown): v is ConsentRecord {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Partial<ConsentRecord>;
  if (typeof r.deviceId !== 'string' || r.deviceId.length > 64) return false;
  if (typeof r.nickname !== 'string' || r.nickname.length > 100) return false;
  if (r.consent !== true) return false;
  if (typeof r.consentTextVersion !== 'string' || r.consentTextVersion.length > 20) return false;
  if (typeof r.timestamp !== 'string' || r.timestamp.length > 50) return false;
  // `device` è validato e sanificato da sanitizeDevice nel handler.
  return true;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function fetchTemplate(): Promise<{ content: string; hash: string }> {
  const templatePath = process.env.CONSENT_TEMPLATE_BLOB_PATH;
  if (!templatePath) {
    throw new Error('CONSENT_TEMPLATE_BLOB_PATH non configurato');
  }

  // Il template vive nel container privato: niente dati GDPR nel pubblico.
  const containerClient = blobService.getContainerClient(privateContainerName);
  const blobClient = containerClient.getBlobClient(templatePath);
  const download = await blobClient.download();

  const chunks: Buffer[] = [];
  const stream = download.readableStreamBody;
  if (!stream) throw new Error('Template stream vuoto');

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const content = Buffer.concat(chunks).toString('utf8');
  const hash = createHash('sha256').update(content).digest('hex');
  return { content, hash };
}

async function ConsentSubmit(context: V3Context, req: V3Request): Promise<V3Response> {
  const cors = handleCors(req, context);
  if (cors.handled) return context.res as V3Response;

  const clientIp = getClientIp(req);
  if (rateLimited(`consent:${clientIp}`, 5)) {
    return buildResponse(429, { error: 'Troppi tentativi. Riprova tra un minuto.' }, cors.headers);
  }

  if (req.method?.toUpperCase() !== 'POST') {
    return buildResponse(405, { error: 'Metodo non consentito' }, cors.headers);
  }

  let body: unknown;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return buildResponse(400, { error: 'Body JSON non valido' }, cors.headers);
  }

  if (!isValidConsentRecord(body)) {
    return buildResponse(400, { error: 'Dati consenso non validi' }, cors.headers);
  }

  const deviceId = sanitizeDeviceId(body.deviceId);
  if (!deviceId) {
    return buildResponse(400, { error: 'deviceId non valido' }, cors.headers);
  }

  const device = sanitizeDevice(body.device);
  if (!device) {
    return buildResponse(400, { error: 'Dati consenso non validi' }, cors.headers);
  }

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(body.timestamp)) {
    return buildResponse(400, { error: 'Timestamp non valido' }, cors.headers);
  }

  const expectedHash = process.env.CONSENT_TEMPLATE_SHA256;
  if (!expectedHash) {
    context.log.error('CONSENT_TEMPLATE_SHA256 non configurato');
    return buildResponse(500, { error: 'Configurazione server incompleta' }, cors.headers);
  }

  try {
    const { content: template, hash } = await fetchTemplate();
    if (!timingSafeEqual(hash, expectedHash)) {
      context.log.error('Integrità del template di consenso compromessa');
      return buildResponse(500, { error: 'Errore interno del server' }, cors.headers);
    }

    const timestampSlug = body.timestamp.replace(/[:.]/g, '-');
    const displayName = body.nickname.trim() || 'Ospite anonimo';

    const filled = template
      .replaceAll('{{NICKNAME}}', escapeHtml(displayName))
      .replaceAll('{{DEVICE_ID}}', escapeHtml(deviceId))
      .replaceAll('{{TIMESTAMP}}', escapeHtml(body.timestamp))
      .replaceAll('{{IP_ADDRESS}}', 'non raccolto')
      .replaceAll('{{CONSENT_TEXT_VERSION}}', escapeHtml(body.consentTextVersion));

    const containerClient = blobService.getContainerClient(privateContainerName);

    const jsonBlob = `consents/${deviceId}-${timestampSlug}.json`;
    // Persiste SOLO i campi validati: nessuna chiave extra del client
    // può finire nel blob tramite lo spread.
    const jsonBody = JSON.stringify(
      {
        deviceId,
        nickname: body.nickname,
        consent: body.consent,
        consentTextVersion: body.consentTextVersion,
        timestamp: body.timestamp,
        device,
      },
      null,
      2,
    );
    await containerClient.getBlockBlobClient(jsonBlob).upload(jsonBody, Buffer.byteLength(jsonBody), {
      blobHTTPHeaders: { blobContentType: 'application/json' },
    });

    const htmlBlob = `consents/${deviceId}-${timestampSlug}.html`;
    await containerClient.getBlockBlobClient(htmlBlob).upload(filled, Buffer.byteLength(filled), {
      blobHTTPHeaders: { blobContentType: 'text/html' },
    });

    context.log.info(`Consenso salvato per deviceId=${deviceId}`);
    return buildResponse(200, { ok: true }, cors.headers);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Errore sconosciuto';
    context.log.error(`Errore in ConsentSubmit: ${message}`);
    return buildResponse(500, { error: 'Errore interno del server' }, cors.headers);
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return Buffer.compare(ha, hb) === 0;
}

module.exports = ConsentSubmit;
