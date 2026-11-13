// Bibliometric report v2 .docx for one person (5h P4). Reads the v3.11 flags ReCiterDB's nightly
// writes (analysis_summary_article / analysis_summary_author) and the cohort cells
// (analysis_summary_person_peer); the measures come from bibliometrics.ts, the summary from
// bibliometricSummary.ts, the charts from biblioCharts.ts and the document from
// bibliometricDocx.ts. Raw SQL only: no Sequelize associations (see reportAssociations.ts).
//
// The v1 RTF (bibliometric.controller.ts, CALL generateBibliometricReport) is untouched; the UI
// calls this controller only while the P5 flag (bibliometricReportVersion) is "docx".
import sequelize from "../../../src/db/db";
import { type PeerCellRow, flag, isCounted } from "./bibliometrics";
import {
  buildBibliometricDocx,
  docxFileName,
  flagsFilled,
  listedPmids,
  missingV2Schema,
  rankFromPersonTypes,
  toNum,
  toWorks,
  REQUIRED_V2,
} from "./bibliometricDocx";
import { loadArticles } from "./word.report.controller";
import { type BibliometricVersion, BIBLIOMETRIC_SETTING, parseBibliometricVersion } from "./bibliometricVersion";

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
export const V2_UNAVAILABLE = "Bibliometric v2 data not available yet";

const q = async (sql: string, replacements: Record<string, unknown>): Promise<any[]> => {
  const [rows] = await sequelize.query(sql, { replacements, raw: true });
  return rows as any[];
};

// Re-probed every 10 minutes while anything is missing, so a pod started before the v3.11 DDL picks
// the columns up without a restart. Once complete, the answer is kept.
const RECHECK_MS = 10 * 60 * 1000;
let probe: { at: number; missing: string[] } | null = null;

const v2SchemaMissing = async (): Promise<string[]> => {
  if (probe && (probe.missing.length === 0 || Date.now() - probe.at < RECHECK_MS)) return probe.missing;
  const rows = await q(
    "SELECT table_name AS t, column_name AS c FROM information_schema.columns " +
      "WHERE table_schema = DATABASE() AND table_name IN (:tables)",
    { tables: Object.keys(REQUIRED_V2) }
  );
  const missing = missingV2Schema(rows.map((r) => ({ table: r.t ?? r.TABLE_NAME, column: r.c ?? r.COLUMN_NAME })));
  probe = { at: Date.now(), missing };
  return missing;
};

const WORKS_SQL =
  "SELECT asu.authorRoleV2, asu.soleAuthor, asa.pmid, asa.source_type AS sourceType, asa.pubTypeCounted, " +
  "asa.publicationTypeCanonical, DATE_FORMAT(asa.pubDate, '%Y-%m-%d') AS pubDate, asa.articleYear, " +
  "asa.datePublicationAddedToEntrez, asa.articleTitle, asa.journalTitleVerbose, asa.issn, " +
  "asa.citationCountNIH, asa.relativeCitationRatioNIH, asa.percentileNIH, CAST(asa.pctExact AS CHAR) AS pctExact, " +
  "asa.provisionalNIH, asa.hasPercentileNIH, asa.researchArticleV2, asa.ratedV2, asa.recentV2, " +
  "(SELECT MAX(pa.journalTitleISOabbreviation) FROM person_article pa " +
  " WHERE pa.personIdentifier = asu.personIdentifier AND pa.pmid = asu.pmid) AS journalTitleISOabbreviation " +
  "FROM analysis_summary_author asu JOIN analysis_summary_article asa ON asa.pmid = asu.pmid " +
  "WHERE asu.personIdentifier = :uid ORDER BY asu.id";

const PEER_SQL =
  "SELECT personIdentifier, facultyRank, cohortEligible, roleSet, topN, ratedCount, recentCount, " +
  "CAST(avgTop AS CHAR) AS avgTop, cohortRank, cohortM, DATE_FORMAT(runDate, '%Y-%m-%d') AS runDate, " +
  "DATE_FORMAT(iciteLoadedAt, '%Y-%m-%d') AS iciteLoadedAt " +
  "FROM analysis_summary_person_peer WHERE personIdentifier = :uid";

/** Date of the latest completed table swap of the reciterdb nightly, or null when the log can't
 *  be read. */
const dataAsOf = async (): Promise<string | null> => {
  try {
    const rows = await q(
      "SELECT DATE_FORMAT(MAX(created_at), '%Y-%m-%d') AS d FROM analysis_job_log WHERE step LIKE '7.%' AND status = 'DONE'",
      {}
    );
    return rows[0]?.d ? String(rows[0].d) : null;
  } catch (e) {
    console.log("[bibliometric v2] analysis_job_log lookup failed", (e as Error)?.message);
    return null;
  }
};

const parseUid = (rawUid: unknown): string => {
  const uid = typeof rawUid === "string" ? rawUid.trim() : "";
  if (!UID_PATTERN.test(uid)) throw new BibliometricExportError(400, "Choose one person to run a bibliometric analysis.");
  return uid;
};

const requireV2 = async (): Promise<void> => {
  let missing: string[];
  try {
    missing = await v2SchemaMissing();
  } catch (e) {
    console.log("[bibliometric v2] column probe failed", (e as Error)?.message);
    throw new BibliometricExportError(503, V2_UNAVAILABLE);
  }
  if (missing.length) {
    console.log(`[bibliometric v2] missing v3.11 columns: ${missing.join(", ")}`);
    throw new BibliometricExportError(503, V2_UNAVAILABLE);
  }
};

