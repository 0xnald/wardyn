export function sameOrigin(origin: string | null, host: string | null): boolean {
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    return ['http:', 'https:'].includes(parsed.protocol) && parsed.host.toLowerCase() === host.toLowerCase() && parsed.origin === origin;
  } catch { return false; }
}
export function loopbackHost(host: string | null): boolean {
  if (!host) return false;
  try { return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(`http://${host}`).hostname); } catch { return false; }
}
