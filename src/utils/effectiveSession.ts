/**
 * "View as" (impersonation) — effective session resolver.
 *
 * Rebuilds the `session.data` payload the target user would have at login, so the
 * next-auth `/api/auth/session` overlay (see `[...nextauth].jsx`) can return the
 * TARGET's identity/roles/scope/permissions to every client `useSession()`
 * consumer transparently. Mirrors the login-time `jwt` callback exactly — same
 * resolver functions, same JSON-string serialization — so the body is
 * byte-compatible with existing consumers (parseRoles, getCapabilities,
 * checkCurationScope, usePermissions).
 *
 * Server-only (imports DB controllers) — never import into a client component.
 */
import { findAdminUser } from '../../controllers/db/admin.users.controller';
import {
  findUserPermissions,
  findUserPermissionsEnriched,
  findUserScope,
} from '../../controllers/db/userroles.controller';
import { getEffectiveIdentity, isSuperuser } from './impersonation';

const EMAIL = 'email';
const PERSONIDENTIFIER = 'personIdentifier';

/** A login-shaped `session.data` slice for the impersonation target. */
export interface EffectiveSessionData {
  username: string;
  email: string;
  databaseUser: Record<string, unknown>;
  /** JSON string of role objects (matches token.userRoles from login). */
  userRoles: string;
  /** JSON string (matches token.permissions from login). */
  permissions: string;
  /** JSON string (matches token.permissionResources from login). */
  permissionResources: string;
  /** JSON string (matches token.scopeData from login). */
  scopeData: string;
}

/**
 * Resolve the target's effective `session.data`, reproducing the login `jwt`
 * callback for the target's (personIdentifier, email). Returns null when the
 * target cannot be resolved OR is itself a Superuser — a read-time re-check of
 * the start-time guard, so a stale overlay can never surface Superuser data.
 */
export async function resolveEffectiveSessionData(
  targetPersonIdentifier: string,
  targetEmail: string,
): Promise<EffectiveSessionData | null> {
  if (!targetPersonIdentifier) return null;

  // Canonical admin_users row: authoritative email (role/scope queries key on
  // it), name, status and userID. findAdminUser returns a Sequelize model.
  let row: any;
  try {
    row = await findAdminUser([PERSONIDENTIFIER, EMAIL], [targetPersonIdentifier, targetEmail || '']);
  } catch (err) {
    console.error('[impersonation] effective admin_users lookup failed', err);
    return null;
  }
  if (!row) return null;
  const plain: any = typeof row.get === 'function' ? row.get({ plain: true }) : row;

  // Use the email actually stored so role/scope resolution matches login.
  const email = String(plain.email || targetEmail || '').trim();

  // Roles — a JSON string, exactly as findUserPermissions returns and login stores.
  let userRoles = '[]';
  try {
    userRoles = await findUserPermissions([EMAIL, PERSONIDENTIFIER], [email, targetPersonIdentifier]);
  } catch (err) {
    console.error('[impersonation] effective roles resolution failed', err);
    return null;
  }

  // Read-time guard: never build an effective session for a Superuser target.
  if (isSuperuser(userRoles)) return null;

  let permissions: string[] = [];
  let permissionResources: any[] = [];
  try {
    const enriched = await findUserPermissionsEnriched([EMAIL, PERSONIDENTIFIER], [email, targetPersonIdentifier]);
    permissions = enriched.permissions;
    permissionResources = enriched.permissionResources;
  } catch (err) {
    console.error('[impersonation] effective permissions resolution failed', err);
  }

  let scopeData: { personTypes: string[] | null; orgUnits: string[] | null } = {
    personTypes: null,
    orgUnits: null,
  };
  try {
    scopeData = await findUserScope([EMAIL, PERSONIDENTIFIER], [email, targetPersonIdentifier]);
  } catch (err) {
    console.error('[impersonation] effective scope resolution failed', err);
  }

  // Mirror the login databaseUser shape (status gates AppLayout NoAccess; userID
  // is read by feedbacklog/resolveCurator; name drives the header/banner).
  const databaseUser = {
    userID: plain.userID,
    personIdentifier: plain.personIdentifier || targetPersonIdentifier,
    nameFirst: plain.nameFirst,
    nameMiddle: plain.nameMiddle,
    nameLast: plain.nameLast,
    email,
    status: plain.status,
    createTimestamp: plain.createTimestamp,
    modifyTimestamp: plain.modifyTimestamp,
  };

  return {
    username: targetPersonIdentifier,
    email,
    databaseUser,
    userRoles,
    permissions: JSON.stringify(permissions),
    permissionResources: JSON.stringify(permissionResources),
    scopeData: JSON.stringify(scopeData),
  };
}

/** Curation scope axes — non-empty string[] or null per axis (null = no restriction). */
export interface EffectiveScopeData {
  personTypes: string[] | null;
  orgUnits: string[] | null;
}

