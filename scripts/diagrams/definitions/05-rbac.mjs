/**
 * View 5 — Access control (RBAC) model.
 * How roles become per-route permissions: DB roles → getCapabilities() →
 * next-auth JWT → middleware route gating. The role×capability matrix is the table.
 *
 * Source: src/utils/constants.js (allowedPermissions, getCapabilities),
 * src/middleware.ts (ROUTE_PERMISSIONS + /authorships role gate),
 * src/pages/api/auth/[...nextauth].jsx (permission/scope enrichment into the JWT).
 */
import { A } from "../lib.mjs";

const nodes = {
  // resolution pipeline
  rolesDb: { x: 50, y: 110, w: 240, h: 140, kind: "data", title: "admin_users_roles",
             sub: ["7 role labels", "+ baseline (any user)", "+ scope (type / org)"],
             chip: { tone: "ondemand", text: "MySQL" } },
  getcap:  { x: 370, y: 110, w: 255, h: 140, kind: "app", title: "permission resolution",
             sub: ["getCapabilities()", "findUserPermissionsEnriched", "findUserScope (scoped)"] },
  jwt:     { x: 705, y: 110, w: 225, h: 140, kind: "aws", title: "next-auth JWT",
             sub: ["userRoles", "permissions[]", "scopeData"] },
  mw:      { x: 1010, y: 110, w: 280, h: 140, kind: "edge", title: "middleware.ts",
             sub: ["ROUTE_PERMISSIONS", "hasPermission()", "self-only redirects"] },

  // gated page routes
  rCurate: { x: 80,  y: 360, w: 270, h: 66, kind: "net", title: "/curate", sub: ["canCurate"] },
  rReport: { x: 372, y: 360, w: 200, h: 66, kind: "net", title: "/report", sub: ["canReport"] },
  rSearch: { x: 594, y: 360, w: 200, h: 66, kind: "net", title: "/search", sub: ["canSearch"] },
  rUsers:  { x: 816, y: 360, w: 290, h: 66, kind: "net", title: "/manageusers", sub: ["canManageUsers"] },
  rConfig: { x: 80,  y: 450, w: 270, h: 66, kind: "net", title: "/configuration", sub: ["canConfigure"] },
  rNotif:  { x: 372, y: 450, w: 270, h: 66, kind: "net", title: "/notifications", sub: ["canManageNotifications"] },
  rProfile:{ x: 664, y: 450, w: 270, h: 66, kind: "net", title: "/manageprofile", sub: ["canManageProfile"] },
  rAuthorships: { x: 956, y: 450, w: 300, h: 66, kind: "open", title: "/authorships",
                  sub: ["role: Superuser / Curator_All"] },
};

const groups = [
  { x: 34, y: 80, w: 1272, h: 190, kind: "aws", title: "Resolution: role → permission → token → gate" },
  { x: 50, y: 320, w: 1240, h: 230, kind: "net", title: "Gated page routes (config.matcher)" },
];

const edges = [
  { p0: A(nodes.rolesDb, "r"), p1: A(nodes.getcap, "l"), route: "straight", color: "amber", label: "load roles + scope" },
  { p0: A(nodes.getcap, "r"), p1: A(nodes.jwt, "l"), route: "straight", color: "green", label: "embed in token" },
  { p0: A(nodes.jwt, "r"), p1: A(nodes.mw, "l"), route: "straight", color: "indigo", label: "decode per request" },
  { p0: A(nodes.mw, "b", 0.3), p1: A(nodes.rUsers, "t", 0.5), color: "indigo", label: "allow / 302 redirect" },
  { p0: A(nodes.mw, "b", 0.72), p1: A(nodes.rAuthorships, "t", 0.5), color: "red", dash: true, label: "role gate (not perm)" },
];

export const spec = { id: "rbac", vb: [1340, 600], groups, nodes, edges };

export const meta = {
  nav: "⑤ RBAC",
  kicker: "View 5 · access control",
  heading: "Roles → permissions → gated routes",
  dot: "#7d1c1c",
  blurb:
    "At sign-in, a user's <b>roles</b> (and curation scope) are read from <code>admin_users_roles</code>, " +
    "turned into capabilities by <code>getCapabilities()</code> / the data-driven permission tables, and " +
    "embedded in the <b>next-auth JWT</b>. On every gated navigation, <b>middleware.ts</b> decodes that token " +
    "and checks the route's required permission via <code>ROUTE_PERMISSIONS</code>, redirecting to the user's " +
    "landing page when it's missing. <code>/authorships</code> is the exception — gated directly by role " +
    "(Superuser or Curator_All), not by a permission flag.",
  legend: [
    { fill: "#fff4d6", stroke: "#f08c00", label: "Role store" },
    { fill: "#e3faf3", stroke: "#0ca678", label: "Resolution logic" },
    { fill: "#f0ebff", stroke: "#7048e8", label: "Session token" },
    { fill: "#e7ecff", stroke: "#4263eb", label: "Gated route" },
    { fill: "#fff0f0", stroke: "#e03131", label: "Role-gated (special)" },
  ],
  edgeLegend: [
    { color: "amber", label: "read roles" },
    { color: "green", label: "resolve capabilities" },
    { color: "indigo", label: "decode / enforce" },
    { color: "red", dash: true, label: "role-only gate" },
  ],
  extraHtml:
    '<div class="legtitle">Role → capability matrix (src/utils/constants.js)</div>' +
    '<table class="env"><thead><tr>' +
    '<th>Role</th><th>Curate</th><th>Report</th><th>Search</th><th>Manage&nbsp;users</th><th>Configure</th>' +
    '</tr></thead><tbody>' +
    '<tr><td class="k">Superuser</td><td>all</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>' +
    '<tr><td class="k">Curator_All</td><td>all</td><td>–</td><td>✓</td><td>–</td><td>–</td></tr>' +
    '<tr><td class="k">Curator_Self</td><td>self</td><td>–</td><td>–</td><td>–</td><td>–</td></tr>' +
    '<tr><td class="k">Curator_Scoped</td><td>scoped</td><td>–</td><td>✓</td><td>–</td><td>–</td></tr>' +
    '<tr><td class="k">Reporter_All</td><td>–</td><td>✓</td><td>✓</td><td>–</td><td>–</td></tr>' +
    '</tbody></table>',
  footnote:
    "Baseline: every authenticated user gets <b>canReport + canSearch</b> even with no role. " +
    "<code>Curator_Department</code> / <code>Curator_Department_Delegate</code> and the " +
    "<code>canManageNotifications</code> / <code>canManageProfile</code> permissions are resolved from the " +
    "data-driven permission tables, not the static map above. Multiple roles union (OR) their capabilities.",
  seeAlso: [
    { id: "app-internals", label: "② internals" },
    { id: "request-flows", label: "③ request flows" },
  ],
  source: "src/utils/constants.js · src/middleware.ts · src/pages/api/auth/[...nextauth].jsx",
};
