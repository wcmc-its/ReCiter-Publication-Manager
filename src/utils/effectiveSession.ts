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
import { findOnePerson } from '../../controllers/db/person.controller';
import { findOneAdminSettings } from '../../controllers/db/admin.settings.controller';
import sequelize from '../db/db';
import { getEffectiveIdentity, isSuperuser } from './impersonation';

const EMAIL = 'email';
const PERSONIDENTIFIER = 'personIdentifier';

/** Curate roles that mean "already provisioned" — if the target has any, we don't add Curator_Self. */
const CURATE_ROLE_LABELS = ['Curator_All', 'Curator_Self', 'Curator_Scoped'];
const CURATOR_SELF_ROLE_ID = 4;
const CURATOR_ALL_ROLE_ID = 2;

/**
 * Compute the default roles a target WOULD receive at their own login
 * (configured defaults from admin settings + Curator_Self for anyone in the
 * person table), WITHOUT writing anything — a read-only, ephemeral mirror of the
 * login-time `grantDefaultRolesToAdminUser`. Used so "View as" reflects the
 * target's real post-login experience even if they've never signed in, while
 * never mutating their account.
 *
 * Returns only the roles/permission keys NOT already present on the target.
 */
async function defaultRolesForTarget(
  targetPersonIdentifier: string,
  existingRoles: Array<{ roleLabel?: string; roleID?: number }>,
): Promise<{ roles: Array<{ roleLabel: string; roleID: number; personIdentifier: string }>; permissionKeys: string[] }> {
  const empty = { roles: [], permissionKeys: [] };
  const existingLabels = new Set(existingRoles.map((r) => r?.roleLabel).filter(Boolean));
  const existingIds = new Set(existingRoles.map((r) => r?.roleID).filter((v) => v != null));

  // Configured default roleIds (admin_settings 'userRoles' → checked roles).
  const candidateIds = new Set<number>();
  try {
    const settings: any = await findOneAdminSettings('userRoles');
    if (settings && settings.viewAttributes) {
      const va = JSON.parse(settings.viewAttributes);
      (Array.isArray(va) ? va : []).forEach((attr: any) => {
        (attr?.roles || []).forEach((role: any) => {
          if (role?.isChecked && role?.roleId != null) candidateIds.add(Number(role.roleId));
        });
      });
    }
  } catch (err) {
    console.error('[impersonation] default-role settings read failed', err);
  }

  // Curator_Self if the target is a person and has no curate role yet
  // (and the configured defaults don't already include Curator_All).
  let isPerson = false;
  try {
    const person: any = await findOnePerson([PERSONIDENTIFIER], [targetPersonIdentifier]);
    isPerson = !!(person && person.personIdentifier);
  } catch (err) {
    console.error('[impersonation] default-role person check failed', err);
  }
  const hasCurateRole = [...existingLabels].some((l) => CURATE_ROLE_LABELS.includes(l as string));
  if (isPerson && !hasCurateRole && !candidateIds.has(CURATOR_ALL_ROLE_ID)) {
    candidateIds.add(CURATOR_SELF_ROLE_ID);
  }

  const newIds = [...candidateIds].filter((id) => !existingIds.has(id));
  if (!newIds.length) return empty;

  // Fetch labels + permission keys for the net-new roles (read-only).
  let rows: any[] = [];
  try {
    rows = await sequelize.query(
      `SELECT ar.roleID, ar.roleLabel, p.permissionKey
       FROM admin_roles ar
       LEFT JOIN admin_role_permissions arp ON ar.roleID = arp.roleID
       LEFT JOIN admin_permissions p ON arp.permissionID = p.permissionID
       WHERE ar.roleID IN (:ids)`,
      { replacements: { ids: newIds }, raw: true, nest: true },
    );
  } catch (err) {
    console.error('[impersonation] default-role label/permission lookup failed', err);
    return empty;
  }

  const roleMap = new Map<number, { roleLabel: string; roleID: number; personIdentifier: string }>();
  const permKeys = new Set<string>();
  for (const r of rows) {
    if (r.roleLabel && !roleMap.has(r.roleID)) {
      roleMap.set(r.roleID, { roleLabel: r.roleLabel, roleID: r.roleID, personIdentifier: targetPersonIdentifier });
    }
    if (r.permissionKey) permKeys.add(r.permissionKey);
  }
  // Don't duplicate a roleLabel the target already has.
  const roles = [...roleMap.values()].filter((r) => !existingLabels.has(r.roleLabel));
  return { roles, permissionKeys: [...permKeys] };
}

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
  let plain: any;
  if (row) {
    plain = typeof row.get === 'function' ? row.get({ plain: true }) : row;
  } else {
    // No admin_users row — the target has never logged into PM. Synthesize a
    // login-shaped identity from the ReCiter directory (person table). Everything
    // below (roles via findUserPermissions → [], the isSuperuser fail-closed guard,
    // the defaultRolesForTarget augmentation that grants Curator_Self + configured
    // defaults, and the databaseUser shape) then works unchanged, mirroring exactly
    // what the target would receive on their own first login.
    let person: any;
    try {
      person = await findOnePerson([PERSONIDENTIFIER], [targetPersonIdentifier]);
    } catch (err) {
      console.error('[impersonation] effective person lookup failed', err);
      return null;
    }
    if (!person || !person.personIdentifier) return null;
    const p: any = typeof person.get === 'function' ? person.get({ plain: true }) : person;
    plain = {
      userID: null,
      personIdentifier: p.personIdentifier,
      nameFirst: p.firstName,
      nameMiddle: p.middleName,
      nameLast: p.lastName,
      email: String(p.primaryEmail || targetEmail || '').trim(),
      status: 1,
      createTimestamp: null,
      modifyTimestamp: null,
    };
  }

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

  // Ephemeral default roles: reflect what the target would have AFTER their own
  // login (Curator_Self for a person + configured defaults), WITHOUT writing to
  // the DB. This function only runs under an active overlay, so this only ever
  // augments the impersonation target — never the real user.
  let rolesArr: Array<{ roleLabel?: string; roleID?: number }> = [];
  try {
    const parsed = JSON.parse(userRoles);
    rolesArr = Array.isArray(parsed) ? parsed : [];
  } catch {
    rolesArr = [];
  }
  const def = await defaultRolesForTarget(targetPersonIdentifier, rolesArr);
  if (def.roles.length) rolesArr = [...rolesArr, ...def.roles];
  if (def.permissionKeys.length) permissions = [...new Set([...permissions, ...def.permissionKeys])];
  const userRolesOut = JSON.stringify(rolesArr);

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
    userRoles: userRolesOut,
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

    // Ephemeral default roles (same read-only logic as the session overlay) so
    // server-side authorization matches what the target would have after login.
    try {
      const def = await defaultRolesForTarget(pid, userRoles as Array<{ roleLabel?: string; roleID?: number }>);
      if (def.roles.length) userRoles = [...userRoles, ...def.roles];
    } catch (err) {
      console.error('[impersonation] effective default-roles (authz) failed', err);
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
