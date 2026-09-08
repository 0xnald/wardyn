import { createHash, timingSafeEqual } from 'node:crypto';

export function sameOrigin(
  origin: string | null,
  host: string | null,
  allowedOrigin?: string,
): boolean {
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    const configured = allowedOrigin ? new URL(allowedOrigin).origin : null;
    return (
      ['http:', 'https:'].includes(parsed.protocol) &&
      (parsed.host.toLowerCase() === host.toLowerCase() || parsed.origin === configured) &&
      parsed.origin === origin
    );
  } catch {
    return false;
  }
}

export function validAccessCode(candidate: string | null, expected?: string): boolean {
  if (!candidate || !expected || expected.length < 16) return false;
  const actualHash = createHash('sha256').update(candidate).digest();
  const expectedHash = createHash('sha256').update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}
export function loopbackHost(host: string | null): boolean {
  if (!host) return false;
  try {
    return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(`http://${host}`).hostname);
  } catch {
    return false;
  }
}
