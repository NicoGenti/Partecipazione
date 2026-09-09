import { blobService, containerName } from '../shared/storage';
import { handleCors } from '../shared/cors';
import { rateLimited, getClientIp } from '../shared/rateLimit';
import { authorized } from '../shared/adminAuth';

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

async function PhotoDelete(context: V3Context, req: V3Request): Promise<V3Response> {
  const cors = handleCors(req, context);
  if (cors.handled) return context.res as V3Response;

  const clientIp = getClientIp(req);
  if (rateLimited(`photodelete:${clientIp}`, 10)) {
    return buildResponse(429, { error: 'Troppi tentativi. Riprova tra un minuto.' }, cors.headers);
  }

  if (!authorized(req)) {
    return buildResponse(401, { error: 'X-Admin-Key mancante o errato' }, cors.headers);
  }

  if (req.method?.toUpperCase() !== 'POST') {
    return buildResponse(405, { error: 'Metodo non consentito' }, cors.headers);
  }

  let names: unknown;
  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    names = payload?.names;
  } catch {
    return buildResponse(400, { error: 'Nomi foto non validi' }, cors.headers);
  }

  const isValid =
    Array.isArray(names) &&
    names.length > 0 &&
    names.length <= 100 &&
    names.every(
      (n) =>
        typeof n === 'string' &&
        n.length <= 200 &&
        /^photos\/[\w.-]+$/.test(n) &&
        !n.includes('..'),
    );

  if (!isValid) {
    return buildResponse(400, { error: 'Nomi foto non validi' }, cors.headers);
  }

  try {
    // Container pubblico, solo prefisso photos/ — mai il container privato.
    const containerClient = blobService.getContainerClient(containerName);
    const uniqueNames = [...new Set(names as string[])];

    const deleted: string[] = [];
    const missing: string[] = [];
    const failed: { name: string; error: string }[] = [];

    for (const name of uniqueNames) {
      try {
        // deleteIfExists risponde { succeeded } — false se il blob non esisteva.
        const { succeeded } = await containerClient.getBlockBlobClient(name).deleteIfExists();
        if (succeeded) {
          deleted.push(name);
        } else {
          missing.push(name);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Errore sconosciuto';
        context.log.error(`PhotoDelete: eliminazione fallita per ${name}: ${message}`);
        failed.push({ name, error: message });
      }
    }

    context.log.info(
      `PhotoDelete: richieste=${uniqueNames.length} eliminate=${deleted.length} ` +
        `mancanti=${missing.length} fallite=${failed.length}`,
    );

    return buildResponse(200, { deleted, missing, failed }, cors.headers);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Errore sconosciuto';
    context.log.error(`Errore in PhotoDelete: ${message}`);
    return buildResponse(500, { error: 'Errore interno del server' }, cors.headers);
  }
}

module.exports = PhotoDelete;