import { randomBytes, createHash } from 'crypto';
import { cookies } from 'next/headers';
import {
  BROWSER_COOKIE_NAME,
  BROWSER_COOKIE_MAX_AGE_SECONDS,
} from '@/lib/config';

/**
 * Returns the browser identity: an opaque id stored in a long-lived cookie.
 * The cookie value is only a random token; the id stored in the database is
 * its SHA-256 hash so a stolen cookie dump cannot be replayed as-is.
 *
 * `setCookie` must be called in a Route Handler context — there the cookie
 * container mutates the outgoing response automatically.
 */
export async function getBrowserId(setCookie: boolean): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(BROWSER_COOKIE_NAME)?.value;

  if (existing && /^[A-Za-z0-9_-]{22,}$/.test(existing)) {
    return hashToken(existing);
  }

  const fresh = randomBytes(24).toString('base64url');
  if (setCookie) {
    jar.set(BROWSER_COOKIE_NAME, fresh, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: BROWSER_COOKIE_MAX_AGE_SECONDS,
      path: '/',
    });
  }
  return hashToken(fresh);
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
