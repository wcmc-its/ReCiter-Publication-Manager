#!/usr/bin/env node
/**
 * Ticket P -- Superuser "View as <cwid>" impersonation. Source-text assertions (no DB/AWS/
 * build needed for most sections -- same convention as scripts/check-scopus-paging.mjs),
 * plus a runnable pure-function self-test of src/utils/viewAs.js and a cookie-size probe
 * against next-auth's real JWE encoder.
 * Run: node scripts/check-view-as.mjs
 *
 * Twelve sections: the original nine (one per D1-D10 area of the design), plus three follow-up
 * sections (Ticket Q) for the Find People scope filter applying on initial load/pagination and
 * the banner's flush-under-header placement:
 *   1. src/utils/viewAs.js -- exports + a RUNNABLE self-test (imports the module for real).
 *   2. [...nextauth].jsx -- trigger/session transport, the canManageUsers gate, the expiry
 *      sweep, the session shape, the three dead session.user.username= lines gone.
 *   3. viewAsServer.js -- status:1 where clause, the down-only guard, parseJsonColumn use.
 *   4. middleware.ts -- effectiveToken() applied to the decoded token, chunk-tolerant cookie
 *      check.
 *   5. goldstandard.ts + userfeedback/[uid].ts -- canCurate(effectiveToken(token), ...),
 *      curatedBy still from the raw token.
 *   6. admin.feedbacklog.controller.ts -- getToken present, req.body no longer supplies
 *      userID.
 *   7. view-as/lookup.ts -- isAuthorizedAdmin gate, the three reasons.
 *   8. UI -- banner mounted in AppLayout with no dismiss control, update({ viewAs: null }),
 *      modal confirm copy, nav entry gated on canViewAs.
 *   9. Cookie size -- encodes a representative token with next-auth's real encode() and
 *      measures the JWE length.
 *  10. Search.js -- applyScopeFilters defined once, used in the toggle effect, the search
 *      handler and fetchPaginatedData; scopeFilterInitRef still present.
 *  11. ViewAs.module.css -- .banner flush under the header (top: var(--header-height),
 *      negative content-padding-canceling margins, app font); .returnButton inherits it.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PASS = "\x1b[32mPASS\x1b[0m";
const FAIL = "\x1b[31mFAIL\x1b[0m";
const INFO = "\x1b[36mINFO\x1b[0m";
let failures = 0;
let passes = 0;
const assert = (cond, label) => {
  console.log(`  ${cond ? PASS : FAIL} ${label}`);
  if (cond) passes++;
  else failures++;
};
const info = (label) => console.log(`  ${INFO} ${label}`);

const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const viewAsSrc = read("src/utils/viewAs.js");
const nextauthSrc = read("src/pages/api/auth/[...nextauth].jsx");
const viewAsServerSrc = read("src/utils/viewAsServer.js");
const middlewareSrc = read("src/middleware.ts");
const goldstandardSrc = read("src/pages/api/reciter/update/goldstandard.ts");
const userfeedbackSrc = read("src/pages/api/reciter/save/userfeedback/[uid].ts");
const feedbacklogSrc = read("controllers/db/admin.feedbacklog.controller.ts");
const lookupSrc = read("src/pages/api/db/admin/view-as/lookup.ts");
const appLayoutSrc = read("src/components/layouts/AppLayout.jsx");
const bannerSrc = read("src/components/elements/ViewAs/ViewAsBanner.jsx");
const modalSrc = read("src/components/elements/ViewAs/ViewAsModal.jsx");
const sideNavbarSrc = read("src/components/elements/Navbar/SideNavbar.tsx");
const searchSrc = read("src/components/elements/Search/Search.js");
const viewAsCssSrc = read("src/components/elements/ViewAs/ViewAs.module.css");
const scopeResolverSrc = read("src/utils/scopeResolver.ts");

// ---------------------------------------------------------------------------------------
console.log("\n1. src/utils/viewAs.js -- exports + runnable self-test:");
assert(/export const VIEW_AS_TTL_SECONDS\s*=\s*1800/.test(viewAsSrc), "VIEW_AS_TTL_SECONDS = 1800");
assert(/export const nowSeconds/.test(viewAsSrc), "nowSeconds exported");
assert(/export function viewAsActive/.test(viewAsSrc), "viewAsActive exported");
assert(/export function effectiveToken/.test(viewAsSrc), "effectiveToken exported");
assert(/export function viewAsSummary/.test(viewAsSrc), "viewAsSummary exported");
assert(/export function scopeFieldsFromDbUser/.test(viewAsSrc), "scopeFieldsFromDbUser exported (single copy of the scope-building logic)");
{
  const importLines = viewAsSrc.split("\n").filter((l) => /^\s*(import|const .*=\s*require\()/.test(l));
  const hasNodeImport = importLines.some((l) => /['"]fs['"]|['"]sequelize['"]|next-auth\/jwt|['"]\.\.\/db\//.test(l));
  assert(importLines.length === 0 && !hasNodeImport, "no import statements at all -- stays Edge-safe (no fs/Sequelize/next-auth-jwt)");
}

{
  const mod = await import(pathToFileURL(join(ROOT, "src/utils/viewAs.js")).href);
  const { viewAsActive, effectiveToken, viewAsSummary, VIEW_AS_TTL_SECONDS } = mod;

  assert(viewAsActive({}, 1000) === false, "viewAsActive: false with no overlay");
  const startedAt = 1000;
  assert(viewAsActive({ viewAs: { startedAt } }, startedAt + VIEW_AS_TTL_SECONDS - 1) === true, "viewAsActive: true at startedAt+1799");
  assert(viewAsActive({ viewAs: { startedAt } }, startedAt + VIEW_AS_TTL_SECONDS) === false, "viewAsActive: false at startedAt+1800");

  const inactiveToken = { username: "real1", viewAs: { startedAt: 1, targetCwid: "x" } };
  const inactiveResult = effectiveToken(inactiveToken, 10000);
  assert(inactiveResult === inactiveToken, "effectiveToken: returns the SAME object reference when inactive");

  const before = JSON.stringify(inactiveToken);
  effectiveToken(inactiveToken, 10000);
  assert(JSON.stringify(inactiveToken) === before, "effectiveToken: does not mutate the input token (inactive path)");

  const activeStartedAt = 1000;
  const activeToken = {
    username: "real1",
    databaseUser: { userID: 1, personIdentifier: "real1" },
    userRoles: '[{"roleLabel":"Superuser","personIdentifier":"real1"}]',
    scopeData: '{"personTypes":null,"orgUnits":null}',
    proxyPersonIds: "[]",
    name: "Real User",
    user: { personIdentifier: "real1" },
    viewAs: {
      targetCwid: "target1",
      startedAt: activeStartedAt,
      name: "Target User",
      databaseUser: { userID: 2, personIdentifier: "target1", scope_person_types: ["a"], scope_org_units: null, proxy_person_ids: null },
      userRoles: '[{"roleLabel":"Curator_All","personIdentifier":"target1"}]',
    },
  };
  const beforeActive = JSON.stringify(activeToken);
  const activeResult = effectiveToken(activeToken, activeStartedAt + 10);
  assert(JSON.stringify(activeToken) === beforeActive, "effectiveToken: does not mutate the input token (active path)");
  assert(activeResult !== activeToken, "effectiveToken: returns a COPY (not the same reference) when active");
  assert(activeResult.username === "target1", "effectiveToken: username swapped to target");
  assert(activeResult.userRoles === activeToken.viewAs.userRoles, "effectiveToken: userRoles swapped to target");
  assert(JSON.parse(activeResult.scopeData).personTypes[0] === "a", "effectiveToken: scopeData rebuilt from target databaseUser");
  assert(activeResult.databaseUser === activeToken.viewAs.databaseUser, "effectiveToken: databaseUser swapped to target");

  const summary = viewAsSummary(activeToken, activeStartedAt + 10);
  assert(summary && summary.targetCwid === "target1" && summary.expiresAt === activeStartedAt + VIEW_AS_TTL_SECONDS, "viewAsSummary: shape correct when active");
  assert(viewAsSummary({}, 10) === null, "viewAsSummary: null when inactive");
}

// ---------------------------------------------------------------------------------------
console.log("\n2. [...nextauth].jsx -- overlay transport + session shape:");
assert(/async jwt\(\s*\{\s*token,\s*user,\s*trigger,\s*session\s*\}\s*\)/.test(nextauthSrc), "jwt() destructures { token, user, trigger, session }");
assert(/token\.actor\s*=\s*\{/.test(nextauthSrc), "token.actor set in the if(user) login block");
assert(/if\s*\(\s*token\.viewAs\s*&&\s*!viewAsActive\(token\)\s*\)/.test(nextauthSrc), "expiry sweep: if (token.viewAs && !viewAsActive(token))");
assert(/trigger\s*===\s*'update'/.test(nextauthSrc), "trigger === 'update' checked");
assert(/Object\.prototype\.hasOwnProperty\.call\(session,\s*'viewAs'\)/.test(nextauthSrc), "hasOwnProperty.call(session, 'viewAs') guard");
assert(/session\.viewAs\s*===\s*null/.test(nextauthSrc), "session.viewAs === null (stop) branch");
assert(/getCapabilities\(realRoles\)\.canManageUsers\s*===\s*true/.test(nextauthSrc), "canManageUsers gate on the REAL token's roles");
assert(/cwid\s*===\s*\(token\.actor\?\.personIdentifier \|\| token\.username\)/.test(nextauthSrc), "self-target refused (cwid === actor personIdentifier, falling back to token.username for pre-deploy sessions)");
assert(/resolveViewAsTarget\(cwid\)/.test(nextauthSrc), "resolveViewAsTarget(cwid) called");
assert(/view_as_started/.test(nextauthSrc) && /view_as_ended/.test(nextauthSrc) && /view_as_refused/.test(nextauthSrc), "all three log events present (view_as_started/ended/refused)");
assert(/const eff\s*=\s*effectiveToken\(token\)/.test(nextauthSrc), "session() calls effectiveToken(token)");
assert(/session\.data\s*=\s*eff/.test(nextauthSrc), "session.data = eff");
assert(/session\.user\s*=\s*eff\.user/.test(nextauthSrc), "session.user = eff.user");
assert(/session\.viewAs\s*=\s*viewAsSummary\(token\)/.test(nextauthSrc), "session.viewAs = viewAsSummary(token)");
assert(/session\.actor\s*=\s*token\.actor/.test(nextauthSrc), "session.actor = token.actor");
assert(/session\.canViewAs\s*=/.test(nextauthSrc), "session.canViewAs assigned");
assert(!/session\.user\.username\s*=\s*token\.username/.test(nextauthSrc), "dead line gone: session.user.username = token.username");
assert(!/session\.user\.databaseUser\s*=\s*token\.databaseUser/.test(nextauthSrc), "dead line gone: session.user.databaseUser = token.databaseUser");
assert(!/session\.user\.userRoles\s*=\s*token\.userRoles/.test(nextauthSrc), "dead line gone: session.user.userRoles = token.userRoles");

// ---------------------------------------------------------------------------------------
console.log("\n3. viewAsServer.js -- target resolution + down-only guard:");
assert(/status:\s*1/.test(viewAsServerSrc), "AdminUser lookup filters status: 1");
assert(/target_is_superuser/.test(viewAsServerSrc), "'target_is_superuser' reason present (down-only guard)");
assert(/not_found/.test(viewAsServerSrc), "'not_found' reason present");
assert(/parseJsonColumn\(/.test(viewAsServerSrc), "parseJsonColumn applied to scope/proxy columns");
assert(/getCapabilities\(parsed\)\.canManageUsers/.test(viewAsServerSrc), "getCapabilities(...).canManageUsers guard reused, same test isAuthorizedAdmin uses");
assert(/findUserPermissions\(/.test(viewAsServerSrc), "findUserPermissions imported from services/db/userroles.service, as D4 specifies");

// ---------------------------------------------------------------------------------------
console.log("\n4. src/middleware.ts -- effective-token substitution + chunked cookie check:");
assert(/import\s*\{\s*effectiveToken\s*\}\s*from\s*['"]\.\/utils\/viewAs['"]/.test(middlewareSrc), "imports effectiveToken from ./utils/viewAs");
assert(/decodedTokenJson\s*=\s*effectiveToken\(decodedTokenJson/.test(middlewareSrc), "decodedTokenJson reassigned via effectiveToken(...) right after getToken");
assert(/getAll\(\)\.some\(/.test(middlewareSrc), "cookie-presence check uses getAll().some(...) instead of a plain has()");
assert(/startsWith\(N \+ '\.'\)/.test(middlewareSrc) || /startsWith\(N\s*\+\s*'\.'\)/.test(middlewareSrc), "chunk suffix (name + '.') tolerated for the base cookie name");
assert(/startsWith\(SECURE_N \+ '\.'\)/.test(middlewareSrc), "chunk suffix tolerated for the __Secure- cookie name");

// ---------------------------------------------------------------------------------------
console.log("\n5. Curate-write routes -- authorize as effective, attribute to real:");
assert(/canCurate\(effectiveToken\(token\)/.test(goldstandardSrc), "goldstandard.ts: canCurate(effectiveToken(token), ...)");
assert(/curatedBy\s*=\s*0/.test(goldstandardSrc) && /token\?\.databaseUser\?\.userID/.test(goldstandardSrc), "goldstandard.ts: curatedBy still resolved from the RAW token (real human)");
assert(!/canCurate\(token,/.test(goldstandardSrc.replace(/canCurate\(effectiveToken\(token\)/g, "")), "goldstandard.ts: no remaining canCurate(token, ...) call using the raw token");
assert(/canCurate\(effectiveToken\(token\)/.test(userfeedbackSrc), "userfeedback/[uid].ts: canCurate(effectiveToken(token), ...)");

// ---------------------------------------------------------------------------------------
console.log("\n6. admin.feedbacklog.controller.ts -- server-resolved actor:");
assert(/import\s*\{\s*getToken\s*\}\s*from\s*['"]next-auth\/jwt['"]/.test(feedbacklogSrc), "getToken imported from next-auth/jwt");
assert(!/const\s*\{\s*userID,\s*personIdentifier,\s*articleIdentifier,\s*feedback\s*\}\s*=\s*req\.body/.test(feedbacklogSrc), "req.body destructure no longer includes userID");
assert(/const\s*\{\s*personIdentifier,\s*articleIdentifier,\s*feedback\s*\}\s*=\s*req\.body/.test(feedbacklogSrc), "req.body destructure now reads only personIdentifier/articleIdentifier/feedback");
assert(/Number\(token\?\.databaseUser\?\.userID\)/.test(feedbacklogSrc), "userID resolved from the JWT (Number(token?.databaseUser?.userID))");
assert(/Not signed in/.test(feedbacklogSrc), "401 'Not signed in' on a missing/invalid token");
assert(/status:\s*1/.test(feedbacklogSrc), "existing status: 1 DB check kept");

// ---------------------------------------------------------------------------------------
console.log("\n7. view-as/lookup.ts -- admin-gated target lookup:");
assert(/isAuthorizedAdmin\(req\)/.test(lookupSrc), "isAuthorizedAdmin(req) gate present");
assert(/reason:\s*'self'/.test(lookupSrc), "'self' reason present (target === real token username)");
assert(/target_is_superuser/.test(lookupSrc), "'target_is_superuser' branched on (403) present");
assert(/reason:\s*result\.reason/.test(lookupSrc) && /not_found/.test(viewAsServerSrc), "'not_found' forwarded from resolveViewAsTarget's result.reason (404 fallback)");
assert(/resolveViewAsTarget\(cwid\)/.test(lookupSrc), "calls resolveViewAsTarget(cwid)");
assert(/status\(400\)/.test(lookupSrc), "400 on a missing cwid");

// ---------------------------------------------------------------------------------------
console.log("\n8. UI -- banner, modal, nav entry:");
assert(/<ViewAsBanner\s*\/>/.test(appLayoutSrc), "ViewAsBanner mounted in AppLayout");
assert(!/aria-label=["']dismiss["']|onClick=\{.*dismiss/i.test(bannerSrc), "banner has no dismiss control");
assert(/role="status"/.test(bannerSrc) && /aria-live="polite"/.test(bannerSrc), "banner carries role=status aria-live=polite");
assert(/update\(\{\s*viewAs:\s*null\s*\}\)/.test(bannerSrc), "'Return to my view' calls update({ viewAs: null })");
assert(/Return to my view/.test(bannerSrc), "banner button text: Return to my view");
assert(/window\.location\.reload\(\)/.test(bannerSrc), "banner reloads after returning");
assert(/logged to you/.test(bannerSrc), "banner copy includes 'logged to you'");
assert(/You will see and act on the Publication Manager exactly as/.test(modalSrc), "modal confirm copy present");
assert(/applied as them but logged to you/.test(modalSrc), "modal copy: 'applied as them but logged to you'");
assert(/update\(\{\s*viewAs:\s*cwid\s*\}\)|update\(\{\s*viewAs:\s*target\.personIdentifier\s*\}\)/.test(modalSrc), "modal confirm calls update({ viewAs: <cwid> })");
assert(/No active Publication Manager user with that CWID/.test(modalSrc), "modal maps not_found to its inline copy");
assert(/You can't view as another Superuser/.test(modalSrc), "modal maps target_is_superuser to its inline copy");
assert(/canViewAs\s*&&\s*!.*viewAs/.test(sideNavbarSrc), "nav entry gated on session.canViewAs && !session.viewAs");
assert(/ViewAsModal/.test(sideNavbarSrc), "SideNavbar renders ViewAsModal");

// ---------------------------------------------------------------------------------------
console.log("\n9. Cookie size -- representative token vs. the 3900-byte budget:");
{
  const { encode } = await import("next-auth/jwt");
  const SECRET = "0".repeat(64);

  const roleRow = (i, cwid, full) => {
    const base = { personIdentifier: cwid, roleLabel: ["Superuser", "Curator_All", "Curator_Self", "Reporter_All", "Curator_Scoped"][i], roleID: i + 1 };
    return full ? { ...base, scope_person_types: null, scope_org_units: null, proxy_person_ids: null } : base;
  };
  const roles5 = (cwid, full) => JSON.stringify([0, 1, 2, 3, 4].map((i) => roleRow(i, cwid, full)));

  const buildToken = ({ realRoleCount, overlay, overlayShrunk }) => {
    const cwid = "abc1234";
    const realRoles = realRoleCount === 5 ? roles5(cwid, true) : JSON.stringify([roleRow(0, cwid, true)]);
    const databaseUser = {
      userID: 4821, personIdentifier: cwid, nameFirst: "Alex", nameMiddle: null, nameLast: "Robertson",
      email: cwid + "@med.cornell.edu", status: 1,
      createTimestamp: "2024-01-01T00:00:00.000Z", modifyTimestamp: "2026-08-01T00:00:00.000Z",
      scope_person_types: null, scope_org_units: null, proxy_person_ids: null,
    };
    const scopeData = JSON.stringify({ personTypes: null, orgUnits: null });
    const name = "Alex Robertson";
    const token = {
      user: { personIdentifier: cwid, email: databaseUser.email, nameFirst: databaseUser.nameFirst, nameLast: databaseUser.nameLast, databaseUser, userRoles: realRoles },
      username: cwid,
      email: databaseUser.email,
      databaseUser,
      userRoles: realRoles,
      scopeData,
      proxyPersonIds: "[]",
      name,
      picture: null,
      actor: { userID: databaseUser.userID, personIdentifier: cwid, name },
      iat: 1700000000,
      exp: 1700086400,
      jti: "abcdefabcdefabcdefabcdefabcdefab",
    };
    if (overlay) {
      const targetCwid = "xyz9876";
      const targetDbUser = { userID: 5533, personIdentifier: targetCwid, nameFirst: "Ben", nameLast: "Fitzgerald", email: targetCwid + "@med.cornell.edu", status: 1, scope_person_types: null, scope_org_units: null, proxy_person_ids: null };
      token.viewAs = {
        targetCwid,
        startedAt: 1700000000,
        name: "Ben Fitzgerald",
        databaseUser: targetDbUser,
        userRoles: overlayShrunk ? JSON.stringify([0, 1, 2, 3, 4].map((i) => roleRow(i, targetCwid, false))) : roles5(targetCwid, true),
      };
    }
    return token;
  };

  const typical = await encode({ token: buildToken({ realRoleCount: 1, overlay: true, overlayShrunk: true }), secret: SECRET, maxAge: 1800 });
  assert(typical.length < 3900, `typical case (1 real role + 1 overlay target role) JWE fits the budget -- ${typical.length} bytes`);

  const worstFull = await encode({ token: buildToken({ realRoleCount: 5, overlay: true, overlayShrunk: false }), secret: SECRET, maxAge: 1800 });
  const worstShrunk = await encode({ token: buildToken({ realRoleCount: 5, overlay: true, overlayShrunk: true }), secret: SECRET, maxAge: 1800 });
  const worstNoOverlay = await encode({ token: buildToken({ realRoleCount: 5, overlay: false }), secret: SECRET, maxAge: 1800 });
  assert(worstShrunk.length < worstFull.length, `shrinking the overlay's userRoles (roleLabel+personIdentifier only) reduces JWE size -- full=${worstFull.length} shrunk=${worstShrunk.length}`);

  info(`5-role stress case, no overlay at all: ${worstNoOverlay.length} bytes`);
  info(`5-role stress case, full overlay: ${worstFull.length} bytes`);
  info(`5-role stress case, shrunk overlay (production shape): ${worstShrunk.length} bytes`);
  if (worstShrunk.length >= 3900) {
    info(`KNOWN GAP: the 5-simultaneous-role stress case stays over the 3900-byte budget even`);
    info(`after the shrink (${worstShrunk.length} bytes) because the REAL user's own token --`);
    info(`with no viewAs overlay at all -- is already ${worstNoOverlay.length} bytes for 5 roles`);
    info(`(pre-existing duplication: token.user embeds a second copy of databaseUser/userRoles`);
    info(`alongside the top-level token fields; out of this ticket's WRITE SET). Cookie chunking`);
    info(`(section 4 above) is what actually carries this case, same as it already does for a`);
    info(`heavily-permissioned real user today with no impersonation involved.`);
  }
}

// ---------------------------------------------------------------------------------------
console.log("\n10. Search.js -- scope filter applies on initial load and pagination:");
assert(/const applyScopeFilters = \(base\) => \{/.test(searchSrc), "applyScopeFilters helper defined");
assert((searchSrc.match(/const applyScopeFilters = /g) || []).length === 1, "applyScopeFilters defined exactly once");
assert(/let updatedFilters = applyScopeFilters\(filters\);/.test(searchSrc), "toggle effect uses applyScopeFilters(filters)");
assert(/updatedFilters = applyScopeFilters\(updatedFilters\);/.test(searchSrc), "search handler uses applyScopeFilters(updatedFilters)");
assert(/const f = applyScopeFilters\(newCount === 'reset' \? \{\} : filters\);/.test(searchSrc), "fetchPaginatedData computes f via applyScopeFilters (covers the mount call, which passes no args)");
assert(/dispatch\(updateFilters\(f\)\);/.test(searchSrc), "fetchPaginatedData dispatches updateFilters(f) so redux filters carry scope keys thereafter (covers pagination, which reads redux filters directly)");
assert(/identityFetchPaginatedData\(1, count, f\)/.test(searchSrc) && /identityFetchPaginatedData\(page, newCount \? newCount : count, f\)/.test(searchSrc), "fetchPaginatedData passes f (not the stale closed-over filters) to identityFetchPaginatedData");
assert(/const scopeFilterInitRef = useRef\(true\);/.test(searchSrc), "scopeFilterInitRef still present (checkbox effect still skips the initial render)");

// ---------------------------------------------------------------------------------------
console.log("\n11. ViewAs.module.css -- banner flush under the header, app font:");
assert(/\.banner \{[^}]*top:\s*var\(--header-height\);/.test(viewAsCssSrc), ".banner: top: var(--header-height)");
assert(/\.banner \{[^}]*margin:\s*-24px -40px 24px;/.test(viewAsCssSrc), ".banner: negative margins cancel the content column's 24px 40px padding");
assert(/\.banner \{[^}]*font-family:\s*var\(--font-sans\);/.test(viewAsCssSrc), ".banner: font-family: var(--font-sans)");
assert(!/\.banner \{[^}]*border-radius/.test(viewAsCssSrc), ".banner: no border-radius (edge-to-edge strip)");
assert(/\.returnButton \{[^}]*font:\s*inherit;/.test(viewAsCssSrc), ".returnButton: font: inherit");

// ---------------------------------------------------------------------------------------
console.log("\n12. Implicit scope keys never count as \"filters on\" (withoutScopeKeys):");
assert(/export function withoutScopeKeys\(filters: any\)/.test(scopeResolverSrc), "scopeResolver.ts exports withoutScopeKeys");
assert(/const \{ scopeOrgUnits, scopePersonTypes, proxyPersonIds, \.\.\.rest \} = filters \|\| \{\};/.test(scopeResolverSrc), "withoutScopeKeys strips exactly the three scope keys");
assert(/let filtersOn = Object\.keys\(withoutScopeKeys\(filters\)\)\.length !== 0;/.test(searchSrc), "Search.js: filtersOn ignores the scope keys (no empty-state flash on a scoped curator's initial load)");
assert(/fetchPaginatedData\('reset'\)\n/.test(searchSrc.split("fetchAllAdminSettings()")[0]), "Search.js: mount fetch passes 'reset' (no re-hydration of a previous visit's filters from the stale closure)");
assert(/\(!filtersOn && !showScopeFilter && identityPaginatedData\?\.persons\?\.length <= 0\)/.test(searchSrc), "Search.js: empty-means-not-loaded heuristic disabled for scoped curators (a scope matching nobody shows the empty state, not a spinner)");
assert(/\/\/ A search or scope-toggle fetch is in flight: spin regardless of user filters\.\n\s*identityAllFetching\) \{/.test(searchSrc), "Search.js: identityAllFetching spins regardless of filtersOn (scope toggle shows the spinner)");
assert(/disabled: \(Object\.keys\(withoutScopeKeys\(filters\)\)\.length === 0\) && !hasOwnProfile,/.test(sideNavbarSrc), "SideNavbar.tsx: Curate Publications disabled-gate ignores the scope keys");
assert(/import \{ withoutScopeKeys \} from '\.\.\/\.\.\/\.\.\/utils\/scopeResolver';/.test(sideNavbarSrc), "SideNavbar.tsx imports withoutScopeKeys");

// ---------------------------------------------------------------------------------------
console.log(`\n${failures === 0 ? PASS : FAIL} ${passes} passed, ${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
