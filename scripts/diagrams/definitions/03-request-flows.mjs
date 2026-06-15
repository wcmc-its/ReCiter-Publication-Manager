/**
 * View 3 — Request & data flows.
 * The three core journeys as left-to-right lanes: sign-in, curate, report.
 *
 * Source: src/pages/api/auth (saml-acs, [...nextauth]), controllers/authentication.controller.ts,
 * controllers/featuregenerator.controller.ts + config/local.js (feature-generator params),
 * controllers/db/reports/** + src/db/models (analysis_* reporting tables).
 */
import { A } from "../lib.mjs";

const nodes = {
  // ① Sign-in (SAML SSO)
  a_browser: { x: 44,   y: 118, w: 150, h: 72, kind: "ext", title: "Browser", sub: ["GET /login"] },
  a_idp:     { x: 240,  y: 118, w: 170, h: 72, kind: "net", title: "SAML IdP", sub: ["SSO_LOGIN_URL"] },
  a_acs:     { x: 456,  y: 118, w: 180, h: 72, kind: "app", title: "saml-acs.js", sub: ["wrap → CSRF form"] },
  a_cb:      { x: 682,  y: 118, w: 205, h: 72, kind: "app", title: "next-auth callback", sub: ["saml2-js verifies"] },
  a_match:   { x: 933,  y: 118, w: 195, h: 72, kind: "app", title: "authentication.ctrl", sub: ["match admin_users"] },
  a_jwt:     { x: 1174, y: 118, w: 150, h: 72, kind: "aws", title: "JWT session", sub: ["cookie issued"] },

  // ② Curate publications
  b_browser: { x: 44,   y: 348, w: 150, h: 80, kind: "ext", title: "Browser", sub: ["/curate/[uid]"] },
  b_api:     { x: 240,  y: 348, w: 180, h: 80, kind: "app", title: "/api/reciter/", sub: ["feature-generator/[uid]"] },
  b_ctrl:    { x: 466,  y: 348, w: 190, h: 80, kind: "app", title: "featuregenerator.ctrl", sub: ["getPublications()"] },
  b_reciter: { x: 702,  y: 348, w: 190, h: 80, kind: "ext", title: "ReCiter engine",
               sub: ["by/uid · AS_EVIDENCE", "score≥30"], chip: { tone: "ondemand", text: "api-key" } },
  b_merge:   { x: 938,  y: 348, w: 170, h: 80, kind: "app", title: "merge pending", sub: ["user feedback"] },
  b_out:     { x: 1154, y: 348, w: 170, h: 80, kind: "data", title: "Curation buckets",
               sub: ["Suggested · Accepted", "· Rejected"] },

  // ③ Report & export
  c_browser: { x: 44,   y: 578, w: 150, h: 80, kind: "ext", title: "Browser", sub: ["/report"] },
  c_api:     { x: 240,  y: 578, w: 180, h: 80, kind: "app", title: "/api/db/reports", sub: ["filter · publication"] },
  c_ctrl:    { x: 466,  y: 578, w: 190, h: 80, kind: "app", title: "report controllers", sub: ["filter · publication", "· bibliometric"] },
  c_orm:     { x: 702,  y: 578, w: 170, h: 80, kind: "app", title: "Sequelize", sub: ["src/db models"] },
  c_db:      { x: 918,  y: 578, w: 190, h: 80, kind: "data", title: "ReCiterDB",
               sub: ["analysis_* (reporting)", "nightly snapshot"], chip: { tone: "nightly", text: "nightly" } },
  c_files:   { x: 1154, y: 578, w: 170, h: 80, kind: "data", title: "Export files", sub: ["CSV · RTF", "· bibliometric"] },
};

const groups = [
  { x: 24, y: 70,  w: 1312, h: 190, kind: "net",  title: "① Sign-in (SAML SSO)" },
  { x: 24, y: 300, w: 1312, h: 190, kind: "app",  title: "② Curate publications" },
  { x: 24, y: 530, w: 1312, h: 190, kind: "data", title: "③ Report & export" },
];

