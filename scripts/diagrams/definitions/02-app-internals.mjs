/**
 * View 2 — Application internals (C4-ish container view).
 * Inside the one Next.js container: browser → middleware → API routes →
 * controllers → data layer / external targets.
 *
 * Source: src/pages (pages + api), src/middleware.ts, controllers/**,
 * src/db/db.ts + src/db/models, src/redux, package.json (pinned versions).
 */
import { A } from "../lib.mjs";

const nodes = {
  // Browser (client)
  pages: { x: 40, y: 96, w: 216, h: 130, kind: "net", title: "Pages (pages router)",
           sub: ["/curate /report /search", "/authorships /admin", "/configuration ..."] },
  redux: { x: 40, y: 250, w: 216, h: 86, kind: "net", title: "Redux store",
           sub: ["actions · reducers", "react-query cache"] },
  components: { x: 40, y: 360, w: 216, h: 70, kind: "net", title: "Components · hooks",
                sub: ["MUI 5 · Bootstrap 5"] },

  // Edge
  middleware: { x: 328, y: 110, w: 168, h: 80, kind: "edge", title: "middleware.ts",
                sub: ["decode next-auth JWT", "route → permission", "self-only redirects"] },

  // API routes (pages/api)
  apiAuth:   { x: 564, y: 110, w: 230, h: 86, kind: "app", title: "/api/auth/*",
               sub: ["next-auth 3 + saml2-js 3", "saml-acs · callback"] },
  apiReciter:{ x: 564, y: 220, w: 230, h: 86, kind: "app", title: "/api/reciter/*",
               sub: ["proxy to ReCiter engine", "feature-gen · feedback"] },
  apiDb:     { x: 564, y: 330, w: 230, h: 86, kind: "app", title: "/api/db/*",
               sub: ["admin · authorships", "reports · users"] },
  apiNotif:  { x: 564, y: 440, w: 230, h: 70, kind: "app", title: "/api/notification",
               sub: ["nodemailer trigger"] },
  apiHealth: { x: 564, y: 540, w: 230, h: 58, kind: "app", title: "/api/healthcheck · /log" },

  // Controllers
  ctrlAuth:   { x: 866, y: 110, w: 230, h: 86, kind: "app", title: "authentication.controller",
                sub: ["SAML assert → match user", "find/create admin_users"] },
  ctrlReciter:{ x: 866, y: 220, w: 230, h: 86, kind: "app", title: "ReCiter controllers",
                sub: ["featuregenerator · pubmed", "goldstandard · userfeedback"] },
  ctrlDb:     { x: 866, y: 330, w: 230, h: 96, kind: "app", title: "DB controllers",
                sub: ["authorships · person · reports", "admin.users · userroles"] },
  ctrlNotif:  { x: 866, y: 448, w: 230, h: 70, kind: "app", title: "notifications controller",
                sub: ["build + send e-mail"] },
  reportgen:  { x: 866, y: 540, w: 230, h: 70, kind: "app", title: "Report builders",
                sub: ["exceljs (CSV) · handlebars (RTF)"] },

  // Data layer & external targets
  reciterApi2:{ x: 1166, y: 110, w: 234, h: 72, kind: "ext", title: "ReCiter / PubMed APIs",
                sub: ["external REST"], chip: { tone: "ondemand", text: "ext" } },
  dbLayer:    { x: 1166, y: 300, w: 234, h: 96, kind: "data", title: "src/db (Sequelize 6)",
                sub: ["db.ts — MySQL pool (max 20)", "~40 models · init-models"] },
  reciterdb2: { x: 1166, y: 430, w: 234, h: 66, kind: "data", title: "ReCiterDB · MySQL",
                sub: ["external store"], chip: { tone: "ondemand", text: "ext" } },
  smtp2:      { x: 1166, y: 520, w: 234, h: 62, kind: "ext", title: "SMTP server",
                sub: ["external"] },
};

const groups = [
  { x: 24, y: 80, w: 248, h: 372, kind: "net", title: "Browser (client)" },
  { x: 312, y: 80, w: 200, h: 160, kind: "edge", title: "Edge" },
  { x: 548, y: 80, w: 262, h: 540, kind: "app", title: "API routes · pages/api" },
  { x: 850, y: 80, w: 262, h: 540, kind: "app", title: "Controllers" },
  { x: 1150, y: 80, w: 266, h: 540, kind: "data", title: "Data layer & targets" },
];

