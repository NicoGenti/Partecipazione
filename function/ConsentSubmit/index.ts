import { createHash } from 'crypto';
import { blobService, containerName } from '../shared/storage';
import { handleCors } from '../shared/cors';
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

function isValidConsentRecord(v: unknown): v is ConsentRecord {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Partial<ConsentRecord>;
  if (typeof r.deviceId !== 'string' || r.deviceId.length > 64) return false;
  if (typeof r.nickname !== 'string' || r.nickname.length > 100) return false;
  if (r.consent !== true) return false;
  if (typeof r.consentTextVersion !== 'string' || r.consentTextVersion.length > 20) return false;
  if (typeof r.timestamp !== 'string' || r.timestamp.length > 50) return false;
  if (typeof r.device !== 'object' || r.device === null) return false;
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

  const containerClient = blobService.getContainerClient(containerName);
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

    const containerClient = blobService.getContainerClient(containerName);

    const jsonBlob = `consents/${deviceId}-${timestampSlug}.json`;
    const jsonBody = JSON.stringify(body, null, 2);
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
