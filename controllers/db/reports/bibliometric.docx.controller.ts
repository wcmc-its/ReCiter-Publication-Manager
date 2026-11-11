// Bibliometric analysis .docx for one person (5h B2). Replaces the generateBibliometricReport RTF
// stored procedure: the rows come from analysis_summary_author x analysis_summary_article (plus
// analysis_summary_person for ranked faculty), the metrics from bibliometrics.ts and the document
// from bibliometricDocx.ts. Raw SQL only: no Sequelize associations (see reportAssociations.ts).
import sequelize from "../../../src/db/db";
import type { BiblioWork, PeerPerson } from "./bibliometrics";
import { buildBibliometricDocx, docxFileName, listedPmids } from "./bibliometricDocx";
import { loadArticles } from "./word.report.controller";

export class BibliometricExportError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type BibliometricExportResult = {
  buffer: Buffer;
  fileName: string;
  counted: number;
  external: number;
  peerShown: boolean;
};

/** Same character set as identity uids; the value only ever travels as a replacement. */
export const UID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
/** Refuse absurd inputs before loading them (the largest person on dev has 2,033 rows). */
export const MAX_WORKS = 10000;

const q = async (sql: string, replacements: Record<string, unknown>): Promise<any[]> => {
  const [rows] = await sequelize.query(sql, { replacements, raw: true });
  return rows as any[];
};

// Optional analysis_summary_article columns this document reads: v1.6 source_type, v3.7 pubType /
// pubTypeGroup / pubTypeCounted / pubDate / publisher, v3.10 peerReviewed. Probed separately from
// reportColumns.ts so the report search's result rows don't change. Re-probed every 10 minutes
// while any is missing, so a pod started before a ReCiterDB DDL picks the column up.
const OPTIONAL = ["source_type", "pubType", "pubTypeGroup", "pubTypeCounted", "pubDate", "publisher", "peerReviewed"] as const;
type Optional = (typeof OPTIONAL)[number];
const RECHECK_MS = 10 * 60 * 1000;
let probe: { at: number; complete: boolean; cols: Set<Optional> } | null = null;

const optionalColumns = async (): Promise<Set<Optional>> => {
  if (probe && (probe.complete || Date.now() - probe.at < RECHECK_MS)) return probe.cols;
  try {
    const rows = await q(
      "SELECT column_name AS name FROM information_schema.columns " +
        "WHERE table_schema = DATABASE() AND table_name = 'analysis_summary_article' AND column_name IN (:cols)",
      { cols: [...OPTIONAL] }
    );
    const names = new Set(rows.map((r) => String(r.name ?? r.NAME ?? r.COLUMN_NAME).toLowerCase()));
    const cols = new Set(OPTIONAL.filter((c) => names.has(c.toLowerCase())));
    probe = { at: Date.now(), complete: cols.size === OPTIONAL.length, cols };
    return cols;
  } catch (e) {
    console.log("[bibliometric] column probe failed", (e as Error)?.message);
    return new Set();
  }
};

const worksSql = (cols: Set<Optional>): string => {
  const sel = [
    "asu.authorPosition",
    "asa.pmid",
    "asa.publicationTypeCanonical",
    "asa.publicationTypeNIH",
    "asa.articleYear",
    "asa.datePublicationAddedToEntrez",
    "asa.journalTitleVerbose",
    "asa.journalImpactScore1",
    "asa.citationCountNIH",
    "asa.citationCountScopus",
    "asa.relativeCitationRatioNIH",
    "asa.percentileNIH",
  ];
  if (cols.has("source_type")) sel.push("asa.source_type AS sourceType");
  if (cols.has("pubType")) sel.push("asa.pubType");
  if (cols.has("pubTypeGroup")) sel.push("asa.pubTypeGroup");
  if (cols.has("pubTypeCounted")) sel.push("asa.pubTypeCounted");
  if (cols.has("pubDate")) sel.push("DATE_FORMAT(asa.pubDate, '%Y-%m-%d') AS pubDate");
  if (cols.has("publisher")) sel.push("asa.publisher");
  if (cols.has("peerReviewed")) sel.push("asa.peerReviewed");
  return (
    `SELECT ${sel.join(", ")} FROM analysis_summary_author asu ` +
    "JOIN analysis_summary_article asa ON asa.pmid = asu.pmid " +
    "WHERE asu.personIdentifier = :uid ORDER BY asu.id"
  );
};

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Latest completed table swap of the reciterdb nightly, or null when the log can't be read. */
const dataAsOf = async (): Promise<string | null> => {
  try {
    const rows = await q(
      "SELECT DATE_FORMAT(MAX(created_at), '%Y-%m-%d') AS d FROM analysis_job_log WHERE step LIKE '7.%' AND status = 'DONE'",
      {}
    );
    return rows[0]?.d ? String(rows[0].d) : null;
  } catch (e) {
    console.log("[bibliometric] analysis_job_log lookup failed", (e as Error)?.message);
    return null;
  }
};

