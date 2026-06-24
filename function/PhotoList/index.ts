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

async function PhotoList(context: V3Context, req: V3Request): Promise<V3Response> {
  const cors = handleCors(req, context);
  if (cors.handled) return context.res as V3Response;

  if (req.method?.toUpperCase() !== 'GET') {
    return buildResponse(405, { error: 'Metodo non consentito' }, cors.headers);
  }

  try {
    const containerClient = blobService.getContainerClient(containerName);
    const paths: string[] = [];

    for await (const item of containerClient.listBlobsFlat({ prefix: 'photos/' })) {
      if (item.name !== 'photos/' && !item.name.endsWith('/')) {
        paths.push(item.name);
      }
    }

    return buildResponse(200, { paths }, cors.headers);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Errore sconosciuto';
    context.log.error(`Errore in PhotoList: ${message}`);
    return buildResponse(500, { error: 'Errore interno del server' }, cors.headers);
  }
}

module.exports = PhotoList;
