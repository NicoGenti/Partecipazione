import { randomUUID } from 'crypto';
import { blobService, containerName } from '../shared/storage';
import { handleCors } from '../shared/cors';

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

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

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

function sanitizeFileName(name: string): string {
  // Conserva solo nome base, senza path.
  const base = name.replace(/\\/g, '/').split('/').pop() ?? 'image';
  // Rimuovi caratteri pericolosi.
  return base.replace(/[^\w.\-]/g, '_').slice(0, 100);
}

interface ParsedRequest {
  contentType: string;
  rawBody: Buffer;
  rawFileName: string;
}

interface ParseError {
  error: string;
}

async function parseRequest(req: V3Request, rawContentType: string): Promise<ParsedRequest | ParseError> {
  const contentType = rawContentType.toLowerCase().split(';')[0].trim();

  if (contentType === 'application/json') {
    const payload =
      typeof req.body === 'string' ? JSON.parse(req.body) : (req.body as { file?: string; fileName?: string; contentType?: string });
    if (typeof payload.file !== 'string') return { error: 'Campo file mancante' };
    const fileBytes = Buffer.from(payload.file, 'base64');
    const fileContentType = payload.contentType ?? 'image/jpeg';
    if (!ALLOWED_CONTENT_TYPES[fileContentType.toLowerCase().split(';')[0].trim()]) {
      return { error: 'Formato immagine non supportato' };
    }
    return {
      contentType: fileContentType.toLowerCase().split(';')[0].trim(),
      rawBody: fileBytes,
      rawFileName: payload.fileName ?? 'photo.jpg',
    };
  }

  if (!ALLOWED_CONTENT_TYPES[contentType]) {
    return { error: 'Formato immagine non supportato' };
  }

  let rawBody: Buffer;
  try {
    rawBody = normalizeBody(req.body);
  } catch {
    return { error: 'Body non binario' };
  }

  const rawFileName =
    Object.entries(req.headers ?? {}).find(([k]) => k.toLowerCase() === 'x-file-name')?.[1] ??
    `photo.${ALLOWED_CONTENT_TYPES[contentType]}`;

  return { contentType, rawBody, rawFileName };
}

function normalizeBody(body: unknown): Buffer {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof body === 'string') {
    const asBase64 = Buffer.from(body, 'base64');
    const isJpeg = asBase64[0] === 0xff && asBase64[1] === 0xd8 && asBase64[2] === 0xff;
    const isPng = asBase64.length >= 8 &&
      asBase64[0] === 0x89 && asBase64[1] === 0x50 && asBase64[2] === 0x4e && asBase64[3] === 0x47;
    if (isJpeg || isPng) return asBase64;
    return Buffer.from(body, 'utf8');
  }
  if (body && typeof body === 'object') {
    const payload = body as { data?: string; base64?: string };
    const candidate = payload.data ?? payload.base64;
    if (typeof candidate === 'string') return Buffer.from(candidate, 'base64');
  }
  throw new Error('Body non binario');
}

function detectExtension(contentType: string, buffer: Buffer): string | null {
  const allowed = ALLOWED_CONTENT_TYPES[contentType];
  if (!allowed) return null;

  // Verifica magic bytes indipendentemente dall'estensione dichiarata.
  if (contentType === 'image/jpeg' && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }
  if (
    contentType === 'image/png' &&
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }
  if (
    contentType === 'image/webp' &&
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'webp';
  }

  return null;
}

async function PhotoUpload(context: V3Context, req: V3Request): Promise<V3Response> {
  const cors = handleCors(req, context);
  if (cors.handled) return context.res as V3Response;

  context.log.info(
    `PhotoUpload request: method=${req.method ?? 'undefined'} ` +
    `content-type=${req.headers?.['content-type'] ?? 'missing'} ` +
    `x-file-name=${req.headers?.['x-file-name'] ?? 'missing'} ` +
    `bodyType=${typeof req.body} isBuffer=${Buffer.isBuffer(req.body)} ` +
    `bodyLength=${Buffer.isBuffer(req.body) ? req.body.length : 'n/a'}`
  );

  if (req.method?.toUpperCase() !== 'POST') {
    return buildResponse(405, { error: 'Metodo non consentito' }, cors.headers);
  }

  const rawContentType = req.headers?.['content-type'] ?? '';
  const parsed = await parseRequest(req, rawContentType);
  if ('error' in parsed) {
    context.log.error(`PhotoUpload parse error: ${parsed.error}`);
    return buildResponse(400, { error: parsed.error }, cors.headers);
  }

  const { contentType, rawBody, rawFileName } = parsed;
  context.log.info(
    `PhotoUpload parsed: contentType=${contentType} ` +
    `length=${rawBody.length} firstBytes=[${rawBody.slice(0, 4).join(',')}]`
  );

  if (rawBody.length === 0) {
    return buildResponse(400, { error: 'File vuoto' }, cors.headers);
  }

  if (rawBody.length > MAX_SIZE_BYTES) {
    return buildResponse(413, { error: 'File troppo grande (max 10 MB)' }, cors.headers);
  }

  const ext = detectExtension(contentType, rawBody);
  if (!ext) {
    return buildResponse(400, { error: 'Firma del file non valida' }, cors.headers);
  }

  const fileName = sanitizeFileName(String(rawFileName));
  const id = randomUUID();
  const blobName = `photos/${id}.${ext}`;

  try {
    const containerClient = blobService.getContainerClient(containerName);
    await containerClient.getBlockBlobClient(blobName).upload(rawBody, rawBody.length, {
      blobHTTPHeaders: { blobContentType: contentType },
      metadata: { originalName: fileName },
    });

    context.log.info(`Foto caricata: ${blobName}`);
    return buildResponse(200, { ok: true, blobPath: blobName }, cors.headers);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Errore sconosciuto';
    context.log.error(`Errore in PhotoUpload: ${message}`);
    return buildResponse(500, { error: 'Errore interno del server' }, cors.headers);
  }
}

module.exports = PhotoUpload;