export const generateBibliometricDocx = async (rawUid: unknown): Promise<BibliometricExportResult> => {
  const uid = parseUid(rawUid);
  const started = Date.now();
  await requireV2();

  const n = Number((await q("SELECT COUNT(*) AS n FROM analysis_summary_author WHERE personIdentifier = :uid", { uid }))[0]?.n || 0);
  if (n === 0) throw new BibliometricExportError(404, `No accepted publications for ${uid}.`);
  if (n > MAX_WORKS) throw new BibliometricExportError(422, `${uid} has ${n.toLocaleString("en-US")} publications, more than this report handles (${MAX_WORKS.toLocaleString("en-US")}).`);

  const [personRows, typeRows, workRows, cellRows, asOf] = await Promise.all([
    q("SELECT firstName, lastName, primaryOrganizationalUnit FROM person WHERE personIdentifier = :uid LIMIT 1", { uid }),
    q("SELECT personType FROM person_person_type WHERE personIdentifier = :uid", { uid }),
    q(WORKS_SQL, { uid }),
    q(PEER_SQL, { uid }),
    dataAsOf(),
  ]);

  const works = toWorks(workRows);
  if (!flagsFilled(works)) {
    console.log(`[bibliometric v2] uid=${uid}: v3.11 flags not filled by the last nightly`);
    throw new BibliometricExportError(503, V2_UNAVAILABLE);
  }
  if (!works.some(isCounted)) throw new BibliometricExportError(404, `No accepted publications for ${uid}.`);

  const cells: PeerCellRow[] = cellRows.map((r) => ({ ...r, topN: Number(r.topN), cohortEligible: toNum(r.cohortEligible) }));
  const now = rankFromPersonTypes(typeRows.map((r) => r.personType));
  // The run the flags belong to: the stored cells' runDate, else the last completed swap.
  const runDate = String(cells[0]?.runDate || asOf || new Date().toISOString().slice(0, 10));
  const p = personRows[0] || {};
  const articles = new Map((await loadArticles(listedPmids(works))).map((a) => [a.pmid, a]));

  const out = await buildBibliometricDocx({
    uid,
    person: { firstName: p.firstName ?? null, lastName: p.lastName ?? null, department: p.primaryOrganizationalUnit ?? null },
    works,
    cells,
    eligibleNow: cells.length ? flag(cells[0].cohortEligible) : now.eligible,
    currentRank: now.rank,
    articles,
    runDate,
    iciteDate: cells[0]?.iciteLoadedAt ? String(cells[0].iciteLoadedAt) : null,
  });
  if (out.mismatches.length) {
    // The P1 parity script must report 0; a mismatch here means PM and the nightly disagree.
    console.log(`[bibliometric v2] uid=${uid} stored cell average differs from PM's: ${out.mismatches.join(", ")}`);
  }
  console.log(
    `[bibliometric v2] uid=${uid} works=${works.length} counted=${out.counted} templates=${out.fired.join(",")} ms=${Date.now() - started} bytes=${out.buffer.length}`
  );
  return { buffer: out.buffer, fileName: docxFileName(uid, runDate), counted: out.counted, external: out.external, peerShown: out.peerShown };
};

export type BibliometricAvailability = { show: boolean; works: number; name: string | null };

/**
 * Cheap check for the P5 show-button route: anyone with a counted accepted publication can run the
 * v2 report (the v1 RTF needed an analysis_summary_person row). `works` counts what the
 * Publications line counts: one per pmid, minus pubTypeCounted = 0 (errata, retractions). Called
 * by the show route only while the flag is "docx".
 */
export const bibliometricAvailability = async (rawUid: unknown): Promise<BibliometricAvailability> => {
  const uid = parseUid(rawUid);
  const [countRows, personRows] = await Promise.all([
    q(
      "SELECT COUNT(DISTINCT asu.pmid) AS n FROM analysis_summary_author asu " +
        "JOIN analysis_summary_article asa ON asa.pmid = asu.pmid " +
        "WHERE asu.personIdentifier = :uid AND (asa.pubTypeCounted IS NULL OR asa.pubTypeCounted <> 0)",
      { uid }
    ),
    q("SELECT firstName, lastName FROM person WHERE personIdentifier = :uid LIMIT 1", { uid }),
  ]);
  const works = Number(countRows[0]?.n || 0);
  const p = personRows[0];
  const name = p ? [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || null : null;
  return { show: works > 0, works, name };
};

/**
 * The P5 flag: which report the UI offers. Read on every call (one primary-key row), so a SQL
 * change takes effect on the next profile or Reports load with no deploy or restart. A failed read
 * falls back to "rtf", the v1 behaviour.
 */
export const bibliometricReportVersion = async (): Promise<BibliometricVersion> => {
  try {
    const rows = await q("SELECT viewAttributes FROM admin_settings WHERE viewName = :name LIMIT 1", {
      name: BIBLIOMETRIC_SETTING,
    });
    return parseBibliometricVersion(rows[0]?.viewAttributes ?? null);
  } catch (e) {
    console.log("[bibliometric] version flag read failed; using rtf", (e as Error)?.message);
    return "rtf";
  }
};
