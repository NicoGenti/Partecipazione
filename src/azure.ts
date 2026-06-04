const ACCOUNT_URL = import.meta.env.VITE_AZURE_ACCOUNT_URL;
const CONTAINER   = import.meta.env.VITE_AZURE_CONTAINER;
const RAW_SAS     = import.meta.env.VITE_AZURE_SAS;

const SAS = RAW_SAS?.startsWith('?') ? RAW_SAS.slice(1) : RAW_SAS;

export function isConfigured(): boolean {
  return !!(ACCOUNT_URL && CONTAINER && SAS);
}

export function buildBlobUrl(blobPath: string): string {
  return `${ACCOUNT_URL}/${CONTAINER}/${blobPath}?${SAS}`;
}

export function genUUID(): string {
  return crypto.randomUUID();
}

export async function uploadPhoto(file: File, blobName: string): Promise<void> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `photos/${blobName}.${ext}`;
  const url  = buildBlobUrl(path);

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'x-ms-blob-type': 'BlockBlob',
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });

  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
}

export async function listPhotos(): Promise<string[]> {
  const listUrl = `${ACCOUNT_URL}/${CONTAINER}?restype=container&comp=list&prefix=photos/&${SAS}`;
  const res = await fetch(listUrl);
  if (!res.ok) throw new Error(`List failed: ${res.status}`);

  const text = await res.text();
  const doc  = new DOMParser().parseFromString(text, 'application/xml');
  return Array.from(doc.querySelectorAll('Name'))
    .map(n => n.textContent ?? '')
    .filter(n => n.startsWith('photos/') && n !== 'photos/');
}

export async function fetchPhotoBlob(blobPath: string): Promise<Blob> {
  const url = buildBlobUrl(blobPath);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.blob();
}

export async function saveConsent(record: object): Promise<void> {
  const now = new Date().toISOString().replace(/[:.]/g, '-');
  const deviceId = (record as Record<string, string>).deviceId ?? genUUID();
  const path = `consents/${deviceId}-${now}.json`;
  const url  = buildBlobUrl(path);

  const body = JSON.stringify(record, null, 2);
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'x-ms-blob-type': 'BlockBlob',
      'Content-Type': 'application/json',
    },
    body,
  });

  if (!res.ok) throw new Error(`Consent save failed: ${res.status}`);
}
