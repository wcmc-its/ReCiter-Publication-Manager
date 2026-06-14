/**
 * "View as" (impersonation) — the effective-identity seam.
 *
 * A Superuser can temporarily act as another PM user. The overlay lives in a
 * signed, HTTP-only `pm_impersonation` cookie, kept SEPARATE from the next-auth
 * JWT (next-auth v3 can't mutate the session token mid-request). This module is
 * the ONE place "who am I acting as" is decided: render, role/scope resolution,
 * and data fetching read `getEffectiveIdentity`. Only audit attribution, the
 * banner, and the start/stop guard read the *real* identity.
 *
 * The whole feature is gated by IMPERSONATION_ENABLED (default off): when off,
 * any overlay cookie is ignored entirely, so the feature lands dark.
 *
 * Server-only (imports jsonwebtoken) — do not import into client components.
 */
import jwt from 'jsonwebtoken';

export const IMPERSONATION_COOKIE = 'pm_impersonation';

/** Read-time TTL (seconds). Default 30 min. The overlay is ignored once expired, regardless of the cookie's own Max-Age. */
export const IMPERSONATION_TTL_SECONDS = Number(process.env.IMPERSONATION_TTL_SECONDS ?? 1800);

export const SUPERUSER_ROLE = 'Superuser';

export interface ImpersonationOverlay {
  /** CWID being acted as. */
  targetPersonIdentifier: string;
  /** Target's email — needed downstream to resolve the target's roles/scope (keyed on pid + email). */
  targetEmail: string;
  /** The real superuser who started this. Binds the overlay to its owner and attributes actions ("logged to you"). */
  realPersonIdentifier: string;
  /** Epoch seconds when impersonation started. */
  startedAt: number;
}

export interface EffectiveIdentity {
  personIdentifier: string;
  email: string;
  /** True while a live overlay is in effect. */
  impersonating: boolean;
  /** The real signed-in superuser (=== personIdentifier when not impersonating). */
  realPersonIdentifier: string;
}

type ReqLike = { cookies?: Record<string, string | undefined> };
/** A next-auth JWT is an index type; accept it loosely. */
type TokenLike = Record<string, unknown> | null | undefined;

/** Current time in epoch seconds. */
export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** Whether the feature is enabled at all (default off). */
export function impersonationEnabled(): boolean {
  return process.env.IMPERSONATION_ENABLED === 'true';
}

function secret(): string {
  return process.env.NEXTAUTH_SECRET || '';
}

/** Sign an overlay into the cookie value (HS256, sharing the next-auth secret). */
export function signOverlay(overlay: ImpersonationOverlay): string {
  return jwt.sign(overlay, secret(), { algorithm: 'HS256' });
}

/** Verify + decode a cookie value into an overlay, or null if invalid/forged. */
export function verifyOverlay(value: string | undefined | null): ImpersonationOverlay | null {
  if (!value) return null;
  try {
    const decoded = jwt.verify(value, secret(), { algorithms: ['HS256'] }) as ImpersonationOverlay;
    if (!decoded || !decoded.targetPersonIdentifier || !decoded.realPersonIdentifier) return null;
    return decoded;
  } catch {
    return null;
  }
}

/** Whether an overlay is live: flag on AND present AND within TTL. Strict `>` → expires exactly at startedAt + TTL. */
export function overlayActive(overlay: ImpersonationOverlay | null, now: number = nowSeconds()): boolean {
  return impersonationEnabled() && !!overlay && overlay.startedAt + IMPERSONATION_TTL_SECONDS > now;
}

/** Read + verify the overlay from a request's cookies. Null when flag-off, absent, malformed, or expired. */
export function readOverlay(req: ReqLike, now: number = nowSeconds()): ImpersonationOverlay | null {
  if (!impersonationEnabled()) return null;
  const overlay = verifyOverlay(req?.cookies?.[IMPERSONATION_COOKIE]);
  return overlayActive(overlay, now) ? overlay : null;
}

/**
 * The single source of truth for "who am I acting as".
 * Returns the impersonation target when a live overlay exists AND it belongs to
 * this signed-in user (binding check); otherwise the real signed-in identity.
 */
export function getEffectiveIdentity(token: TokenLike, req: ReqLike, now: number = nowSeconds()): EffectiveIdentity {
  const realPersonIdentifier = token?.username ? String(token.username) : '';
  const realEmail = token?.email ? String(token.email) : '';
  const overlay = readOverlay(req, now);
  if (overlay && realPersonIdentifier && overlay.realPersonIdentifier === realPersonIdentifier) {
    return {
      personIdentifier: overlay.targetPersonIdentifier,
      email: overlay.targetEmail || '',
      impersonating: true,
      realPersonIdentifier,
    };
  }
  return {
    personIdentifier: realPersonIdentifier,
    email: realEmail,
    impersonating: false,
    realPersonIdentifier,
  };
}

/** Parse a next-auth token's `userRoles` (a JSON string) into role objects. Tolerates arrays/strings/empty. */
export function parseRoles(userRoles: unknown): Array<{ roleLabel?: string }> {
  if (!userRoles) return [];
  if (Array.isArray(userRoles)) return userRoles as Array<{ roleLabel?: string }>;
  try {
    const parsed = JSON.parse(String(userRoles));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Whether a roles value (array or JSON string) includes Superuser. */
export function isSuperuser(userRoles: unknown): boolean {
  return parseRoles(userRoles).some((r) => r?.roleLabel === SUPERUSER_ROLE);
}

/** Whether the real signed-in user may use "View as" (feature on AND superuser). */
export function canViewAs(token: TokenLike): boolean {
  return impersonationEnabled() && isSuperuser(token?.userRoles);
}
