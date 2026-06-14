/**
 * "View as" (impersonation) start/stop — Superuser only.
 *
 *   POST   { targetPersonIdentifier }  → begin acting as the target (sets the signed overlay cookie)
 *   DELETE                             → stop ("Return to my view"; clears the cookie)
 *
 * Gated by IMPERSONATION_ENABLED (off → 404, feature dark). The caller's session
 * is read from the next-auth JWT; only Superusers pass. You cannot view-as
 * yourself or another Superuser. The real superuser is recorded in the overlay so
 * downstream actions stay "logged to you".
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { findUserPermissions } from '../../../../controllers/db/userroles.controller';
import { findAdminUser } from '../../../../controllers/db/admin.users.controller';
import {
  IMPERSONATION_COOKIE,
  IMPERSONATION_TTL_SECONDS,
  impersonationEnabled,
  canViewAs,
  isSuperuser,
  signOverlay,
  nowSeconds,
} from '../../../utils/impersonation';

const EMAIL = 'email';
const PERSONIDENTIFIER = 'personIdentifier';

function setOverlayCookie(res: NextApiResponse, value: string, maxAgeSeconds: number): void {
  const parts = [
    `${IMPERSONATION_COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  // Feature dark when the flag is off.
  if (!impersonationEnabled()) {
    res.status(404).end();
    return;
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !token.username) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  if (!canViewAs(token)) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }
  const realPersonIdentifier = String(token.username);

  // Stop impersonating.
  if (req.method === 'DELETE') {
    setOverlayCookie(res, '', 0);
    res.status(200).json({ ok: true, impersonating: false });
    return;
  }

  if (req.method === 'POST') {
    const targetPersonIdentifier = String(req.body?.targetPersonIdentifier || '').trim();
    if (!targetPersonIdentifier) {
      res.status(400).json({ error: 'targetPersonIdentifier is required' });
      return;
    }
    if (targetPersonIdentifier === realPersonIdentifier) {
      res.status(400).json({ error: 'You cannot view as yourself' });
      return;
    }

    // Resolve the target's admin_users row. Role/scope resolution keys on
    // personIdentifier + email, so we MUST use the email actually stored — never
    // an empty fallback. Otherwise the superuser-target guard below could be
    // bypassed: an empty email resolves zero roles, making isSuperuser() falsely
    // return false and permitting a view-as of an actual Superuser. Fail closed.
    let adminUser: any;
    try {
      adminUser = await findAdminUser([PERSONIDENTIFIER], [targetPersonIdentifier]);
    } catch (err) {
      console.error('[impersonation] target lookup failed', err);
      res.status(502).json({ error: 'Could not verify target user' });
      return;
    }
    if (!adminUser) {
      res.status(404).json({ error: 'Target user not found' });
      return;
    }
    const targetEmail = String(adminUser.email || '').trim();
    if (!targetEmail) {
      res.status(422).json({ error: 'Target has no email on record; cannot verify roles' });
      return;
    }

    let targetRoles: unknown;
    try {
      targetRoles = await findUserPermissions([EMAIL, PERSONIDENTIFIER], [targetEmail, targetPersonIdentifier]);
    } catch (err) {
      console.error('[impersonation] target role resolution failed', err);
      res.status(502).json({ error: 'Could not verify target user' });
      return;
    }
    if (isSuperuser(targetRoles)) {
      res.status(403).json({ error: 'You cannot view as another superuser' });
      return;
    }

    const overlay = {
      targetPersonIdentifier,
      targetEmail,
      realPersonIdentifier,
      startedAt: nowSeconds(),
    };
    setOverlayCookie(res, signOverlay(overlay), IMPERSONATION_TTL_SECONDS);
    res.status(200).json({
      ok: true,
      impersonating: true,
      target: { personIdentifier: targetPersonIdentifier },
      expiresInSeconds: IMPERSONATION_TTL_SECONDS,
    });
    return;
  }

  res.setHeader('Allow', 'POST, DELETE');
  res.status(405).end();
}
