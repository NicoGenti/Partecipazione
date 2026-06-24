import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

const accountUrl = process.env.STORAGE_ACCOUNT_URL;
const accountName = process.env.STORAGE_ACCOUNT_NAME;
const accountKey = process.env.STORAGE_ACCOUNT_KEY;
const sas = process.env.RSVP_READ_SAS?.replace(/^\?/, '');

function createBlobServiceClient(): BlobServiceClient {
  if (!accountUrl) {
    throw new Error('STORAGE_ACCOUNT_URL non configurato');
  }

  // Per sviluppo locale o transizione: account key ha la precedenza.
  if (accountName && accountKey) {
    const credential = new StorageSharedKeyCredential(accountName, accountKey);
    return new BlobServiceClient(accountUrl, credential);
  }

  // Transizione: SAS read-only (dashboard legacy) o Managed Identity.
  if (sas) {
    return new BlobServiceClient(`${accountUrl}?${sas}`);
  }

  // Produzione: Managed Identity della Function App.
  return new BlobServiceClient(accountUrl, new DefaultAzureCredential());
}

export const blobService = createBlobServiceClient();
export const containerName = process.env.RSVP_CONTAINER_NAME ?? process.env.AZURE_CONTAINER ?? 'matrimonioblob';
