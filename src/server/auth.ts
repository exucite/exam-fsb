import { ADMIN_SESSION_TTL_SECONDS, getAdminPassword, getSessionSecret } from '@/lib/config';

const TOKEN_VERSION = 'v1';
const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacSha256(message: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return new Uint8Array(signature);
}

/** Length-independent, timing-safe byte comparison. */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/** Compares the password through an HMAC so no length or prefix leaks. */
export async function verifyAdminPassword(candidate: unknown): Promise<boolean> {
  if (typeof candidate !== 'string' || candidate.length === 0) return false;
  const expected = await hmacSha256(getAdminPassword(), 'password-check');
  const actual = await hmacSha256(candidate, 'password-check');
  return constantTimeEqual(expected, actual);
}

export async function createSessionToken(nowMs: number = Date.now()): Promise<string> {
  const expiresAt = nowMs + ADMIN_SESSION_TTL_SECONDS * 1000;
  const payload = `${TOKEN_VERSION}.${expiresAt}`;
  const signature = await hmacSha256(payload, getSessionSecret());
  return `${payload}.${toBase64Url(signature)}`;
}

export async function verifySessionToken(
  token: unknown,
  nowMs: number = Date.now(),
): Promise<boolean> {
  if (typeof token !== 'string') return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [version, expiresAtRaw, signatureRaw] = parts as [string, string, string];
  if (version !== TOKEN_VERSION) return false;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= nowMs) return false;

  const provided = fromBase64Url(signatureRaw);
  if (!provided) return false;

  let expected: Uint8Array;
  try {
    expected = await hmacSha256(`${version}.${expiresAtRaw}`, getSessionSecret());
  } catch {
    return false;
  }
  return constantTimeEqual(expected, provided);
}
