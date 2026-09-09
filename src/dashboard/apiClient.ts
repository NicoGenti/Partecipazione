import type {
  DashboardReply,
  DashboardError,
} from './types';

export const ADMIN_KEY_STORAGE = 'partecipazione_admin_key';

/**
 * Legge la Admin-Key dalla sessionStorage, mai dal bundle.
 * Trasparente al refresh della pagina finché la scheda resta aperta.
 */
export function getStoredAdminKey(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_KEY_STORAGE);
  } catch {
    return null;
  }
}

export function setStoredAdminKey(key: string): void {
  try {
    sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
  } catch {
    /* sessionStorage disabilitata (mode privata su alcuni browser) — ignorata */
  }
}

export function clearStoredAdminKey(): void {
  try {
    sessionStorage.removeItem(ADMIN_KEY_STORAGE);
  } catch {
    /* no-op */
  }
}

/**
 * Determina l'URL della Function:
 * 1. VITE_DASHBOARD_ENDPOINT in .env (consigliato in produzione).
 * 2. fallback localhost per dev.
 */
function resolveEndpoint(): string {
  const env = import.meta.env.VITE_DASHBOARD_ENDPOINT as string | undefined;
  if (env && env.length > 0) return env.replace(/\/$/, '');
  return 'http://localhost:7071/api/rsvp-dashboard';
}

/**
 * Chiama la Function con X-Admin-Key.
 * Ritorna `DashboardReply` oppure solleva un Error con messaggio localizzato.
 */
export async function fetchDashboard(
  adminKey: string,
  signal?: AbortSignal,
): Promise<DashboardReply> {
  const url = resolveEndpoint();
  let res: Response;

  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Admin-Key': adminKey,
        Accept: 'application/json',
      },
      signal,
    });
  } catch (e) {
    throw new Error(
      'Impossibile contattare la dashboard. Verifica la connessione o riprova più tardi.',
    );
  }

  if (res.status === 401) {
    throw new Error('Admin-Key errata o non riconosciuta.');
  }
  if (res.status === 403) {
    throw new Error('Questo sito non è autorizzato a consultare la dashboard.');
  }
  if (res.status === 500) {
    let msg = 'Errore interno del server.';
    try {
      const body = (await res.json()) as DashboardError;
      if (body?.error) msg = body.error;
    } catch {
      /* corpo non JSON — mantengo il messaggio di default */
    }
    throw new Error(msg);
  }
  if (!res.ok) {
    throw new Error(`Risposta imprevista dal server (HTTP ${res.status}).`);
  }

  try {
    return (await res.json()) as DashboardReply;
  } catch {
    throw new Error('Risposta del server non leggibile.');
  }
}

export interface PhotoDeleteReply {
  deleted: string[];
  missing: string[];
  failed: { name: string; error: string }[];
}

/**
 * Determina la base URL delle API foto (PhotoDelete):
 * 1. VITE_API_BASE_URL in .env (stessa base di listPhotos/upload).
 * 2. fallback localhost per dev.
 */
function resolvePhotoApiBase(): string {
  const env = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (env && env.length > 0) return env.replace(/\/$/, '');
  return 'http://localhost:7071';
}

/**
 * Elimina in batch foto dal container pubblico via POST /api/photos/delete.
 * Ritorna `{ deleted, missing, failed }` oppure solleva un Error con
 * messaggio localizzato (risposta non-2xx o rete non raggiungibile).
 */
export async function deletePhotos(
  adminKey: string,
  names: string[],
): Promise<PhotoDeleteReply> {
  const url = `${resolvePhotoApiBase()}/api/photos/delete`;
  let res: Response;

  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Admin-Key': adminKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ names }),
    });
  } catch {
    throw new Error(
      'Impossibile eliminare le foto. Verifica la connessione o riprova più tardi.',
    );
  }

  if (!res.ok) {
    let msg =
      res.status === 401
        ? 'Admin-Key errata o non riconosciuta.'
        : 'Impossibile eliminare le foto. Riprova più tardi.';
    try {
      const body = (await res.json()) as DashboardError;
      if (body?.error) msg = body.error;
    } catch {
      /* corpo non JSON — mantengo il messaggio di default */
    }
    throw new Error(msg);
  }

  try {
    return (await res.json()) as PhotoDeleteReply;
  } catch {
    throw new Error('Impossibile eliminare le foto. Riprova più tardi.');
  }
}