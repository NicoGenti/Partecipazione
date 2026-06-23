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