const edges = [
  // client ↔ edge
  { p0: A(nodes.pages, "r", 0.4), p1: A(nodes.middleware, "l", 0.4), color: "indigo", label: "gated nav" },
  { p0: A(nodes.apiAuth, "l", 0.5), p1: A(nodes.middleware, "r", 0.55), color: "indigo", dash: true, label: "issues JWT cookie" },
  { p0: A(nodes.pages, "b", 0.2), p1: A(nodes.redux, "t", 0.5), color: "teal", label: "UI state" },
  // client → api (XHR) — exit pages' right edge below the (shortened) middleware box
  { p0: A(nodes.pages, "r", 0.9), p1: A(nodes.apiReciter, "l", 0.4), color: "teal", label: "fetch (XHR)" },
  { p0: A(nodes.pages, "r", 0.99), p1: A(nodes.apiDb, "l", 0.3), color: "amber", dash: true, label: "fetch (report/admin)" },
  // api → controllers
  { p0: A(nodes.apiAuth, "r", 0.5), p1: A(nodes.ctrlAuth, "l", 0.5), color: "gray", label: "delegate" },
  { p0: A(nodes.apiReciter, "r", 0.5), p1: A(nodes.ctrlReciter, "l", 0.5), color: "gray", label: "delegate" },
  { p0: A(nodes.apiDb, "r", 0.5), p1: A(nodes.ctrlDb, "l", 0.4), color: "gray", label: "delegate" },
  { p0: A(nodes.apiNotif, "r", 0.5), p1: A(nodes.ctrlNotif, "l", 0.5), color: "gray", label: "delegate" },
  // controllers → data / targets
  { p0: A(nodes.ctrlReciter, "r", 0.5), p1: A(nodes.reciterApi2, "l", 0.6), color: "teal", label: "REST + api-key" },
  { p0: A(nodes.ctrlAuth, "r", 0.5), p1: A(nodes.dbLayer, "l", 0.2), color: "gray", dash: true, label: "find / create user" },
  { p0: A(nodes.ctrlDb, "r", 0.5), p1: A(nodes.dbLayer, "l", 0.7), color: "amber", label: "ORM queries" },
  { p0: A(nodes.ctrlNotif, "r", 0.5), p1: A(nodes.smtp2, "l", 0.5), color: "maroon", label: "SMTP" },
  { p0: A(nodes.ctrlDb, "l", 0.85), p1: A(nodes.reportgen, "l", 0.3), color: "gray",
    points: [{ x: 836, y: 412 }, { x: 836, y: 561 }], lp: { x: 836, y: 487 }, label: "rows → file" },
  // data layer → store
  { p0: A(nodes.dbLayer, "b", 0.5), p1: A(nodes.reciterdb2, "t", 0.5), color: "amber", label: "SQL (mysql2)" },
];

export const spec = { id: "app-internals", vb: [1440, 700], groups, nodes, edges };

export const meta = {
  nav: "② Internals",
  kicker: "View 2 · container internals (C4)",
  heading: "Inside the Next.js container",
  dot: "#0ca678",
  blurb:
    "One container, five layers. The <b>browser</b> (React pages + Redux) hits Next.js. " +
    "<b>middleware.ts</b> decodes the next-auth JWT and gates page routes. <b>API routes</b> under " +
    "<code>pages/api</code> delegate to <b>controllers</b> that either proxy the ReCiter/PubMed REST " +
    "APIs or query <b>ReCiterDB</b> through the Sequelize <b>data layer</b>. Reports are built in-process " +
    "with exceljs and handlebars.",
  legend: [
    { fill: "#e7ecff", stroke: "#4263eb", label: "Browser / client" },
    { fill: "#fbeaea", stroke: "#7d1c1c", label: "Edge middleware" },
    { fill: "#e3faf3", stroke: "#0ca678", label: "Server (routes / controllers)" },
    { fill: "#fff4d6", stroke: "#f08c00", label: "Data layer" },
    { fill: "#f1f3f5", stroke: "#adb5bd", label: "External target" },
  ],
  edgeLegend: [
    { color: "indigo", label: "auth / route guard" },
    { color: "teal", label: "call / fetch" },
    { color: "amber", label: "data read / write" },
    { color: "maroon", label: "outbound e-mail" },
    { color: "gray", label: "in-process delegation" },
  ],
  footnote:
    "Versions reflect <code>package.json</code> (the deployed image), <b>not</b> the README stack " +
    "table — the app is pinned to Next.js 12, React 16, next-auth 3, saml2-js 3, and Sequelize 6.",
  seeAlso: [
    { id: "system-context", label: "① context" },
    { id: "request-flows", label: "③ request flows" },
    { id: "rbac", label: "⑤ RBAC" },
  ],
  source: "src/pages/** · src/middleware.ts · controllers/** · src/db/db.ts · src/redux · package.json",
};