/**
 * Effective roles/scope/proxy for the current request, normalized to native
 * shapes regardless of whether the source is the (impersonating) TARGET resolved
 * from DB or the REAL user read from the next-auth token.
 */
export interface EffectiveRolesScope {
  /** EFFECTIVE personIdentifier (target when impersonating, else real). */
  personIdentifier: string;
  /** Always the REAL signed-in superuser's personIdentifier. */
  realPersonIdentifier: string;
  /** True while a live overlay is in effect. */
  impersonating: boolean;
  /** Parsed array of role objects (never a JSON string). */
  userRoles: Array<{ roleLabel?: string }>;
  /** Curation scope as a native object (never a JSON string). */
  scopeData: EffectiveScopeData;
  /** Array of person identifiers the effective user is a proxy for. */
  proxyPersonIds: string[];
}

/** Parse a JSON column / JWT value that may already be an array or be a string. */
function parseArray(value: unknown): any[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Resolve the EFFECTIVE roles, scope and proxy set for server-side authorization.
 *
 * Faithful act-as: while impersonating, authz reflects the TARGET — roles, scope
 * and proxy are resolved from the DB for the effective (personIdentifier, email),
 * NOT the real superuser's. When NOT impersonating, the values are read from the
 * next-auth token exactly as today's consumers do, so behavior is byte-identical.
 *
 * Normalization contract (callers can rely on native shapes):
 *  - userRoles  → array  (findUserPermissions returns a STRING; token.userRoles is a STRING — both JSON.parsed)
 *  - scopeData  → object (findUserScope returns an OBJECT; token.scopeData is a STRING — parsed when a string)
 *  - proxyPersonIds → array (admin_users.proxy_person_ids may be a STRING or array; token.proxyPersonIds is a STRING)
 *
 * Server-only (resolves identity + reads DB controllers) — never call from client code.
 */
export async function getEffectiveRolesScope(
  token: any,
  req: any,
): Promise<EffectiveRolesScope> {
  const identity = getEffectiveIdentity(token, req);

  if (identity.impersonating) {
    // TARGET path: resolve roles/scope/proxy from the DB for the effective user.
    const pid = identity.personIdentifier;
    const email = identity.email || '';

    // Roles — findUserPermissions returns a JSON STRING; parse to an array.
    let userRoles: Array<{ roleLabel?: string }> = [];
    try {
      const rolesStr = await findUserPermissions([EMAIL, PERSONIDENTIFIER], [email, pid]);
      userRoles = parseArray(rolesStr) as Array<{ roleLabel?: string }>;
    } catch (err) {
      console.error('[impersonation] effective roles (authz) resolution failed', err);
      userRoles = [];
    }

    // Scope — findUserScope returns an OBJECT already; use as-is.
    let scopeData: EffectiveScopeData = { personTypes: null, orgUnits: null };
    try {
      scopeData = await findUserScope([EMAIL, PERSONIDENTIFIER], [email, pid]);
    } catch (err) {
      console.error('[impersonation] effective scope (authz) resolution failed', err);
      scopeData = { personTypes: null, orgUnits: null };
    }

    // Proxy — from the admin_users row's proxy_person_ids (STRING or array), else [].
    let proxyPersonIds: string[] = [];
    try {
      const row: any = await findAdminUser([PERSONIDENTIFIER, EMAIL], [pid, email]);
      const plain: any = row && typeof row.get === 'function' ? row.get({ plain: true }) : row;
      proxyPersonIds = parseArray(plain?.proxy_person_ids).map(String);
    } catch (err) {
      console.error('[impersonation] effective proxy (authz) resolution failed', err);
      proxyPersonIds = [];
    }

    return {
      personIdentifier: pid,
      realPersonIdentifier: identity.realPersonIdentifier,
      impersonating: true,
      userRoles,
      scopeData,
      proxyPersonIds,
    };
  }

  // REAL path: read from the token exactly as the existing consumers do today.
  // token.userRoles is a JSON STRING; token.scopeData is a JSON STRING;
  // token.proxyPersonIds is a JSON STRING (today commonly absent → []).
  const userRoles = parseArray(token?.userRoles) as Array<{ roleLabel?: string }>;

  let scopeData: EffectiveScopeData = { personTypes: null, orgUnits: null };
  const rawScope = token?.scopeData;
  if (rawScope) {
    if (typeof rawScope === 'string') {
      try {
        const parsed = JSON.parse(rawScope);
        if (parsed && typeof parsed === 'object') scopeData = parsed;
      } catch {
        scopeData = { personTypes: null, orgUnits: null };
      }
    } else if (typeof rawScope === 'object') {
      scopeData = rawScope as EffectiveScopeData;
    }
  }

  const proxyPersonIds = parseArray(token?.proxyPersonIds).map(String);

  return {
    personIdentifier: identity.personIdentifier,
    realPersonIdentifier: identity.realPersonIdentifier,
    impersonating: false,
    userRoles,
    scopeData,
    proxyPersonIds,
  };
}
