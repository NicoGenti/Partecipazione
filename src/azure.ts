import type { RsvpRecord } from './rsvp';

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '');
const ACCOUNT_URL = import.meta.env.VITE_AZURE_ACCOUNT_URL?.replace(/\/$/, '');
const CONTAINER = import.meta.env.VITE_AZURE_CONTAINER;

export function isConfigured(): boolean {
  return !!(API_BASE && ACCOUNT_URL && CONTAINER);
}

export function genUUID(): string {
  return crypto.randomUUID();
}

function api(path: string): string {
  if (!API_BASE) throw new Error('VITE_API_BASE_URL non configurato');
  return `${API_BASE}/api${path.startsWith('/') ? path : `/${path}`}`;
}

export function buildBlobUrl(blobPath: string): string {
  if (!ACCOUNT_URL || !CONTAINER) throw new Error('Configurazione blob storage mancante');
  return `${ACCOUNT_URL}/${CONTAINER}/${blobPath}`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (typeof result !== 'string' || !result.includes(',')) {
        reject(new Error('FileReader result non valido'));
        return;
      }
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(new Error(`FileReader error: ${reader.error?.message ?? 'sconosciuto'}`));
    reader.onabort = () => reject(new Error('FileReader abort'));
    reader.readAsDataURL(file);
  });
}

/**
 * Thrown when the photo-upload API responds with a non-2xx status.
 * The message is the server's Italian error text parsed from the JSON body
 * (e.g. "File troppo grande (max 10 MB)"), so callers can surface it verbatim.
 */
export class UploadApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadApiError';
  }
}

export async function uploadPhotoBase64(
  base64: string,
  fileName: string,
  contentType: string,
  blobName: string,
): Promise<void> {
  const ext = fileName.split('.').pop() ?? 'jpg';
  const url = api('/photo');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file: base64,
      fileName: `${blobName}.${ext}`,
      contentType: contentType || 'application/octet-stream',
    }),
  });

  if (!res.ok) {
    // Surface the server's rejection reason (e.g. "File troppo grande (max 10 MB)",
    // "Formato immagine non supportato") instead of a generic status line.
    let message = `Upload failed: ${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (typeof body.error === 'string' && body.error) message = body.error;
    } catch {
      // Body is not JSON — keep the status-line fallback.
    }
    throw new UploadApiError(message);
  }
}

export async function uploadPhoto(file: File, blobName: string): Promise<void> {
  const base64 = await fileToBase64(file);
  return uploadPhotoBase64(base64, file.name, file.type, blobName);
}

export async function listPhotos(): Promise<string[]> {
  const url = api('/photos');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`List failed: ${res.status}`);

  const data = (await res.json()) as { paths?: string[] };
  return (data.paths ?? []).filter((n) => n.startsWith('photos/') && n !== 'photos/');
}

export async function fetchPhotoBlob(blobPath: string): Promise<Blob> {
  const url = buildBlobUrl(blobPath);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.blob();
}

export async function saveConsent(record: object): Promise<void> {
  const url = api('/consent');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });
  if (!res.ok) throw new Error(`Consent save failed: ${res.status}`);
}

export async function saveRsvp(record: RsvpRecord): Promise<void> {
  const url = api('/rsvp');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });
  if (!res.ok) throw new Error(`RSVP save failed: ${res.status}`);
}
