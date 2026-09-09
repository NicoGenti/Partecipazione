import { createHash, timingSafeEqual } from 'crypto';

/* ──────────────────────────────────────────────────────────────
 * Autorizzazione admin (condivisa: RsvpDashboard, PhotoDelete).
 *
 * Il client DEVE inviare l'header 'x-admin-key' (Node HTTP lowercase)
 * contenente la passphrase configurata come app setting ADMIN_KEY.
 * Confronto a tempo costante tramite timingSafeEqual su hash SHA-256.
 * ────────────────────────────────────────────────────────────── */

export function secureCompare(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function authorized(req: { headers?: Record<string, string> }): boolean {
  const expected = process.env.ADMIN_KEY;
  if (!expected || expected.length < 16) return false;

  const headers = req.headers ?? {};
  const received = (headers['x-admin-key'] ?? '').trim();
  if (!received) return false;

  return secureCompare(received, expected);
}