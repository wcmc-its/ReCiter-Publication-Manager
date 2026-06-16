/**
 * View 1 — System context.
 * Who uses Publication Manager and what it talks to. The one-glance picture.
 *
 * Source: config/local.js (ReCiter + PubMed + ASMS endpoints, headshot URL),
 * src/db/db.ts (MySQL/Sequelize), kubernetes/k8-deployment.yaml (SMTP, env),
 * config/saml.ts + src/pages/api/auth (SAML IdP), README.md.
 */
import { A } from "../lib.mjs";

const nodes = {
  // Actors & identity (left)
  users: { x: 40, y: 120, w: 260, h: 96, kind: "ext", title: "People (browser)",
           sub: ["Librarians · faculty", "Dept curators · reporters"] },
  idp:   { x: 40, y: 300, w: 260, h: 84, kind: "net", title: "SAML Identity Provider",
           sub: ["Institutional SSO (Shibboleth)", "SSO_LOGIN_URL · idp.crt"] },

  // The system (center)
  pm: { x: 500, y: 170, w: 320, h: 184, kind: "app", title: "ReCiter Publication Manager",
        sub: ["Next.js 12 · React 16 app", "Curation UI + reporting UI",
              "API routes proxy ReCiter,", "query ReCiterDB via Sequelize"],
        chip: { tone: "live", text: "on EKS" } },

  // ReCiter back-end (right, top)
  reciter: { x: 1036, y: 118, w: 268, h: 70, kind: "app", title: "ReCiter engine",
             sub: ["Author disambiguation + scoring"], chip: { tone: "ondemand", text: "REST" } },
  pubmed:  { x: 1036, y: 200, w: 268, h: 64, kind: "app", title: "PubMed Retrieval Tool",
             sub: ["/pubmed/query-* (eFetch)"] },

  // Data store (right, middle)
  reciterdb: { x: 1036, y: 320, w: 268, h: 86, kind: "data", title: "ReCiterDB · MySQL",
               sub: ["admin_users · person", "analysis_* · authorship_review"],
               chip: { tone: "nightly", text: "nightly ETL" } },

  // Aux / outbound services (bottom)
  smtp: { x: 420, y: 500, w: 270, h: 62, kind: "net", title: "SMTP server",
          sub: ["nodemailer e-mail notifications"] },
  directory: { x: 712, y: 500, w: 270, h: 62, kind: "net", title: "Directory headshot API",
               sub: ["directory.weill.cornell.edu"] },
  asms: { x: 1004, y: 500, w: 300, h: 62, kind: "net", title: "ASMS usage tracking",
          sub: ["Module-level analytics (optional)"] },
};

const groups = [
  { x: 24, y: 88, w: 292, h: 320, kind: "ext", title: "Actors & identity" },
  { x: 480, y: 132, w: 360, h: 260, kind: "app", title: "System" },
  { x: 1016, y: 88, w: 308, h: 178, kind: "app", title: "ReCiter back-end · Spring Boot" },
  { x: 1016, y: 290, w: 308, h: 126, kind: "data", title: "Reporting data store" },
  { x: 400, y: 470, w: 924, h: 112, kind: "net", title: "Aux / outbound services" },
];

const edges = [
  { p0: A(nodes.users, "r"), p1: A(nodes.pm, "l", 0.3), color: "teal", label: "HTTPS · curate / report" },
  { p0: A(nodes.idp, "r"), p1: A(nodes.pm, "l", 0.78), color: "indigo", label: "SAML SSO" },
  { p0: A(nodes.pm, "r", 0.25), p1: A(nodes.reciter, "l"), color: "teal", label: "feature-generator · goldstandard" },
  { p0: A(nodes.pm, "r", 0.45), p1: A(nodes.pubmed, "l"), color: "teal", label: "PubMed search" },
  { p0: A(nodes.pm, "r", 0.7), p1: A(nodes.reciterdb, "l"), color: "amber", label: "Sequelize read / write" },
  { p0: A(nodes.pm, "b", 0.25), p1: A(nodes.smtp, "t"), color: "maroon", label: "send e-mail" },
  { p0: A(nodes.pm, "b", 0.6), p1: A(nodes.directory, "t"), color: "gray", dash: true, label: "headshots" },
  { p0: A(nodes.pm, "b", 0.92), p1: A(nodes.asms, "t", 0.4), color: "gray", dash: true, label: "usage events" },
];

export const spec = { id: "system-context", vb: [1344, 620], groups, nodes, edges };

export const meta = {
  nav: "① Context",
  kicker: "View 1 · system context",
  heading: "System context — what feeds it, who it serves",
  dot: "#0ca678",
  blurb:
    "<b>People</b> sign in through a <b>SAML</b> identity provider and use Publication Manager to " +
    "curate publications and build reports. The app proxies the <b>ReCiter engine</b> and " +
    "<b>PubMed Retrieval Tool</b> for disambiguation/search, reads and writes the <b>ReCiterDB</b> " +
    "MySQL store via Sequelize, and reaches out to SMTP, a headshot API, and usage tracking.",
  legend: [
    { fill: "#f1f3f5", stroke: "#adb5bd", label: "People / external" },
    { fill: "#e3faf3", stroke: "#0ca678", label: "App / compute" },
    { fill: "#fff4d6", stroke: "#f08c00", label: "Data store" },
    { fill: "#e7ecff", stroke: "#4263eb", label: "Network / service" },
  ],
  edgeLegend: [
    { color: "teal", label: "reads / calls a service" },
    { color: "amber", label: "reads + writes data" },
    { color: "indigo", label: "single sign-on" },
    { color: "maroon", label: "outbound e-mail" },
    { color: "gray", dash: true, label: "auxiliary / optional" },
  ],
  footnote:
    "ReCiterDB is <b>read</b> by Publication Manager but populated by the separate ReCiterDB " +
    "nightly ETL (from ReCiter, PubMed, NIH iCite, Scimago, Altmetric) — so reporting data lags " +
    "curation by up to a day.",
  seeAlso: [
    { id: "app-internals", label: "② internals" },
    { id: "request-flows", label: "③ request flows" },
    { id: "deployment", label: "④ deployment" },
  ],
  source: "config/local.js · src/db/db.ts · config/saml.ts · kubernetes/k8-deployment.yaml · README.md",
};
