export class ConfigError extends Error {
  constructor(variable: string) {
    super(`���������� ��������� ${variable} �� ������`);
    this.name = 'ConfigError';
  }
}

function required(name: 'ADMIN_PASSWORD' | 'ADMIN_SESSION_SECRET'): string {
  const value = process.env[name];
  if (!value) throw new ConfigError(name);
  return value;
}

export function getAdminPassword(): string {
  return required('ADMIN_PASSWORD');
}

/**
 * Signing key for the admin session cookie. Falls back to a value derived from
 * the admin password so a single-secret deployment still works; set the
 * explicit variable to rotate sessions without changing the password.
 */
export function getSessionSecret(): string {
  const explicit = process.env.ADMIN_SESSION_SECRET;
  return explicit && explicit.length > 0 ? explicit : `${getAdminPassword()}:session`;
}

export const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;
export const ADMIN_COOKIE_NAME = 'admin_session';

/** Cooldown between attempts, in milliseconds (1 hour). */
export const ATTEMPT_COOLDOWN_MS = 60 * 60 * 1000;
export const BROWSER_COOKIE_NAME = 'fsb_browser';
/** Browser identity cookie lives for a year so cooldowns survive restarts. */
export const BROWSER_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export const LIMITS = {
  name: 50,
  staticId: 64,
  answerCount: 500,
} as const;