const S = "straight";
const edges = [
  // ① auth chain
  { p0: A(nodes.a_browser, "r"), p1: A(nodes.a_idp, "l"), route: S, color: "indigo", label: "302 redirect" },
  { p0: A(nodes.a_idp, "r"), p1: A(nodes.a_acs, "l"), route: S, color: "indigo", label: "SAMLResponse POST" },
  { p0: A(nodes.a_acs, "r"), p1: A(nodes.a_cb, "l"), route: S, color: "gray", label: "auto-submit" },
  { p0: A(nodes.a_cb, "r"), p1: A(nodes.a_match, "l"), route: S, color: "gray", label: "assertion ok" },
  { p0: A(nodes.a_match, "r"), p1: A(nodes.a_jwt, "l"), route: S, color: "green", label: "roles + perms" },

  // ② curate chain
  { p0: A(nodes.b_browser, "r"), p1: A(nodes.b_api, "l"), route: S, color: "teal", label: "open person" },
  { p0: A(nodes.b_api, "r"), p1: A(nodes.b_ctrl, "l"), route: S, color: "gray", label: "getPublications" },
  { p0: A(nodes.b_ctrl, "r"), p1: A(nodes.b_reciter, "l"), route: S, color: "teal", label: "GET by/uid" },
  { p0: A(nodes.b_reciter, "r"), p1: A(nodes.b_merge, "l"), route: S, color: "teal", label: "candidates" },
  { p0: A(nodes.b_merge, "r"), p1: A(nodes.b_out, "l"), route: S, color: "amber", label: "render" },
  // curate writeback (routed below the lane)
  { p0: A(nodes.b_browser, "b", 0.5), p1: A(nodes.b_reciter, "b", 0.5),
    points: [{ x: 119, y: 472 }, { x: 797, y: 472 }], color: "maroon", dash: true,
    lp: { x: 458, y: 472 }, label: "accept / reject → /goldstandard" },

  // ③ report chain
  { p0: A(nodes.c_browser, "r"), p1: A(nodes.c_api, "l"), route: S, color: "teal", label: "search / filter" },
  { p0: A(nodes.c_api, "r"), p1: A(nodes.c_ctrl, "l"), route: S, color: "gray", label: "query" },
  { p0: A(nodes.c_ctrl, "r"), p1: A(nodes.c_orm, "l"), route: S, color: "gray", label: "build query" },
  { p0: A(nodes.c_orm, "r"), p1: A(nodes.c_db, "l"), route: S, color: "amber", label: "SQL" },
  { p0: A(nodes.c_db, "r"), p1: A(nodes.c_files, "l"), route: S, color: "amber", label: "rows → file" },
];

export const spec = { id: "request-flows", vb: [1360, 760], groups, nodes, edges };

export const meta = {
  nav: "③ Flows",
  kicker: "View 3 · request & data flows",
  heading: "Three core journeys",
  dot: "#7048e8",
  blurb:
    "<b>① Sign-in:</b> the IdP posts a SAML response to <code>saml-acs</code>, which auto-submits to the " +
    "next-auth callback; <code>saml2-js</code> verifies it, the user is matched in <code>admin_users</code>, " +
    "and a JWT session is issued. <b>② Curate:</b> the curate page calls the ReCiter feature-generator " +
    "(<code>by/uid</code>, score≥30), pending feedback is merged, and publications land in Suggested / " +
    "Accepted / Rejected; accept/reject writes back to ReCiter goldstandard. <b>③ Report:</b> reports read " +
    "the nightly <code>analysis_*</code> tables via Sequelize and render CSV / RTF / bibliometric files.",
  legend: [
    { fill: "#f1f3f5", stroke: "#adb5bd", label: "Browser / external" },
    { fill: "#e3faf3", stroke: "#0ca678", label: "App route / controller" },
    { fill: "#fff4d6", stroke: "#f08c00", label: "Data / output" },
    { fill: "#f0ebff", stroke: "#7048e8", label: "Session token" },
  ],
  edgeLegend: [
    { color: "indigo", label: "redirect / SAML" },
    { color: "teal", label: "call ReCiter / fetch" },
    { color: "amber", label: "data read / write" },
    { color: "maroon", dash: true, label: "feedback write-back" },
  ],
  footnote:
    "Curation hits ReCiter live; reporting reads ReCiterDB's <b>nightly</b> snapshot — so a publication " +
    "accepted today appears in reports the next morning.",
  seeAlso: [
    { id: "system-context", label: "① context" },
    { id: "app-internals", label: "② internals" },
    { id: "rbac", label: "⑤ RBAC" },
  ],
  source: "src/pages/api/auth/** · controllers/authentication.controller.ts · controllers/featuregenerator.controller.ts · controllers/db/reports/** · config/local.js",
};
