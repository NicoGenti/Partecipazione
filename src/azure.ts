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

export async function uploadPhoto(file: File, blobName: string): Promise<void> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const url = api('/photo');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'X-File-Name': `${blobName}.${ext}`,
    },
    body: file,
  });

  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
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
