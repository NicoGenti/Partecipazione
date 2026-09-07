/* ──────────────────────────────────────────────────────────────
 * Rate limiting in-memory condiviso (pattern estratto da
 * RsvpDashboard). Per-instance: un cold start azzera i contatori
 * — accettabile per mitigare abusi su scala evento.
 * ────────────────────────────────────────────────────────────── */

interface RateEntry {
  count: number;
  resetAt: number;
}

const attempts = new Map<string, RateEntry>();

export function rateLimited(key: string, max: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    // Evita crescita illimitata della mappa: oltre 10.000 chiavi,
    // scarta le entrate scadute prima di inserirne di nuove.
    if (attempts.size > 10_000) {
      for (const [k, v] of attempts) {
        if (now > v.resetAt) attempts.delete(k);
      }
    }
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > max;
}

export function getClientIp(req: { headers?: Record<string, string> }): string {
  // x-forwarded-for può contenere più IP separati da virgola; il primo è
  // client-controllato, l'ultimo è quello aggiunto dal front-end Azure
  // (l'unico che il chiamante non può falsificare). Prendiamo l'ultimo.
  const forwarded = req.headers?.['x-forwarded-for'] ?? '';
  if (forwarded) {
    const parts = forwarded.split(',');
    return parts[parts.length - 1].trim();
  }
  return req.headers?.['x-real-ip'] ?? 'unknown';
}