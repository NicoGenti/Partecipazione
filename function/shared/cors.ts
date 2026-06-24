const ALLOWED = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export interface CorsResult {
  handled: boolean;
  headers: Record<string, string>;
}

export function handleCors(
  req: { method?: string; headers?: Record<string, string> },
  context: { res?: { status: number; body: unknown; headers: Record<string, string> } },
): CorsResult {
  const origin = req.headers?.['origin'] ?? '';
  const headers: Record<string, string> = {};

  if (ALLOWED.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Admin-Key, X-File-Name';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Max-Age'] = '86400';
  }

  if (req.method?.toUpperCase() === 'OPTIONS') {
    context.res = { status: 204, body: '', headers };
    return { handled: true, headers };
  }

  return { handled: false, headers };
}