export const generateBibliometricDocx = async (
  rawUid: unknown,
  opts: { runDate?: string } = {}
): Promise<BibliometricExportResult> => {
  const uid = typeof rawUid === "string" ? rawUid.trim() : "";
  if (!UID_PATTERN.test(uid)) throw new BibliometricExportError(400, "Choose one person to run a bibliometric analysis.");
  const started = Date.now();
  const runDate = opts.runDate || new Date().toISOString().slice(0, 10);

  const n = Number((await q("SELECT COUNT(*) AS n FROM analysis_summary_author WHERE personIdentifier = :uid", { uid }))[0]?.n || 0);
  if (n === 0) throw new BibliometricExportError(404, `No accepted publications for ${uid}.`);
  if (n > MAX_WORKS) throw new BibliometricExportError(422, `${uid} has ${n.toLocaleString("en-US")} publications, more than this report handles (${MAX_WORKS.toLocaleString("en-US")}).`);

  const cols = await optionalColumns();
  const [personRows, rankedRows, workRows, asOf] = await Promise.all([
    q("SELECT firstName, lastName, primaryOrganizationalUnit FROM person WHERE personIdentifier = :uid LIMIT 1", { uid }),
    q("SELECT * FROM analysis_summary_person WHERE personIdentifier = :uid LIMIT 1", { uid }),
    q(worksSql(cols), { uid }),
    dataAsOf(),
  ]);

  // One row per work (a person never has two author rows for a pmid today; guard anyway).
  const seen = new Set<number>();
  const works: BiblioWork[] = [];
  for (const r of workRows) {
    const pmid = Number(r.pmid);
    if (seen.has(pmid)) continue;
    seen.add(pmid);
    works.push({
      ...r,
      pmid,
      articleYear: toNum(r.articleYear),
      journalImpactScore1: toNum(r.journalImpactScore1),
      citationCountNIH: toNum(r.citationCountNIH),
      citationCountScopus: toNum(r.citationCountScopus),
      relativeCitationRatioNIH: toNum(r.relativeCitationRatioNIH),
      percentileNIH: toNum(r.percentileNIH),
      ...(cols.has("pubTypeCounted") ? { pubTypeCounted: toNum(r.pubTypeCounted) } : {}),
      ...(cols.has("peerReviewed") ? { peerReviewed: toNum(r.peerReviewed) } : {}),
    });
  }

  const ranked: PeerPerson | null = rankedRows[0] || null;
  const p = personRows[0] || {};
  const person = {
    firstName: p.firstName ?? ranked?.nameFirst ?? null,
    lastName: p.lastName ?? ranked?.nameLast ?? null,
    department: p.primaryOrganizationalUnit ?? (ranked?.department as string) ?? null,
  };
  const articles = new Map((await loadArticles(listedPmids(works, runDate))).map((a) => [a.pmid, a]));

  const out = await buildBibliometricDocx({
    uid,
    person,
    ranked,
    works,
    articles,
    hasPeerReviewed: cols.has("peerReviewed"),
    runDate,
    dataAsOf: asOf,
  });
  if (out.counted === 0) throw new BibliometricExportError(404, `No accepted publications for ${uid}.`);
  console.log(`[bibliometric] uid=${uid} works=${works.length} counted=${out.counted} ms=${Date.now() - started} bytes=${out.buffer.length}`);
  return { buffer: out.buffer, fileName: docxFileName(uid, runDate), counted: out.counted, external: out.external, peerShown: out.peerShown };
};

export type BibliometricAvailability = { show: boolean; works: number; name: string | null };

/**
 * Cheap check behind the Profile drawer button and the Reports dialog (5h B3): anyone with an
 * accepted publication in analysis_summary_author can run the analysis (the old RTF needed an
 * analysis_summary_person row, ranked full-time faculty only). `works` is that row count, which
 * includes the few errata the document itself leaves out.
 */
export const bibliometricAvailability = async (rawUid: unknown): Promise<BibliometricAvailability> => {
  const uid = typeof rawUid === "string" ? rawUid.trim() : "";
  if (!UID_PATTERN.test(uid)) throw new BibliometricExportError(400, "Choose one person to run a bibliometric analysis.");
  const [countRows, personRows] = await Promise.all([
    q("SELECT COUNT(*) AS n FROM analysis_summary_author WHERE personIdentifier = :uid", { uid }),
    q("SELECT firstName, lastName FROM person WHERE personIdentifier = :uid LIMIT 1", { uid }),
  ]);
  const works = Number(countRows[0]?.n || 0);
  const p = personRows[0];
  const name = p ? [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || null : null;
  return { show: works > 0, works, name };
};
