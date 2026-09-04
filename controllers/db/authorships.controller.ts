import type { NextApiRequest, NextApiResponse } from "next";
// `where` aliased sqlWhere — authorshipSummary already has a local `const where = buildWhere(...)`,
// and colliding with that is worse than one extra character at every call site below.
import { Op, fn, col, literal, where as sqlWhere } from "sequelize";
import { getToken } from "next-auth/jwt";
import models from "../../src/db/sequelize";
import { reciterConfig } from "../../config/local";
import { updatePendingArticleCount } from "./person.controller";
import { addExternalArticle, deleteExternalArticle } from "../externalArticle.controller";
import { getRejectedPmidsByCwid, getKnownPmidsByCwid } from "../../src/lib/goldStandardRejections";
import { assignGate, canonicalCwid, homonymRejections } from "../../src/lib/assignGate";
import { LOCAL_ONLY_MARKER, noteHasLocalOnlyMarker, isLocalOnlyNote } from "../../src/lib/localOnlyMarker";
import { authorKey } from "../../src/lib/bulkAssign";
import { DynamoDBClient, BatchGetItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";

// Columns returned to the Authorships tab (one row per unassigned WCM authorship).
// Multi-source: `source`/`external_id`/`pub_type`/`container_id` drive the Scopus lane
// (documents not in PubMed → curators Accept them as ExternalArticle, no PMID).
const LIST_ATTRIBUTES = [
  "id", "source", "pmid", "external_id", "author_key", "wcm_author", "author_position_label", "author_affiliation",
  "entrez_date", "title", "journal", "doi", "pub_type", "container_id", "classification",
  "top_cwid", "top_name", "top_person_type", "top_dept",
  "top_fg_score", "top_io_score", "top_confidence", "top_cohort_size",
  "top_given_match", "top_affil_match", "n_candidates", "single_candidate",
  "candidate_cwids_json", "authors_json", "dup_flag", "dup_reason", "accept_conflict",
  "matched_pmid", "matched_pmid_source", "matched_pmid_at", "matched_pmid_verdict",
  "status", "snooze_until", "reviewer", "resolved_at",
];

// Ad-hoc join to `person` for institution filtering/grouping. authorship_review has no
// institution column of its own (only top_cwid/top_name/top_person_type/top_dept) — the real
// institution lives on person.primaryInstitution, joined by person.personIdentifier ===
// authorship_review.top_cwid. No pre-registered Sequelize association exists between these two
// models (personNames()/identityLabel() below both read `person` via an app-side IN() instead
// of a join, for the same reason documented on them), so one is registered here — mirrors the
// AnalysisSummaryAuthor.hasOne(Person, { constraints: false }) precedent in
// reports/publication.report.controller.ts. constraints:false because there is no real FK:
// top_cwid can (and often does) name a cwid with no row in `person` at all.
models.AuthorshipReview.belongsTo(models.Person, {
  as: "Person",
  constraints: false,
  foreignKey: "top_cwid",
  targetKey: "personIdentifier",
});

// person.personIdentifier is utf8mb4_unicode_ci; authorship_review.top_cwid is
// utf8mb4_general_ci (information_schema, verified 2026-09-03 against the live dev DB — same
// mismatch personNames()/identityLabel() above route around by not joining at all). A plain
// `Person.personIdentifier = AuthorshipReview.top_cwid` ON clause throws MySQL error 1267
// ("Illegal mix of collations") the instant this join actually executes — confirmed
// empirically (LEFT JOIN with a bare equality errors). The explicit COLLATE below is that fix,
// not decoration — do not simplify it away, and do not move it onto the Person side: see the
// index note at the ON clause for why that costs three orders of magnitude.
//
// required:false everywhere except the dedicated institution facet-count query in
// authorshipSummary (LEFT JOIN there would count nothing for an unmatched top_cwid, which is
// correct for "no institution to bucket" but wrong for "how many rows exist" elsewhere) — see
// each call site for why.
//
// `attributes` defaults to [] — "filtering/grouping only, never shapes a returned row" was the
// original invariant and it still holds for two of the three call sites, which MUST keep the
// default:
//   - authorshipSelectable returns a deliberately slim shape; nothing there needs a person row.
//   - authorshipSummary's institution facet is a bare aggregate with NO GROUP BY, so any
//     non-aggregated column added to its SELECT is an ONLY_FULL_GROUP_BY error waiting to
//     happen — the same class of trap as the ambiguous-`id` one already documented there.
// listAuthorships is the exception and passes ["primaryInstitution"], because §2.6's identity
// hover card needs the proposed person's institution on the row. Widened here rather than by
// attaching a second include on purpose: the join already exists on that query, so this is one
// more column off an already-joined row, not a new join. Measured on the dev DB, 25-row page,
// SQL_NO_CACHE, 3 runs each: 86/87/90 ms without the column, 58/58/64 ms with it — no
// measurable cost. EXPLAIN is identical for both apart from `Person` losing "Using index": it
// stays type=ref on person_personIdentifier_IDX at one row per outer row, it just reads the
// row instead of covering from the index. The row COUNT cannot change either: sequelize's
// count() sets includeIgnoreAttributes=false (6.37.8, lib/model.js:1302), so include
// attributes never reach the COUNT query at all.
function personInstitutionInclude(required: boolean, attributes: string[] = []) {
  return {
    model: models.Person,
    as: "Person",
    required,
    attributes,
    on: {
      // The COLLATE goes on the authorship_review side ON PURPOSE. Applying it to
      // `Person`.`personIdentifier` makes that column non-indexable, which drops
      // person_personIdentifier_IDX and turns every authorships query into a
      // 26k x 33k block-nested-loop: measured against production, the join count took
      // 140,972 ms that way versus 118 ms this way, and the institution facet
      // 116,410 ms versus 140 ms -- both returning byte-identical results (27,065 rows,
      // the same 26 buckets). Collating the non-indexed side keeps the index usable.
      // Results are unaffected because cwids are ASCII, where general_ci and unicode_ci
      // agree; this was verified, not assumed.
      col: sqlWhere(
        literal("`AuthorshipReview`.`top_cwid` COLLATE utf8mb4_unicode_ci"),
        "=",
        col("Person.personIdentifier"),
      ),
    },
  } as any;
}

// Curated institution buckets. person.primaryInstitution is free-text (24,403 person rows,
// 70 distinct raw values on the live dev roster as of 2026-09-03) rather than a clean enum, so
// this maps a short bucket key to the literal primaryInstitution string(s) it covers —
// confirmed against live data (dev DB query, 2026-09-03): "Weill Cornell Medicine" (9 rows),
// "Weill Cornell Medical College" (8,441 rows), "Weill Cornell Medical College in Qatar"
// (1,011 rows), "Hospital for Special Surgery" (476 rows). The rest are every other
// primaryInstitution value with >=100 people on prod as of 2026-09-03 — merged only where two
// literals are plainly the same institution under a different name (e.g. Sloan Kettering
// Institute vs Memorial Sloan Kettering Cancer Center); distinct campuses/affiliates of the
// same broader system (NYP main vs NYP-Queens vs New York Methodist) are kept separate since
// the source data already encodes them as distinct labels.
// Cornell's College of Veterinary Medicine currently has 0 people in this roster (not yet fed
// into ReCiter) — a follow-up import will add it; add a 'vet' bucket here once that lands, no
// other code changes needed.
const INSTITUTION_BUCKETS: Record<string, string[]> = {
  wcm: ["Weill Cornell Medicine", "Weill Cornell Medical College"],
  nyp: ["New York-Presbyterian Hospital"],
  wcm_qatar: ["Weill Cornell Medical College in Qatar"],
  msk: ["Memorial Sloan Kettering Cancer Center", "Memorial Sloan Kettering", "Sloan Kettering Institute"],
  houston_methodist: ["Houston Methodist Hospital", "Houston Methodist Research Institute"],
  hss: ["Hospital for Special Surgery"],
  hamad_medical: ["Hamad Medical Corporation"],
  ny_methodist: ["New York Methodist Hospital"],
  nyp_queens: ["New York Presbyterian - Queens"],
  lincoln: ["Lincoln Medical and Mental Health Center"],
  columbia: ["Columbia University College of Physicians and Surgeons", "Columbia University"],
  sidra: ["SIDRA Medical and Research Center"],
};

// Byline-affiliation patterns for the same buckets. Distinct from INSTITUTION_BUCKETS because
// that maps person.primaryInstitution (an HR roster value) while this LIKE-matches the raw
// author_affiliation text printed on the paper — a person whose roster value is "Weill Cornell
// Medical College" routinely appears on a byline reading "Weill Cornell Medicine", so reusing
// the roster literals here would match almost nothing. Patterns were validated against live
// production data (all 12 buckets return plausible counts in one pass over the open rows).
// `wcmExclude` keeps buckets disjoint: "Weill Cornell" also matches the Qatar campus, which has
// its own bucket, so wcm subtracts it rather than double-counting.
const INSTITUTION_BYLINE_PATTERNS: Record<string, string[]> = {
  wcm: ["Weill Cornell"],
  nyp: ["New York-Presbyterian", "NewYork-Presbyterian", "New York Presbyterian"],
  wcm_qatar: ["Weill Cornell Medicine-Qatar", "Weill Cornell Medical College in Qatar",
              "Weill Cornell Medicine - Qatar", "Weill Cornell Medicine Qatar"],
  msk: ["Sloan Kettering"],
  houston_methodist: ["Houston Methodist"],
  hss: ["Hospital for Special Surgery"],
  hamad_medical: ["Hamad Medical"],
  ny_methodist: ["New York Methodist"],
  nyp_queens: ["Presbyterian Queens", "Presbyterian-Queens", "Presbyterian/Queens"],
  lincoln: ["Lincoln Medical"],
  columbia: ["Columbia University"],
  sidra: ["Sidra"],
};

// "Weill Cornell" matches the Qatar campus too; wcm excludes it so the buckets stay disjoint.
const BYLINE_EXCLUDE: Record<string, string[]> = { wcm: ["Qatar"] };

/**
 * One SUM(...) column per bucket key, counting rows that match that bucket under `basis`.
 * `alias` prefixes the returned column names so two bases can be summed in ONE pass over the
 * rows — the summary asks for the person/either basis (the `institutions` facet) and the byline
 * basis (the `authorInstitutions` facet) together, and running them as two queries would mean
 * two scans. Measured on the dev DB over the open queue: 12 SUMs (either) 315 ms, the same 12
 * plus 12 byline_-prefixed SUMs 534 ms, byline alone 322 ms — one combined query is ~100 ms
 * cheaper than two separate ones and holds one scan instead of two.
 */
function institutionFacetAttributes(basis: InstitutionBasis, alias = ""): any[] {
  const esc = (v: string) => v.replace(/'/g, "''");
  return Object.keys(INSTITUTION_BUCKETS).map((key) => {
    const clauses: string[] = [];
    if (basis === "person" || basis === "either") {
      const lits = (INSTITUTION_BUCKETS[key] || []).map((l) => `'${esc(l)}'`);
      if (lits.length) clauses.push(`\`Person\`.\`primaryInstitution\` IN (${lits.join(", ")})`);
    }
    if (basis === "byline" || basis === "either") {
      const pats = INSTITUTION_BYLINE_PATTERNS[key] || [];
      if (pats.length) {
        const hit = pats.map((pat) => `\`AuthorshipReview\`.\`author_affiliation\` LIKE '%${esc(pat)}%'`).join(" OR ");
        const excl = (BYLINE_EXCLUDE[key] || [])
          .map((e) => ` AND \`AuthorshipReview\`.\`author_affiliation\` NOT LIKE '%${esc(e)}%'`).join("");
        clauses.push(`((${hit})${excl})`);
      }
    }
    const expr = clauses.length ? clauses.join(" OR ") : "0";
    return [literal(`SUM(CASE WHEN ${expr} THEN 1 ELSE 0 END)`), `${alias}${key}`];
  });
}

type InstitutionBasis = "person" | "byline" | "either";

function normaliseBasis(v: any): InstitutionBasis {
  return v === "person" || v === "byline" ? v : "either";   // unknown/absent -> widest
}

/** Sequelize condition matching the paper's byline text for one bucket key. */
function bylineCondition(key: string) {
  const pats = INSTITUTION_BYLINE_PATTERNS[key] || [];
  if (!pats.length) return null;
  const hit: any = { [Op.or]: pats.map((p) => ({ [Op.like]: `%${p}%` })) };
  const excl = BYLINE_EXCLUDE[key] || [];
  const conds: any[] = [{ author_affiliation: hit }];
  for (const e of excl) conds.push({ author_affiliation: { [Op.notLike]: `%${e}%` } });
  return conds.length === 1 ? conds[0] : { [Op.and]: conds };
}

// ---- Identity conflicts queue --------------------------------------------------
//
// "Two CWIDs assigned to one authorship": this row's PMID is ALREADY accepted by a cwid other
// than the one the producer proposes. Accepting the row as-is would put the same paper on two
// people's records under (potentially) the same byline.
//
// Three deliberate choices, each measured against the live dev DB (7,688 open rows, 2026-09-04):
//
//  - "assignment" means userAssertion='ACCEPTED', not any person_article row. person_article
//    also holds PENDING suggestions (userAssertion='' — 243,643 of its 745,994 rows), and a
//    suggestion is not an assignment. Dropping the ACCEPTED test takes this queue from 169 rows
//    to 3,636 (47% of the whole open queue), which is not a conflict queue.
//  - top_cwid IS NOT NULL is required rather than implied. A row with no proposed identity has
//    no second cwid to conflict with — one cwid is not two — and `pa.personIdentifier <> NULL`
//    is NULL, i.e. already excluded; stating it makes that intent explicit rather than a
//    three-valued-logic accident.
//  - Scopus rows have no pmid, so `pa.pmid = NULL` never matches and they never enter this
//    queue. That is correct (gold standard is PMID-keyed) and needs no extra predicate.
//
// COLLATE goes on the authorship_review side, same rule and same reason as the person join
// above (person_article.personIdentifier is utf8mb4_unicode_ci, authorship_review.top_cwid is
// utf8mb4_general_ci; a bare comparison throws 1267). EXPLAIN on the dev DB: the subquery is
// type=ref on person_article.idx_pmid, rows=1, FirstMatch, index_condition
// `AuthorshipReview.pmid = pa.pmid` — index-backed, not a scan; the outer type=ALL over
// authorship_review is the same scan every other query in this file already does.
//
// COST, stated plainly rather than hidden, because /summary is the endpoint §4's latency trap
// already burned once (dev DB, 2026-09-04, 7,688 open rows over 745,994 person_article rows):
//   this COUNT alone, warm .................................. 130 ms median
//   the same open-queue COUNT without this predicate ........   36 ms median
//   /summary's whole query fan-out, 9 queries (pool max 20) .. 385 ms median
//   the same fan-out with this as the 10th ................... 458 ms median  (+73 ms)
// The 10 run in parallel — src/db/db.ts sets pool.max 20 — so the wall clock is set by the
// 24-SUM institution facet at ~300 ms and this adds contention, not a serial leg. It is the
// honest cost of an index-backed correlated EXISTS and is left as-is; the number is here so the
// prod gate (§5 baseline: summary 489 ms over 15,566 open rows, i.e. ~2x the row count) can be
// judged on evidence. Making it materially cheaper needs a covering index on
// person_article(pmid, userAssertion, personIdentifier) — a prod DDL change, not a code one.
//
// KNOWN WIDTH, measured, flagged for the product owner rather than silently narrowed: this is
// a PMID-level test, so it also fires when the already-accepted cwid is a genuine *co-author*
// on the same paper rather than a rival claim on the same byline. Of the 169 dev rows, only 21
// share a surname with the accepted cwid's byline name (the true "same authorship, two people"
// shape — e.g. byline "Kristy A Brown" proposed to sxa9001 while kab2060 has already accepted
// that PMID as "Kristy A Brown"). Narrowing to those 21 is one extra condition here
// (LOWER(pa.articleAuthorNameLastName) = LOWER(SUBSTRING_INDEX(wcm_author,' ',-1)), 156 ms) —
// deliberately NOT applied, because the PMID-level reading is the decision on record.
function identityConflictWhere(): any {
  return {
    [Op.and]: [
      { top_cwid: { [Op.ne]: null } },
      literal(
        "EXISTS (SELECT 1 FROM `person_article` `pa` " +
        "WHERE `pa`.`pmid` = `AuthorshipReview`.`pmid` " +
        "AND `pa`.`userAssertion` = 'ACCEPTED' " +
        "AND `pa`.`personIdentifier` <> `AuthorshipReview`.`top_cwid` COLLATE utf8mb4_unicode_ci)",
      ),
    ],
  };
}

// The Identity-conflicts queue is requested either as its own statusView (what the redesigned
// QUEUE list sends) or as a standalone boolean. Both are honoured because they are not
// interchangeable everywhere: authorshipSelectable force-overrides statusView to "open", so a
// conflicts request expressed ONLY as a statusView would be silently widened back to the whole
// open queue there — exactly the "a bulk action fires on rows the user can no longer see" bug
// class. That endpoint normalises through this helper before overriding.
const wantsIdentityConflicts = (body: any): boolean =>
  body?.identityConflicts === true || body?.statusView === "conflicts";

const todayStr = () => new Date().toISOString().slice(0, 10);

// A no-DOI scopus row can't yet be verified against PubMed (aar_universe_scopus.py's
// re-check needs either a DOI or, past this floor, a title/author fallback search).
// Scopus routinely indexes a doc before PubMed does and before Scopus itself backfills
// its DOI, so a *fresh* no-DOI row is more likely still settling than genuinely
// PubMed-absent. Hold it out of every view until it clears the floor — the producer's
// monthly re-check keeps running underneath regardless, so a row that resolves to PubMed
// in the meantime is auto-dismissed before a curator ever sees it.
const SCOPUS_NO_DOI_MATURITY_DAYS = 60;
const maturityCutoffStr = () =>
  new Date(Date.now() - SCOPUS_NO_DOI_MATURITY_DAYS * 86400000).toISOString().slice(0, 10);

const SORTS: Record<string, any[]> = {
  // default: single-candidate (high-precision) first, then identity-only score desc.
  // ["pmid","DESC"] is a secondary key so same-paper pubmed authorships land adjacent.
  precision: [["single_candidate", "DESC"], ["top_io_score", "DESC"], ["pmid", "DESC"]],
  confidence: [["top_confidence", "DESC"], ["pmid", "DESC"]],
  io: [["top_io_score", "DESC"], ["pmid", "DESC"]],
  fg: [["top_fg_score", "DESC"], ["pmid", "DESC"]],
  date: [["entrez_date", "DESC"], ["pmid", "DESC"]],
  date_asc: [["entrez_date", "ASC"], ["pmid", "ASC"]],
  // "Most candidates" — the homonym-heaviest rows first, which is the queue a curator wants when
  // they are deliberately working the ambiguous tail rather than skimming near-certain accepts.
  // n_candidates is a plain INTEGER column the AAR producer already writes (it is what
  // single_candidate is derived from), so this needs no JSON_LENGTH over candidate_cwids_json and
  // no computed expression. NULLs sort last under DESC in MariaDB, which is what we want: a row
  // the producer never counted is not "many candidates".
  // ponytail: no index on n_candidates, so this filesorts — but so do all five sorts above
  // (only single_candidate and the PK are indexed). Add a covering index if sort latency is ever
  // shown to matter; do not add one speculatively for this option alone.
  candidates: [["n_candidates", "DESC"], ["top_io_score", "DESC"], ["pmid", "DESC"]],
};

// Status-view predicate for the current view ("open" | "snoozed" | "dismissed"), or null
// when feed="all". Factored out so the per-paper sibling count respects the same view.
function openStatusWhere(body: any): any {
  if (body.feed === "all") return null;
  const view = body.statusView || "open";
  const today = todayStr();
  if (view === "snoozed") {
    return { status: "snoozed", snooze_until: { [Op.gt]: today } };
  } else if (view === "dismissed") {
    return { status: "dismissed" };
  } else if (view === "duplicates") {
    // Two independent producer signals land here, both still status="open" so resolving a
    // row anywhere drops it out of this view with no cleanup needed:
    //  - accept_conflict: an Accept came back 409 from ExternalArticleDupCheck — a fuzzy
    //    title+year collision (its WARNING level), which CAN pair two genuinely distinct works.
    //  - matched_pmid (verdict not yet set): the producer flagged a possible PubMed twin for a
    //    scopus row (title-search heuristic, or a doi/scopus match not yet auto-dismissed).
    //    Once a curator sets matched_pmid_verdict='distinct' the row falls out of this view and
    //    back into the open queue below ("Different papers" = never re-flag, not "resolved").
    return {
      status: "open",
      [Op.or]: [
        { accept_conflict: { [Op.ne]: null } },
        { matched_pmid: { [Op.ne]: null }, matched_pmid_verdict: null },
      ],
    };
  }
  // open queue: truly open, plus snoozes whose timer has lapsed (or has no wake date).
  // accept_conflict rows are excluded here — they live in the "duplicates" view above.
  // Same for an unverdicted matched_pmid flag; ANY verdict lets the row back in here ('distinct' is
  // the only one PM writes; a stray 'same' must never hide a row from every view).
  //
  // statusView "conflicts" reaches here on purpose and takes this same open-queue predicate:
  // identity conflicts are a SUBSET of the open queue, not a fifth status. The predicate that
  // narrows them is identityConflictWhere(), applied in buildWhere — which is also why the
  // sibling/like counts that call this function with the caller's body stay describing the open
  // queue rather than the conflicts slice of it (same stance as the institution filter there).
  return {
    [Op.and]: [
      { accept_conflict: null },
      {
        [Op.or]: [
          { status: "open" },
          { status: "snoozed", snooze_until: { [Op.lte]: today } },
          { status: "snoozed", snooze_until: null as any },
        ],
      },
      {
        [Op.or]: [
          { matched_pmid: null },
          { matched_pmid_verdict: { [Op.ne]: null } },
        ],
      },
    ],
  };
}

// T5: the same "is this row in the open queue" test openStatusWhere({statusView:"open"})
// compiles to SQL, but evaluated in JS against ONE already-fetched row rather than run as a
// WHERE clause — like_count's grouped COUNT (below) always scopes to the open queue regardless
// of which statusView the caller is browsing, so this answers "was the CURRENT row itself part
// of that count" (and so needs subtracting) independent of that. Kept in exact lockstep with
// openStatusWhere's own open-queue branch by construction, not by convention: same four
// conditions (no accept_conflict, status=open or a lapsed/unset snooze, and no unverdicted
// matched_pmid flag — a 'distinct' verdict lets the row back in, same as the SQL branch).
function isRowOpenForLike(r: any): boolean {
  if (r.accept_conflict) return false;
  if (r.matched_pmid != null && r.matched_pmid_verdict == null) return false;
  if (r.status === "open") return true;
  if (r.status === "snoozed") return !r.snooze_until || r.snooze_until <= todayStr();
  return false;
}

const ABSENT_CWID_TTL_MS = 5 * 60 * 1000;
let absentCwidCache: { set: Set<string>; expires: number } | null = null;

// Which proposed-identity cwids across the OPEN queue have no ReCiter identity at all — the
// set hideNoIdentity hides. A given cwid can be top_cwid on hundreds of open rows, so resolving
// this once per cache refresh (not once per row, and never for the whole matching set on every
// list load — that cost is exactly why this filter didn't exist before) is what makes it cheap:
// a few thousand distinct cwids batched 100/call through reciterIdentitySet(), the same shape
// as every other Identity lookup in this file.
// ponytail: plain Map+timestamp TTL, no cache lib — one key, one process. Tradeoff: a cwid that
// GAINS an identity (e.g. an IC#148 backfill) can stay hidden for up to ABSENT_CWID_TTL_MS after
// the fact, and one that loses an identity takes just as long to start being hidden. Both
// directions self-heal on the next refresh with no action required.
async function absentCwidSet(): Promise<Set<string>> {
  if (absentCwidCache && absentCwidCache.expires > Date.now()) return absentCwidCache.set;
  const rows: any[] = await models.AuthorshipReview.findAll({
    attributes: [[fn("DISTINCT", col("top_cwid")), "top_cwid"]],
    where: { [Op.and]: [openStatusWhere({}), { top_cwid: { [Op.ne]: null } }] },
    raw: true,
  });
  const distinct = rows.map((r) => String(r.top_cwid)).filter(Boolean);
  const known = await reciterIdentitySet(distinct);
  const absent = new Set(distinct.filter((c) => !known.has(c)));
  absentCwidCache = { set: absent, expires: Date.now() + ABSENT_CWID_TTL_MS };
  return absent;
}

function buildWhere(body: any, absentCwids?: Set<string>): any {
  const and: any[] = [];

  const status = openStatusWhere(body);
  if (status) and.push(status);
  // identity-conflicts queue: open rows whose PMID is already accepted by another cwid. Layered
  // on top of the status predicate rather than replacing it — see identityConflictWhere().
  if (wantsIdentityConflicts(body)) {
    and.push(identityConflictWhere());
  }
  // source segment: "all" (default) | "pubmed" | "scopus"
  if (body.source && body.source !== "all") {
    and.push({ source: body.source });
  }
  // classification lane: buried | suggested | absent
  if (body.classification && body.classification !== "all") {
    and.push({ classification: body.classification });
  }
  // precision lane: only single-candidate (near-certain) authorships
  if (body.precision === "single") {
    and.push({ single_candidate: true });
  } else if (body.precision === "fullname") {
    // "Unique and full given-name match": the one class curators have never once rejected.
    // Across 4,723 resolved decisions with single_candidate + top_given_match="full" there
    // are 0 rejections, in both sources and all three classifications; the same curators
    // rejected 373 of 3,251 single-candidate rows whose given name matched on INITIAL only,
    // on the same days. Rule of three puts the upper bound on this class's error at 0.064%.
    and.push({ single_candidate: true, top_given_match: "full" });
  }
  // publication-type filter (multiselect): Scopus subtypeDescription
  if (Array.isArray(body.pubTypes) && body.pubTypes.length > 0) {
    and.push({ pub_type: { [Op.in]: body.pubTypes } });
  }
  // person-type filter (multiselect): the proposed identity's person type(s)
  if (Array.isArray(body.personTypes) && body.personTypes.length > 0) {
    and.push({ top_person_type: { [Op.in]: body.personTypes } });
  }
  // curated institution filter (multiselect): resolve each selected bucket key to its
  // literal primaryInstitution string(s) via INSTITUTION_BUCKETS (flatMap, unknown keys
  // silently drop out), then filter on the joined Person row via Sequelize's
  // $Person.primaryInstitution$ dotted syntax for an included-model column. Every caller that
  // can pass a non-empty body.institutions through to here (listAuthorships,
  // authorshipSelectable) attaches personInstitutionInclude() to that same query so the dotted
  // reference always has a join to resolve against — authorshipSummary's main facet queries
  // don't, because it forces body.institutions to [] before calling buildWhere, so this branch
  // never fires for them in the first place (required:false is fine even here: IN(...) never
  // matches a NULL from an
  // unmatched/absent top_cwid, so those rows correctly drop out of just this filtered query
  // without needing an INNER JOIN — verified empirically: a LEFT JOIN + this filter and an
  // INNER JOIN + this filter returned the identical row count against the live dev DB).
  if (Array.isArray(body.institutions) && body.institutions.length > 0) {
    // basis decides WHICH institution is being asked about: the person's HR roster value
    // ("is this our person?"), the affiliation printed on the paper ("does this paper credit
    // us?"), or either. They diverge sharply — measured on production, the WCM person bucket
    // held 4,594 open rows of which 2,370 had a non-WCM byline, while 5,613 rows with a WCM
    // byline sat outside it entirely — so one basis alone is always wrong for someone.
    const basis = normaliseBasis(body.institutionBasis);
    const keys = body.institutions as string[];
    const institutionLiterals = keys.flatMap((key) => INSTITUTION_BUCKETS[key] || []);
    const personCond = institutionLiterals.length
      ? { "$Person.primaryInstitution$": { [Op.in]: institutionLiterals } } : null;
    const bylineConds = keys.map(bylineCondition).filter(Boolean) as any[];
    const bylineCond = bylineConds.length ? { [Op.or]: bylineConds } : null;

    if (basis === "person") {
      if (personCond) and.push(personCond);
    } else if (basis === "byline") {
      if (bylineCond) and.push(bylineCond);
    } else {
      const either = [personCond, bylineCond].filter(Boolean) as any[];
      if (either.length) and.push(either.length === 1 ? either[0] : { [Op.or]: either });
    }
  }
  // Article-affiliation filter (multiselect): the SAME curated buckets as `institutions` above,
  // but always resolved against the affiliation printed on the paper
  // (INSTITUTION_BYLINE_PATTERNS via bylineCondition), never against the person's HR roster
  // value. It is a separate body key rather than another basis value because the redesigned
  // Affiliation popover holds two INDEPENDENT lists — "Identity affiliation" (the person, the
  // `institutions` key above) and "Article affiliation" (the byline, this key) — and picking in
  // both means BOTH must hold: a WCM person on an NYP byline. That AND falls out for free from
  // both branches pushing onto the same `and` array; within one list the selected buckets still
  // OR together. Touches no joined table (author_affiliation is a column on authorship_review),
  // so unlike the `institutions` branch this one needs no Person include to resolve against.
  if (Array.isArray(body.authorAffiliations) && body.authorAffiliations.length > 0) {
    const conds = (body.authorAffiliations as string[]).map(bylineCondition).filter(Boolean) as any[];
    if (conds.length) and.push(conds.length === 1 ? conds[0] : { [Op.or]: conds });
  }
  // hide rows with no proposed identity at all (#938 — ReCiterDB#177 nulls top_cwid on rows
  // the merged matcher no longer matches to anyone; neither Accept nor Reject has anything to
  // act on). top_cwid is a real column on the row itself — unlike identity_in_reciter, which
  // is resolved per-page against DynamoDB after this query runs — so this is a plain SQL
  // predicate like every filter above it, and authorshipSelectable's "N matching" count (which
  // shares buildWhere) can never disagree with what this hides.
  if (body.hideNoSuggestion) {
    and.push({ top_cwid: { [Op.ne]: null } });
  }
  // hide rows proposing a person with no ReCiter identity at all — the complement of
  // hideNoSuggestion above (that one hides no-proposal rows; this hides has-a-proposal
  // rows the identity check would reject). absentCwids is the TTL-cached snapshot from
  // absentCwidSet(), not a live per-row DynamoDB check — same identity_in_reciter tradeoff
  // as the rest of this file, just resolved once per cache window instead of once per page.
  if (body.hideNoIdentity && absentCwids && absentCwids.size > 0) {
    and.push({ [Op.or]: [
      { top_cwid: null },
      { top_cwid: { [Op.notIn]: [...absentCwids] } },
    ] });
  }
  // T5: "Show N others like this" — the structured, variant-tolerant complement to the
  // free-text search box just below. likeAuthor is the raw wcm_author of an anchor row (set by
  // the client, never typed); authorKey() (src/lib/bulkAssign.ts) reduces it to lowercase
  // first-token|last-token, and the two equality conditions below are that same rule expressed
  // in SQL — LOWER(SUBSTRING_INDEX(wcm_author,' ',1)) / LOWER(SUBSTRING_INDEX(wcm_author,' ',-1))
  // — so "Bernard Park" and "Bernard J. Park" match on first+last token even though neither
  // string contains the other, which is exactly what the free-text LIKE below cannot do. Two
  // plain equality predicates, not a computed/generated column, are fine at this table's ~16k
  // rows with no index (see authorKey's own comment for the compound-surname ceiling this
  // shares).
  const likeKey = authorKey(body.likeAuthor);
  if (likeKey) {
    const [likeFirst, likeLast] = likeKey.split("|");
    and.push(sqlWhere(fn("LOWER", fn("SUBSTRING_INDEX", col("wcm_author"), " ", 1)), likeFirst));
    and.push(sqlWhere(fn("LOWER", fn("SUBSTRING_INDEX", col("wcm_author"), " ", -1)), likeLast));
  }
  // free-text search across author name, proposed identity, pmid, doi, and Scopus id
  const search = (body.searchTextInput || "").trim();
  if (search) {
    const like = `%${search}%`;
    const or: any[] = [
      { wcm_author: { [Op.like]: like } },
      { top_name: { [Op.like]: like } },
      { top_cwid: { [Op.like]: like } },
      { doi: { [Op.like]: like } },
      { external_id: { [Op.like]: like } },
    ];
    if (/^\d+$/.test(search)) or.push({ pmid: Number(search) });
    and.push({ [Op.or]: or });
  }
  // publication-date range (entrez_date is DATEONLY → compare YYYY-MM-DD strings)
  const dateFrom = (body.dateFrom || "").trim();
  const dateTo = (body.dateTo || "").trim();
  if (dateFrom && dateTo) {
    and.push({ entrez_date: { [Op.between]: [dateFrom, dateTo] } });
  } else if (dateFrom) {
    and.push({ entrez_date: { [Op.gte]: dateFrom } });
  } else if (dateTo) {
    and.push({ entrez_date: { [Op.lte]: dateTo } });
  }
  // hold immature no-DOI scopus rows out of every view until they clear the floor above.
  // entrez_date is nullable (aar_universe_scopus.py has no coverDate fallback) — a bare
  // Op.gt against NULL evaluates to NULL, and NOT(NULL) is NULL too, so an unguarded
  // clause here would make a missing-date row vanish permanently instead of just holding
  // it. Require entrez_date to be non-null before comparing, so a NULL date falls through
  // to "show the row" rather than "hide it forever."
  and.push({
    [Op.not]: {
      source: "scopus",
      doi: null,
      entrez_date: { [Op.and]: [{ [Op.ne]: null }, { [Op.gt]: maturityCutoffStr() }] },
    },
  });

  return and.length ? { [Op.and]: and } : {};
}

// same-document sibling key: pubmed → pmid, scopus → external_id (co-authorships on one doc).
const siblingKey = (r: any) =>
  r.source === "scopus" ? String(r.external_id || "") : String(r.pmid ?? "");

// Which of these cwids have a ReCiter identity? Asks DynamoDB `Identity` directly — the same
// table ReCiter's own ExternalArticleController.findByUid consults before it will accept an
// ExternalArticle, so this answer and the accept path's answer cannot disagree. Needed because
// the AAR producer matches against the wider IDM `identity` universe, so top_cwid can name
// someone ReCiter doesn't track; accepting those 404s at the ExternalArticle endpoint and
// orphans gold-standard writes. Checked at read time, not produce time, because people also
// leave WCM after a row is produced.
//
// This used to read reciterdb's `person` mirror, gated on the row having a name, on the theory
// that a null-name person row was stale sync debris and so couldn't be a valid identity. That
// premise is wrong. `person` gets names from a SECOND loader pass (ReCiterDB
// updateReciterDB.py `update_person`, an INNER join against person_temp, skipped entirely on
// incremental runs), so a null name means "the name loader hasn't covered this cwid", not "not
// in ReCiter". Measured 2026-08-29: 173 of 187 null-name person rows (92.5%) ARE in DynamoDB
// Identity, and `person` is missing 1,915 uids DynamoDB has. Across the 18,892 open rows the
// mirror flagged 1,048 cwids / 2,723 rows, of which 74 cwids / 254 rows were false — Accept
// hidden from curators who could legitimately have used it (brf9046 being the reported case:
// null-name person row, full identity in DynamoDB, /curate/brf9046 renders fine because that
// page asks ReCiter's REST identity endpoint instead of this mirror). DynamoDB flags the 974
// genuinely-absent cwids and nothing else. Errors in the other direction were already zero,
// so this change only ever un-blocks.
//
// No try/catch on purpose: an AWS failure propagates to the caller's existing 500 handler.
// Failing OPEN would let the pubmed lane write orphan GoldStandard rows (POST
// /reciter/goldstandard has no identity check of its own — this is the only backstop);
// failing CLOSED would silently pill the entire queue with a claim that isn't true. A visible
// 500 is the honest third option and costs no code.
//
// ponytail: point lookups per request, no cache — ~20 ms for a 25-row page and ~0.6 s for the
// 5,000-row selectable page (17 batches), the same order as the getRejectedPmidsByCwid call
// two lines below. Unprocessed keys throw rather than retry: throttling a key-only projection
// is vanishingly rare, and a 500 beats silently reporting a present identity as absent.
// Ceiling: PM is duplicating a check that belongs server-side. Upgrade path is to add the
// Identity check to ReCiter's POST /reciter/goldstandard (ReCiterController.java validates
// only that the body is non-null), after which this becomes advisory rather than load-bearing.
// Deliberately NOT fixed here: personNames() below still reads the same lossy `person` mirror,
// so a null-name row still falls back to top_name; and the `person` loader gap itself is a
// ReCiterDB-side follow-up the app must not depend on being repaired.
const identityDdb = new DynamoDBClient({ region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1" });

async function reciterIdentitySet(cwids: Array<string | undefined | null>): Promise<Set<string>> {
  const wanted = [...new Set(cwids.filter(Boolean).map(String))];
  if (wanted.length === 0) return new Set();
  const out = new Set<string>();
  for (let i = 0; i < wanted.length; i += 100) { // 100 = BatchGetItem hard limit
    const resp = await identityDdb.send(new BatchGetItemCommand({
      RequestItems: {
        Identity: {
          Keys: wanted.slice(i, i + 100).map((uid) => ({ uid: { S: uid } })),
          ProjectionExpression: "uid",
        },
      },
    }));
    if (resp.UnprocessedKeys?.Identity?.Keys?.length) throw new Error("Identity BatchGetItem throttled");
    for (const it of resp.Responses?.Identity ?? []) if (it.uid?.S) out.add(it.uid.S);
  }
  return out;
}

// Display name per cwid from the same `person` mirror, "First Middle Last" — the shape the
// AAR producer bakes into top_name/candidate_cwids_json, so a looked-up name reads the same
// as a produced one.
// ponytail: app-side IN() rather than a SQL JOIN — the collations differ either way round
// (person.personIdentifier is utf8mb4_unicode_ci, authorship_review.top_cwid is
// utf8mb4_general_ci; checked against information_schema 2026-08-29), which throws 1267 and
// de-indexes a direct join. Note this mirror is lossy (see reciterIdentitySet above): a
// null-name row yields no name here and the caller falls back to top_name.
async function personNames(cwids: Array<string | undefined | null>): Promise<Record<string, string>> {
  const wanted = [...new Set(cwids.filter(Boolean).map(String))];
  if (wanted.length === 0) return {};
  const found: any[] = await models.Person.findAll({
    where: { personIdentifier: { [Op.in]: wanted } },
    attributes: ["personIdentifier", "firstName", "middleName", "lastName"], raw: true,
  });
  const out: Record<string, string> = {};
  found.forEach((p) => {
    const name = [p.firstName, p.middleName, p.lastName].map((v) => String(v || "").trim()).filter(Boolean).join(" ");
    if (name) out[String(p.personIdentifier)] = name;
  });
  return out;
}

// primaryAcademicDivision per cwid, for §2.6's identity hover card (which shows department /
// division / institution). Department is already on the row as top_dept and institution now
// comes off the widened person join, but division lives ONLY on the IDM roster table
// `identity` — so it needs its own lookup.
//
// App-side IN() rather than a third include, for the same collation reason personNames() and
// identityLabel() give: identity.cwid is utf8mb4_unicode_ci against authorship_review.top_cwid's
// utf8mb4_general_ci, so a direct join throws 1267 and a COLLATE on the identity side would
// de-index it (the exact mistake the person join's comment documents). One indexed range scan
// per page, over the page's distinct cwids (25 at the default page size): EXPLAIN gives
// type=range, key=`dfsdfsdf` (the cwid index), rows=10 for a 10-cwid probe; 35 ms on the dev DB,
// and ~20 ms of the list endpoint's measured 247→270 ms warm total.
//
// A cwid with no identity row, or with the column null, is simply absent from the result — the
// hover card omits the division line rather than showing an empty one. That is common, not
// exceptional: of 10 sampled queue cwids, 5 had a null primaryAcademicDivision.
async function identityDivisions(cwids: Array<string | undefined | null>): Promise<Record<string, string>> {
  const wanted = [...new Set(cwids.filter(Boolean).map(String))];
  if (wanted.length === 0) return {};
  const found: any[] = await models.Identity.findAll({
    where: { cwid: { [Op.in]: wanted } },
    attributes: ["cwid", "primaryAcademicDivision"], raw: true,
  });
  const out: Record<string, string> = {};
  found.forEach((r) => {
    const div = String(r.primaryAcademicDivision || "").trim();
    if (r.cwid && div) out[String(r.cwid)] = div;
  });
  return out;
}

// "Given Middle Surname · Department" for ONE curator-typed cwid. This string is the only
// thing standing between the curator and an authoritative write into a stranger's publication
// record, so it comes from THREE sources and the caller only ever falls back to a bare cwid
// when all three are silent.
//
// The `person` mirror leads, because firstName there is the byline-shaped name — a curator
// reading "Tony Rosen" on the paper who correctly types aer2006 needs to see "Tony", not the
// legal "Anthony Ehren Rosen" the IDM roster carries. Same preference ReCiterDB PR #172 already
// made on the producer side for the identical reason: consistent with what already shipped.
//
// The IDM roster table `identity` is the fallback name source (when `person` has none), and
// unconditionally supplies the department — it is the only one of the three that carries one,
// and this label is the only thing on the 422 that identifies which department the write lands
// in, so it stays even when its name doesn't lead. Nothing here removes `identity`'s legal name
// from the system; it is still read, still shown when `person` is silent, and its department
// still always shows.
//
// DynamoDB `identity.primaryName` is the last fallback. This function is reachable only from
// the off-candidate confirm, which fires only when reciterIdentitySet() already found the cwid
// in DynamoDB Identity — so the item is known to exist and only its name is in question.
//
// Measured 2026-08-29 over the reachable universe, which is the 26,551 DynamoDB uids that also
// pass this endpoint's own /^[A-Za-z0-9]{1,32}$/ (that regex is what puts the usc_/ucsd_/
// fredhutch_ external-validation cohorts out of typing range, so counting the full 35,052-row
// table overstates this by nearly 4x): 2,140 of the 26,551 (8.1%) get NO name from the IDM
// roster. The AAR queue barely notices — 1 of the 6,374 cwids it names — but those 2,140 are
// residents, fellows and non-faculty staff, i.e. precisely the people the typed-cwid box exists
// to reach, and every one of them rendered as a bare cwid before the `identity` fallback below
// was added. DynamoDB names 2,140 of the 2,140, and 26,551 of 26,551 overall: over the typable
// universe there is no nameless case left. The `person` mirror now leading is strictly worse as
// a NAME COVERAGE fallback — it names 25,958 of the 26,551 and rescues only 2,005 of the
// 2,140 — which is exactly why `identity` stays second in line rather than being dropped.
//
// No try/catch, same stance as reciterIdentitySet: a DynamoDB failure surfaces as the caller's
// 500. Swallowing it would silently reproduce the nameless confirm this fallback exists to
// remove, at the exact moment the curator is being asked to authorise a write.
// ponytail: the DynamoDB fallback is a second point lookup rather than a name projection folded
// into reciterIdentitySet, because that function is also called with up to 5,000 keys per page
// and this branch wants one. Upgrade path if a name is ever needed in bulk: widen the projection
// there and let this one go.
// Same no-join lookup as personNames() above, and for the same reason: identity.cwid is
// utf8mb4_unicode_ci against authorship_review.top_cwid's utf8mb4_general_ci (information_schema,
// 2026-08-29), so a direct join throws 1267.
async function identityLabel(cwid: string): Promise<string> {
  const [person, row]: [any, any] = await Promise.all([
    models.Person.findOne({
      where: { personIdentifier: cwid },
      attributes: ["firstName", "middleName", "lastName"], raw: true,
    }),
    models.Identity.findOne({
      where: { cwid },
      attributes: ["givenName", "middleName", "surname", "primaryAcademicDepartment"], raw: true,
    }),
  ]);
  const bylineName = [person?.firstName, person?.middleName, person?.lastName]
    .map((v) => String(v || "").trim()).filter(Boolean).join(" ");
  const legalName = [row?.givenName, row?.middleName, row?.surname]
    .map((v) => String(v || "").trim()).filter(Boolean).join(" ");
  const name = bylineName || legalName || await identityPrimaryName(cwid);
  if (!name) return "";
  const dept = String(row?.primaryAcademicDepartment || "").trim();
  return dept ? `${name} · ${dept}` : name;
}

// "First Middle Last" from the DynamoDB Identity item itself. `identity` and `primaryName` are
// aliased because DynamoDB reserves IDENTITY and NAME as expression keywords.
async function identityPrimaryName(uid: string): Promise<string> {
  const resp = await identityDdb.send(new GetItemCommand({
    TableName: "Identity",
    Key: { uid: { S: uid } },
    ProjectionExpression: "#i.#p",
    ExpressionAttributeNames: { "#i": "identity", "#p": "primaryName" },
  }));
  const pn = resp.Item?.identity?.M?.primaryName?.M;
  return [pn?.firstName?.S, pn?.middleName?.S, pn?.lastName?.S]
    .map((v) => String(v || "").trim()).filter(Boolean).join(" ");
}

// POST /api/db/authorships/lookup — read-only cwid lookup behind the bulk-assign confirm
// dialog (B-8). This is the upgrade path this file's own case "assign" comment named ahead of
// time ("add GET /api/db/authorships/lookup?cwid= over the same identityLabel()"): a curator
// bulk-assigning to a cwid that is off-candidate for some/all of the selection, or that has no
// ReCiter identity, gets ONE server lookup instead of per-row 422 round-trips, and the bulk
// confirm dialog is built on what THIS returns — never on the raw string typed or a
// possibly-stale candidate_cwids_json label — so the trust boundary the per-row confirms
// enforce (confirm against a server-verified name, never a typed string) holds at bulk scale
// too.
//
// Canonicalization runs through the exact same two calls case "assign" makes (reciterIdentitySet
// on [typed, typed.toLowerCase()], then canonicalCwid) so this can never resolve a cwid to a
// different Identity record than the write path would.
export const authorshipLookupCwid = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const typed = String(req.body?.cwid || "").trim();
    if (!typed) return res.status(400).send("cwid is required");
    if (!/^[A-Za-z0-9]{1,32}$/.test(typed)) return res.status(400).send("cwid must be alphanumeric");
    const found = await reciterIdentitySet([typed, typed.toLowerCase()]);
    const cwid = canonicalCwid(typed, found);
    const hasIdentity = found.has(cwid);
    // identityLabel is reachable here under the identical precondition case "assign"'s
    // confirm_off_candidate requires — hasIdentity already true — so there is never a name
    // to look up for a cwid ReCiter has no Identity record for; the client tells that story
    // itself (hasIdentity: false), not a null name pretending to be one.
    const name = hasIdentity ? ((await identityLabel(cwid)) || null) : null;
    res.send({ cwid, name, hasIdentity });
  } catch (e) {
    console.log(e);
    res.status(500).send(String(e));
  }
};

// POST /api/db/authorships — paginated, filtered list of unassigned WCM authorships.
export const listAuthorships = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const body = req.body || {};
    const limit = Number(body.limit) || 25;
    const offset = Number(body.offset) || 0;
    const order = SORTS[body.sort] || SORTS.precision;
    // buildWhere is sync, so the absent-cwid set (needed only when the filter is on) is
    // resolved up front and threaded in, rather than looked up inside buildWhere itself.
    const absentCwids = body.hideNoIdentity ? await absentCwidSet() : undefined;

    const { count, rows } = await models.AuthorshipReview.findAndCountAll({
      attributes: LIST_ATTRIBUTES,
      // required:false (LEFT JOIN): many rows have a null top_cwid or one that matches no
      // current person row (stale/deleted identity) — those must stay in the unfiltered page,
      // not be silently dropped by the join. The include is attached unconditionally (not
      // only when body.institutions is set) so buildWhere's optional $Person.primaryInstitution$
      // reference always has a join to resolve against.
      // This is the ONE call site that widens the include's attributes: the identity hover card
      // needs the proposed person's institution, and the join is already here. See
      // personInstitutionInclude() for the measurements and for why the other two callers keep
      // the empty default.
      include: [personInstitutionInclude(false, ["primaryInstitution"])],
      where: buildWhere(body, absentCwids),
      order,
      offset,
      limit,
    });

    // Per-document sibling count, scoped to the active status-view. Two grouped COUNTs —
    // pubmed by pmid, scopus by external_id — so mixed-source pages stay accurate even
    // when siblings are off-page. (Book-level "N chapters" is a separate tab feature.)
    //
    // Deliberately NOT scoped by buildWhere (and so NOT given personInstitutionInclude
    // either) — `scope` only ever layers the status-view predicate on top of an exact
    // pmid/external_id match, on purpose: a sibling co-author already ignores personTypes,
    // pubTypes, precision, source, classification, hideNoSuggestion/hideNoIdentity, likeAuthor,
    // and the date range (none of those appear in `scope`'s output either), so an active
    // institution filter narrowing to one curated bucket must not make a real co-author from a
    // different institution disappear from "N others on this document" — that number describes
    // the document, not the currently-filtered slice of the queue looking at it.
    const status = openStatusWhere(body);
    const scope = (w: any) => (status ? { [Op.and]: [w, status] } : w);
    const pmids = [...new Set(rows.filter((r: any) => r.source !== "scopus" && r.pmid != null).map((r: any) => Number(r.pmid)))];
    const scopusIds = [...new Set(rows.filter((r: any) => r.source === "scopus" && r.external_id).map((r: any) => String(r.external_id)))];
    let pmidSib: Record<string, number> = {};
    let scopusSib: Record<string, number> = {};
    if (pmids.length) {
      const sib: any[] = await models.AuthorshipReview.findAll({
        attributes: ["pmid", [fn("COUNT", col("id")), "n"]],
        where: scope({ source: "pubmed", pmid: { [Op.in]: pmids } }),
        group: ["pmid"], raw: true,
      });
      pmidSib = Object.fromEntries(sib.map((s) => [String(s.pmid), Number(s.n)]));
    }
    if (scopusIds.length) {
      const sib: any[] = await models.AuthorshipReview.findAll({
        attributes: ["external_id", [fn("COUNT", col("id")), "n"]],
        where: scope({ source: "scopus", external_id: { [Op.in]: scopusIds } }),
        group: ["external_id"], raw: true,
      });
      scopusSib = Object.fromEntries(sib.map((s) => [String(s.external_id), Number(s.n)]));
    }
    const knownIdentities = await reciterIdentitySet(rows.map((r: any) => r.top_cwid));

    // T5: "Show N others like this" sibling count — one grouped COUNT over the OPEN queue
    // (always "open", not the caller's active statusView — the point of the button is to
    // surface open work to act on, whether the row you clicked it from is itself open, snoozed,
    // or dismissed), restricted to the normalized author keys THIS PAGE needs. Same shape as
    // the pmid_sibling_count grouped COUNTs just above, generalized from an exact pmid/
    // external_id match to authorKey()'s first-token/last-token equality (see buildWhere's
    // likeAuthor block and authorKey's own comment for why and its ceiling).
    const likeOpenWhere = openStatusWhere({ statusView: "open" });
    const pageAuthorKeys = [...new Set(rows.map((r: any) => authorKey(r.wcm_author)).filter(Boolean))];
    let likeCountMap: Record<string, number> = {};
    if (pageAuthorKeys.length) {
      const keyOr = pageAuthorKeys.map((k) => {
        const [first, last] = k.split("|");
        return { [Op.and]: [
          sqlWhere(fn("LOWER", fn("SUBSTRING_INDEX", col("wcm_author"), " ", 1)), first),
          sqlWhere(fn("LOWER", fn("SUBSTRING_INDEX", col("wcm_author"), " ", -1)), last),
        ] };
      });
      const likeSib: any[] = await models.AuthorshipReview.findAll({
        attributes: [
          [fn("LOWER", fn("SUBSTRING_INDEX", col("wcm_author"), " ", 1)), "first_tok"],
          [fn("LOWER", fn("SUBSTRING_INDEX", col("wcm_author"), " ", -1)), "last_tok"],
          [fn("COUNT", col("id")), "n"],
        ],
        where: { [Op.and]: [likeOpenWhere, { [Op.or]: keyOr }] },
        group: ["first_tok", "last_tok"], raw: true,
      });
      likeCountMap = Object.fromEntries(likeSib.map((s) => [`${s.first_tok}|${s.last_tok}`, Number(s.n)]));
    }

    // Cross-check pubmed rows' candidates + top_cwid against GoldStandard.rejectedpmids: a
    // candidate who already rejected this EXACT pmid via their own /curate page must never be
    // silently recommended as the lead candidate or accepted through the single-candidate
    // card — top_cwid/candidate_cwids_json are computed once at AAR producer time and never
    // cross-checked against gold standard otherwise. Scopus rows have no pmid, so this can
    // never apply to them (same reasoning as "scopus reject = local dismissal, never gold
    // standard" on the reject action below). candidateCwidsFromRow gives the exact
    // top_cwid+candidates union already used for reject/reopen. Purely additive/annotative
    // here, like identity_in_reciter above — no re-ranking, no dropped rows, no count change;
    // the frontend decides what to do visually.
    const pubmedRows = rows.filter((r: any) => r.source !== "scopus" && r.pmid != null);
    const rejectionCwids = new Set<string>();
    for (const r of pubmedRows) candidateCwidsFromRow(r).forEach((c) => rejectionCwids.add(c));
    const rejectionCheckIds = new Set(pubmedRows.map((r: any) => r.id));

    // §2.6 identity hover card: division comes from the IDM roster (its own indexed lookup over
    // this page's cwids), institution off the widened person join already on each row.
    //
    // Run WITH the gold-standard rejection lookup, not after it. The two share no input and no
    // output — one is a DynamoDB BatchGetItem against GoldStandard, the other an indexed IN()
    // over `identity` in MySQL — so awaiting them in sequence cost the page one whole extra
    // round-trip on every load for nothing (measured on dev: the divisions query is a 23 ms
    // range scan on a 25-row page, and it used to start only once DynamoDB had answered).
    // §4's rule: a correctness check is not a latency check.
    const [rejectedByCwid, divisions] = await Promise.all([
      getRejectedPmidsByCwid([...rejectionCwids]),
      identityDivisions(rows.map((r: any) => r.top_cwid)),
    ]);

    const out = rows.map((r: any) => {
      const map = r.source === "scopus" ? scopusSib : pmidSib;
      const json: any = r.toJSON();
      // The widened include lands as a nested `Person` object. Flatten it to one flat, stable
      // key alongside top_dept/top_name and drop the nested object, so the response shape stays
      // a flat row and the join's presence remains an implementation detail.
      const top_institution: string | null = json.Person?.primaryInstitution || null;
      delete json.Person;
      if (rejectionCheckIds.has(r.id)) {
        const pmidNum = Number(r.pmid);
        let candidates: any[] = [];
        try { candidates = JSON.parse(json.candidate_cwids_json || "[]"); } catch { candidates = []; }
        if (Array.isArray(candidates)) {
          json.candidate_cwids_json = JSON.stringify(candidates.map((c: any) => {
            if (!c || typeof c !== "object" || !c.cwid) return c;
            return rejectedByCwid[String(c.cwid)]?.has(pmidNum) ? { ...c, already_rejected: true } : c;
          }));
        }
        if (r.top_cwid && rejectedByCwid[String(r.top_cwid)]?.has(pmidNum)) {
          json.top_already_rejected = true;
        }
      }
      // T5: how many OTHER open rows share this row's normalized author key — subtract 1 only
      // when THIS row is itself part of the open-queue group the count above drew from (a
      // dismissed/snoozed-not-yet-lapsed row was never counted in the first place, so nothing
      // to subtract for it).
      const key = authorKey(r.wcm_author);
      const like_count = key ? Math.max(0, (likeCountMap[key] || 0) - (isRowOpenForLike(r) ? 1 : 0)) : 0;
      return {
        ...json,
        pmid_sibling_count: map[siblingKey(r)] || 1,
        // false → the proposed identity can't be accepted into ReCiter (UI hides Accept)
        identity_in_reciter: !r.top_cwid || knownIdentities.has(String(r.top_cwid)),
        // hover-card fields; null when unknown, never "" — the card omits the line entirely
        top_institution,
        top_division: (r.top_cwid && divisions[String(r.top_cwid)]) || null,
        like_count,
      };
    });

    res.send({ rows: out, count, limit, offset });
  } catch (e) {
    console.log(e);
    res.status(500).send(String(e));
  }
};

// POST /api/db/authorships/selectable — every bulk-selectable row matching the caller's
// filters, not just the current page, so "Select all N matching" can act on the whole set.
//
// Returns the slim shape the bulk accept loop needs, NOT the list shape: the list carries
// authors_json and candidate_cwids_json, which are longtext, and shipping those for a few
// thousand rows is megabytes to no purpose.
//
// Eligibility is recomputed here rather than trusted from the client, and it is the same
// tests the card enforces — a proposed identity exists on the row at all (#938 — ReCiterDB#177
// nulls top_cwid on rows the merged matcher no longer matches to anyone), single-candidate,
// that identity exists in ReCiter, and it has not already rejected this exact pmid. A row
// failing any of them is omitted, so it can never enter a bulk selection by way of this
// endpoint.
const SELECTABLE_CAP = 5000;

export const authorshipSelectable = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    // statusView is force-overridden to "open" (bulk actions only ever act on the open queue),
    // so a caller browsing the Identity-conflicts queue must have that narrowing carried across
    // the override as its own flag — otherwise "Select all N matching" would silently widen from
    // the conflicts slice to the entire open queue, i.e. act on rows the curator cannot see.
    const body = {
      ...(req.body || {}),
      identityConflicts: wantsIdentityConflicts(req.body),
      statusView: "open",
    };
    const absentCwids = body.hideNoIdentity ? await absentCwidSet() : undefined;
    const rows = await models.AuthorshipReview.findAll({
      attributes: ["id", "source", "pmid", "wcm_author", "top_name", "top_cwid", "single_candidate", "candidate_cwids_json"],
      // required:false — see listAuthorships's identical include for why (unmatched/absent
      // top_cwid rows must not be dropped when no institution filter is active).
      include: [personInstitutionInclude(false)],
      where: { [Op.and]: [buildWhere(body, absentCwids), { single_candidate: true }] },
      order: SORTS[body.sort] || SORTS.precision,
      limit: SELECTABLE_CAP + 1,
    });
    const capped = rows.length > SELECTABLE_CAP;
    const page = capped ? rows.slice(0, SELECTABLE_CAP) : rows;

    const knownIdentities = await reciterIdentitySet(page.map((r: any) => r.top_cwid));
    const pubmedRows = page.filter((r: any) => r.source !== "scopus" && r.pmid != null);
    const rejectionCwids = new Set<string>();
    for (const r of pubmedRows) candidateCwidsFromRow(r).forEach((c) => rejectionCwids.add(c));
    const rejectedByCwid = await getRejectedPmidsByCwid([...rejectionCwids]);

    const out = page
      // #938: was `!r.top_cwid || knownIdentities.has(...)` — vacuously true for a
      // no-suggestion row, which "Select all N matching" would then bulk-accept straight
      // into the same 409 the single-row card guards against. There is nothing to accept
      // without a proposed identity, known-to-ReCiter or not.
      .filter((r: any) => !!r.top_cwid && knownIdentities.has(String(r.top_cwid)))
      .filter((r: any) => !(r.source !== "scopus" && r.pmid != null && r.top_cwid
        && rejectedByCwid[String(r.top_cwid)]?.has(Number(r.pmid))))
      .map((r: any) => ({
        id: r.id, source: r.source, wcm_author: r.wcm_author, top_name: r.top_name,
        single_candidate: true, identity_in_reciter: true,
      }));

    res.send({ rows: out, capped, cap: SELECTABLE_CAP });
  } catch (e) {
    console.log(e);
    res.status(500).send(String(e));
  }
};

// POST /api/db/authorships/summary — counts for the tab headers. Ignores the
// segment/classification/precision/person-type/institution/article-affiliation filters so each
// facet shows its own total.
export const authorshipSummary = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    // authorAffiliations is neutralised alongside institutions and for the same reason: both
    // facets below must report their own queue-wide totals, not totals already narrowed by the
    // very selection the curator is about to change.
    const body = {
      ...(req.body || {}), source: "all", classification: "all", precision: "all",
      personTypes: [], pubTypes: [], institutions: [], authorAffiliations: [],
    };
    const absentCwids = body.hideNoIdentity ? await absentCwidSet() : undefined;
    const where = buildWhere(body, absentCwids);
    // The duplicates facet counts its own view, so it needs a where built with that statusView
    // rather than the caller's (the open-queue where excludes exactly the rows it counts).
    const dupWhere = buildWhere({ ...body, statusView: "duplicates" }, absentCwids);
    // Same for identity conflicts: the header pill and the QUEUE label must show the queue-wide
    // N no matter which queue is being browsed, so this one is built with the conflicts
    // narrowing forced ON and the status forced back to the open queue — never from the
    // caller's own view. (statusView itself still passes through to `where` above, so `total`
    // continues to describe the caller's current queue, exactly as it already does for
    // duplicates.)
    const conflictWhere = buildWhere(
      { ...body, statusView: "open", identityConflicts: true }, absentCwids,
    );
    // The 8 queries below do NOT get personInstitutionInclude() attached, unlike every other
    // buildWhere caller in this file — and this is deliberate, not an oversight. `where`/
    // `dupWhere` here can NEVER carry a $Person.primaryInstitution$ condition (institutions is
    // forced to [] on `body` above, before either is built), so the include has nothing to
    // resolve against. It was tried and reverted: attaching it made `id` ambiguous —
    // `person` has its own `id` column, so `fn("COUNT", col("id"))` broke the moment a LEFT
    // JOIN to `person` entered these queries (ER_NON_UNIQ_ERROR 1052), confirmed against the
    // live dev DB. The institution facet query just below is the one place in this endpoint
    // that legitimately needs the join, and it qualifies every column accordingly.
    const [total, single, fullname, duplicates, conflicts, byClass, byType, bySrc, byPub, byInstitution] = await Promise.all([
      models.AuthorshipReview.count({ where }),
      models.AuthorshipReview.count({ where: { [Op.and]: [where, { single_candidate: true }] } }),
      models.AuthorshipReview.count({ where: { [Op.and]: [where, { single_candidate: true, top_given_match: "full" }] } }),
      models.AuthorshipReview.count({ where: dupWhere }),
      // Identity conflicts. No include needed and none wanted: identityConflictWhere() is an
      // EXISTS subquery against person_article and touches no joined table, so the ambiguous-`id`
      // trap documented above does not apply and this stays a plain COUNT over authorship_review.
      models.AuthorshipReview.count({ where: conflictWhere }),
      models.AuthorshipReview.findAll({ attributes: ["classification", [fn("COUNT", col("id")), "n"]], where, group: ["classification"], raw: true }),
      models.AuthorshipReview.findAll({ attributes: ["top_person_type", [fn("COUNT", col("id")), "n"]], where, group: ["top_person_type"], raw: true }),
      models.AuthorshipReview.findAll({ attributes: ["source", [fn("COUNT", col("id")), "n"]], where, group: ["source"], raw: true }),
      models.AuthorshipReview.findAll({ attributes: ["pub_type", [fn("COUNT", col("id")), "n"]], where: { [Op.and]: [where, { source: "scopus" }] }, group: ["pub_type"], raw: true }),
      // Institution facet: grouped by the joined Person row, required:true (INNER JOIN) unlike
      // every other include in this file — a row whose top_cwid is null or matches no current
      // person row has no institution to bucket, and (unlike the general list/selectable
      // queries, where that same row must still appear in an unfiltered page) contributing
      // nothing to this specific grouped count is correct, not a loss. Both columns are
      // explicitly table-qualified (Person.primaryInstitution / AuthorshipReview.id) — the
      // ambiguous-`id` trap noted above applies here too, just already avoided.
      // One conditional-SUM pass per bucket instead of GROUP BY, so the same query serves all
      // three bases. required:false (LEFT JOIN) because a byline can name an institution even
      // when top_cwid matches no person row — an INNER JOIN would silently drop exactly the
      // rows the byline basis exists to surface. Measured on production: the 12 LIKE patterns
      // cost ~690 ms over the open rows, which the facet already tolerates.
      //
      // TWO facets now come out of this ONE query. `institutions` keeps its existing basis
      // (whatever the caller asks for, default "either") and feeds the Identity-affiliation
      // list; the `byline_`-prefixed columns feed the new Article-affiliation list, which is
      // always the byline basis by definition. When the caller's basis IS "byline" the two are
      // the same numbers, so the extra columns are skipped and both facets read the same ones.
      // Combining beats a second query — dev DB, over the open queue: 12 SUMs (either) 315 ms,
      // 24 SUMs 534 ms, 12 SUMs (byline) 322 ms.
      models.AuthorshipReview.findAll({
        attributes: [
          ...institutionFacetAttributes(normaliseBasis(body.institutionBasis)),
          ...(normaliseBasis(body.institutionBasis) === "byline"
            ? [] : institutionFacetAttributes("byline", "byline_")),
        ],
        include: [personInstitutionInclude(false)],
        where, raw: true,
      }),
    ]);
    const classes: Record<string, number> = {};
    (byClass as any[]).forEach((r) => { classes[r.classification] = Number(r.n); });
    const bySource: Record<string, number> = {};
    (bySrc as any[]).forEach((r) => { bySource[r.source] = Number(r.n); });
    const personTypes = (byType as any[]).filter((r) => r.top_person_type).map((r) => ({ type: r.top_person_type as string, n: Number(r.n) })).sort((a, b) => b.n - a.n);
    const pubTypes = (byPub as any[]).filter((r) => r.pub_type).map((r) => ({ type: r.pub_type as string, n: Number(r.n) })).sort((a, b) => b.n - a.n);
    // Bucket the raw primaryInstitution strings the grouped query returned back into
    // INSTITUTION_BUCKETS' keys, summing counts for a bucket with more than one literal string
    // (wcm has two — "Weill Cornell Medicine" and "Weill Cornell Medical College"). A raw
    // institution not named by any bucket (e.g. "Rockefeller University", below the curated
    // list's ~100-person cutoff) simply never gets added to any sum — dropped, not shown as
    // "Other".
    // the conditional-SUM query returns a single row, one column per bucket key
    const facetRow: Record<string, any> = ((byInstitution as any[])[0]) || {};
    const bucketCounts = (prefix: string) => Object.keys(INSTITUTION_BUCKETS)
      .map((key) => ({ key, n: Number(facetRow[`${prefix}${key}`] || 0) }))
      .filter((b) => b.n > 0)
      .sort((a, b) => b.n - a.n);
    const institutions = bucketCounts("");
    // Article-affiliation facet — same bucket keys, counted on the byline basis. Shares the
    // prefix-free columns when the caller's own basis is already "byline" (see the query).
    const authorInstitutions = bucketCounts(
      normaliseBasis(body.institutionBasis) === "byline" ? "" : "byline_",
    );
    res.send({
      total, single_candidate: single, fullname, duplicates, conflicts,
      classes, personTypes, bySource, pubTypes, institutions, authorInstitutions,
    });
  } catch (e) {
    console.log(e);
    res.status(500).send(String(e));
  }
};

// POST /api/db/authorships/prior-names — every byline form a cwid has already published under,
// for §2.6's identity hover card ("NAMES ON ACCEPTED PAPERS"). This is the one piece of the
// card that answers the curator's actual question — "does the name printed on THIS paper look
// like the names this person already publishes under?" — so a homonym row shows "Kristy A
// Brown / Kristy Brown / K A Brown" and not just a department.
//
// Source is person_article: articleAuthorNameFirstName/LastName is the byline ReCiter matched,
// and userAssertion='ACCEPTED' is the curator-confirmed subset (the table also holds PENDING
// suggestions, userAssertion='', which are emphatically not evidence of how someone publishes).
//
// Safe to call on hover, by construction rather than by hope:
//  - Batched. The card is per-row but a page has 25 rows, so the client can warm the whole page
//    in one call; CWID_CAP bounds a hostile or buggy caller.
//  - Index-driven. WHERE personIdentifier IN (...) rides the (personIdentifier, pmid) index —
//    EXPLAIN on the dev DB gives type=range, key=personIdentifier, rows=873 for a 10-cwid probe,
//    39 ms including the GROUP BY. userAssertion has NO index of its own, which is exactly why
//    it is applied as a filter on the rows that index already narrowed to: a query that leads
//    with userAssertion instead scans all 745,994 rows (measured: 31,853 ms).
//  - Capped per cwid. NAME_CAP forms are returned, most frequent first, with `more` saying how
//    many distinct forms were dropped — the card shows a handful, not a life's bibliography.
//
// `accepted` is returned alongside `names` because they answer different questions and the card
// needs both: a cwid with accepted papers whose byline names are all blank (4,449 person_article
// rows WITH userAssertion='ACCEPTED' carry an empty articleAuthorNameLastName) has names:[] but
// accepted>0, and must NOT be rendered as the mockup's "No accepted papers yet" — that line
// belongs to accepted===0 alone.
// The ACCEPTED qualifier is the whole claim: 5,662 is the count over ALL assertion states, and
// 1,213 of those are PENDING or REJECTED rows this endpoint never reads (dev DB 2026-09-04:
// 5,662 total = 4,449 ACCEPTED + 713 REJECTED + 500 pending, which this table stores as '' not 'PENDING'). Do not quote the wider number here.
const PRIOR_NAMES_CWID_CAP = 50;
const PRIOR_NAMES_NAME_CAP = 8;

export const authorshipPriorNames = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const raw: any[] = Array.isArray(req.body?.cwids)
      ? req.body.cwids
      : (req.body?.cwid ? [req.body.cwid] : []);
    const cwids = [...new Set(raw.map((v: any) => String(v || "").trim()).filter(Boolean))]
      // same shape gate authorshipLookupCwid applies to a typed cwid — a value that cannot be a
      // cwid cannot match a row, so it is dropped rather than sent to the database.
      .filter((c) => /^[A-Za-z0-9]{1,32}$/.test(c))
      .slice(0, PRIOR_NAMES_CWID_CAP);
    if (!cwids.length) return res.send({ names: {}, accepted: {} });

    const rows: any[] = await models.PersonArticle.findAll({
      attributes: [
        "personIdentifier", "articleAuthorNameFirstName", "articleAuthorNameLastName",
        [fn("COUNT", col("id")), "n"],
      ],
      where: { personIdentifier: { [Op.in]: cwids }, userAssertion: "ACCEPTED" },
      group: ["personIdentifier", "articleAuthorNameFirstName", "articleAuthorNameLastName"],
      raw: true,
    });

    const names: Record<string, Array<{ first: string; last: string; n: number }>> = {};
    const accepted: Record<string, number> = {};
    const dropped: Record<string, number> = {};
    for (const r of rows) {
      const cwid = String(r.personIdentifier);
      const n = Number(r.n) || 0;
      accepted[cwid] = (accepted[cwid] || 0) + n;
      const first = String(r.articleAuthorNameFirstName || "").trim();
      const last = String(r.articleAuthorNameLastName || "").trim();
      if (!first && !last) continue;   // nameless accepted rows still count toward `accepted`
      (names[cwid] ||= []).push({ first, last, n });
    }
    for (const cwid of Object.keys(names)) {
      names[cwid].sort((a, b) => b.n - a.n || `${a.last}${a.first}`.localeCompare(`${b.last}${b.first}`));
      if (names[cwid].length > PRIOR_NAMES_NAME_CAP) {
        dropped[cwid] = names[cwid].length - PRIOR_NAMES_NAME_CAP;
        names[cwid] = names[cwid].slice(0, PRIOR_NAMES_NAME_CAP);
      }
    }
    // Every requested cwid gets an entry, so the client can tell "asked and has none" from
    // "never asked" without tracking its own request bookkeeping.
    for (const c of cwids) { names[c] ||= []; accepted[c] ||= 0; }
    res.send({ names, accepted, more: dropped });
  } catch (e) {
    console.log(e);
    res.status(500).send(String(e));
  }
};

// POST /api/db/authorships/recent-activity — the 15 most-recently-resolved authorships across
// the whole queue. accept/assign/reject/dismiss all stamp resolved_at (reopen clears it back
// to null; snooze never sets it), so filtering on resolved_at IS NOT NULL is exactly those four
// terminal curator actions. Global and cross-curator/cross-session (unlike the per-person
// /curate "Recent activity" panel, which reads AdminFeedbackLog for one uid) — once a row here
// leaves the open/snoozed/dismissed status views it has no other view on the page, so this is
// the only lookback for "what did curators just do". Fixed-size feed, no filters/pagination —
// mirrors summary.ts's simplicity; body is accepted but ignored.
export const authorshipRecentActivity = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const rows: any[] = await models.AuthorshipReview.findAll({
      attributes: ["id", "title", "wcm_author", "top_name", "top_cwid", "resolution_cwid", "status", "reviewer", "resolved_at", "source", "pmid", "external_id"],
      where: { resolved_at: { [Op.ne]: null } },
      order: [["resolved_at", "DESC"]],
      limit: 15,
      raw: true,
    });
    // top_name is the *top-ranked candidate's* name, which is the wrong person the moment a
    // curator assigns to a non-top candidate — the entire point of "Pick one" on a homonym
    // row. The panel links resolution_cwid, so send that identity's own name alongside it and
    // the two can't disagree (#928). One extra IN() lookup for at most 15 cwids. reject and
    // dismiss never set resolution_cwid and top_name is right there, so the client picks
    // per-row rather than swapping wholesale.
    const names = await personNames(rows.map((r) => r.resolution_cwid));
    rows.forEach((r) => { r.resolution_name = r.resolution_cwid ? names[String(r.resolution_cwid)] : undefined; });
    res.send({ rows });
  } catch (e) {
    console.log(e);
    res.status(500).send(String(e));
  }
};

// ---- Phase C: curator actions -------------------------------------------------
// Resolve the curator's identity server-side from the next-auth JWT. On dev the /api
// routes are gated by the shared backendApiKey and the page by middleware; the per-route
// Superuser/Curator_All authz (getEffectiveRolesScope) is a dev_Upd-only feature not on
// this branch, so we match dev's backendApiKey-only convention and stamp the audit
// identity (curatedBy / reviewer / addedBy) from the real signed-in AdminUser.
// ponytail: no in-endpoint role gate — page middleware + backendApiKey + a resolvable
// active AdminUser are the trust boundary here; add a role check if dev is hardened.
async function resolveCurator(req: NextApiRequest): Promise<{ userID?: number; cwid?: string }> {
  const token: any = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return {};
  const cwid: string | undefined = token.username ? String(token.username) : undefined;
  let userID: number | undefined = token.databaseUser?.userID;
  if (!userID && cwid) {
    const au: any = await models.AdminUser.findOne({ where: { personIdentifier: cwid }, attributes: ["userID"] });
    userID = au?.userID;
  }
  return { userID, cwid };
}

// Gold-standard MERGE/DELETE via the ReCiter Java endpoint (pubmed rows only), tagged with
// the AAR source and the curator's numeric userID. Returns the upstream HTTP status.
async function writeGoldStandard(
  uid: string, pmid: number, kind: "known" | "rejected", flag: "UPDATE" | "DELETE", curatedBy?: number,
): Promise<number> {
  const body: any = { uid };
  if (kind === "known") body.knownPmids = [pmid]; else body.rejectedPmids = [pmid];
  const curatedByQ = curatedBy != null ? `&curatedBy=${curatedBy}` : "";
  try {
    const resp = await fetch(
      `${reciterConfig.reciter.reciterUpdateGoldStandardEndpoint}?goldStandardUpdateFlag=${flag}&source=adversarial-attribution-review&entryPath=PM_AUTHOR${curatedByQ}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": reciterConfig.reciter.adminApiKey,
          "User-Agent": "reciter-pub-manager-server",
        },
        body: JSON.stringify(body),
      },
    );
    return resp.status;
  } catch (e) {
    console.log("[authorships] gold-standard write failed:", e);
    return 500;
  }
}

// Append an AdminFeedbackLog row (pubmed accept/reject/assign only — PMID-keyed).
async function appendFeedbackLog(userID: number, personIdentifier: string, pmid: number, feedback: "ACCEPTED" | "REJECTED") {
  const active: any = await models.AdminUser.findOne({ where: { userID, status: 1 }, attributes: ["userID"] });
  if (!active) throw new Error(`userID ${userID} is not an active AdminUser`);
  await models.AdminFeedbackLog.create({
    userID, personIdentifier, articleIdentifier: pmid, feedback, createTimestamp: new Date(),
  });
  await updatePendingArticleCount(personIdentifier, feedback);
}

// Interpret a 409 dup-conflict body from the ExternalArticle add. BLOCKED = the article is
// already in the person's record (ALREADY_ADDED, or a PMID/DOI match to an attributed
// article) — ReCiter ignores force for BLOCKED, so the accept's end state already exists
// and the caller should resolve the row as accepted instead of bouncing forever. (Dev and
// prod PM share one DynamoDB ExternalArticle table but have separate review queues, so a
// row accepted in one env stays open in the other and re-accepting it lands here.)
// WARNING = fuzzy title+year match the curator may force; surface its human message.
//
// `matches` is passed through structurally (type/matchedId/detail, plus title/journal/
// pubYear once ReCiter#705 ships) instead of being collapsed to a bare id — the client
// renders the real conflict context instead of a number nobody can act on.
function dupConflict(body: any): { blocked: boolean; message: string; matches: any[] } {
  return {
    blocked: body?.status === "BLOCKED",
    message: body?.message || "Possible duplicate.",
    matches: Array.isArray(body?.matches) ? body.matches : [],
  };
}

// Full byline from authors_json ([{given,surname}, ...], every author on the document) as
// "Given Surname" strings — undefined if the field is empty/absent, unparseable, or parses
// to a non-array/empty array, so the ExternalArticle payload just omits `authors` rather
// than sending a malformed value.
function scopusAuthorsFromRow(row: any): string[] | undefined {
  if (!row.authors_json) return undefined;
  let parsed: any;
  try {
    parsed = JSON.parse(row.authors_json);
  } catch {
    return undefined;
  }
  if (!Array.isArray(parsed)) return undefined;
  const names = parsed
    .map((a: any) => {
      const given = (a?.given || "").trim();
      const surname = (a?.surname || "").trim();
      if (given && surname) return `${given} ${surname}`;
      return given || surname || "";
    })
    .filter(Boolean);
  return names.length ? names : undefined;
}

// ExternalArticle payload for a scopus row (no PMID → not gold standard). articleId is
// "SCOPUS:<numericId>" where numericId = external_id (dc:identifier minus SCOPUS_ID:).
function scopusExternalPayload(row: any) {
  return {
    articleId: `SCOPUS:${row.external_id}`,
    sourceType: "SCOPUS",
    method: "scopus-authorships-tab",
    doi: row.doi || undefined,
    title: row.title || undefined,
    journalOrVenue: row.journal || undefined,
    pubDate: row.entrez_date || undefined,
    publicationType: row.pub_type || undefined,
    authors: scopusAuthorsFromRow(row),
  };
}

// POST /api/db/authorships/authors — batched authors_json lookup by Scopus external_id,
// for the Curate per-source "Scopus" tab (SourceArticleTab) to backfill a display byline
// on rows accepted before scopusExternalPayload() started sending `authors` natively
// (rows whose ExternalArticle payload has no authors key at all). Body: { externalIds:
// string[] }. Response: { authors: { [external_id]: authors_json | null } } — the raw
// column value, left for the client to parse the same way AuthorshipsTabs does, since
// the client is what actually renders the byline.
export const authorshipsAuthorsByExternalId = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const externalIds: string[] = Array.isArray(req.body?.externalIds)
      ? [...new Set<string>(req.body.externalIds.map((v: any) => String(v)).filter(Boolean))]
      : [];
    if (!externalIds.length) return res.send({ authors: {} });

    const rows = await models.AuthorshipReview.findAll({
      attributes: ["external_id", "authors_json"],
      where: { source: "scopus", external_id: { [Op.in]: externalIds } },
      raw: true,
    });

    const authors: Record<string, string | null> = {};
    (rows as any[]).forEach((r) => {
      if (r.external_id) authors[String(r.external_id)] = r.authors_json || null;
    });
    res.send({ authors });
  } catch (e) {
    console.log(e);
    res.status(500).send(String(e));
  }
};

// Every candidate identity a row was proposed against (top_cwid + candidate_cwids_json,
// deduped) — the full set "None of these" rejects and reopen() un-rejects.
function candidateCwidsFromRow(row: any): string[] {
  let parsed: any[] = [];
  try { parsed = JSON.parse(row.candidate_cwids_json || "[]"); } catch { parsed = []; }
  const list = Array.isArray(parsed)
    ? parsed.map((c: any) => (typeof c === "string" ? c : c?.cwid)).filter(Boolean).map(String)
    : [];
  return Array.from(new Set([row.top_cwid, ...list].filter(Boolean).map(String)));
}

// The live half of homonymRejections(): which of this row's non-chosen candidates may be
// recorded as rejecting `pmid`. Both facts are re-established here rather than trusted from the
// row, because both move after the producer wrote it — people leave WCM (the identity goes
// away) and people curate their own /curate page (an acceptance appears).
//
// F-2 policy (verbatim from the product owner: "If I accept it for 1 person, any other person
// being considered should be a reject. This goes across the board") — single-candidate rows are
// no longer exempt. A row's one proposed candidate getting DISPLACED (the curator assigns
// elsewhere instead) is exactly as much of a "not mine" as a multi-candidate homonym losing to a
// sibling; `others.length === 0` already covers the only real no-op (the assign target IS the
// row's sole candidate — an ordinary accept-shaped pick), so there was nothing left for a
// `row.single_candidate` check to usefully exclude. `singleCandidate` is therefore always passed
// false to homonymRejections() below now — see that function's own doc in assignGate.ts for why
// the parameter still exists there (its pure branch table, singleCandidate included, is asserted
// directly by scripts/check-homonym-rejections.mjs against callers that still want it).
//
// Candidate cwids come out of the producer, not out of a keyboard, and all 11,389 of them are
// lowercase (2026-08-29), so unlike the typed `chosen` above they need no canonicalisation —
// and if one ever failed a byte-exact DynamoDB lookup it would simply be skipped, which is the
// safe direction. `target` is already canonical, so `c !== target` compares like with like.
// ponytail: two point lookups per assign, no cache — a homonym row has a median of 2 other
// candidates and even a single-candidate row has exactly one, so this is ~20 ms on the rarest
// action in the tab.
async function homonymRejectionTargets(
  row: any, target: string, pmid: number, checkAccepted = true,
): Promise<string[]> {
  const candidates = candidateCwidsFromRow(row);
  const isScopus = row.source === "scopus";
  const others = candidates.filter((c) => c !== target);
  // Scopus has no pmid to reject (gold standard is PMID-keyed — same precedent as case
  // "reject"'s scopus branch), and a row whose only candidate IS the assign target has nobody
  // left to displace. Nothing else is excluded here anymore — see the F-2 note above.
  if (isScopus || others.length === 0) return [];
  const [identities, accepted] = await Promise.all([
    reciterIdentitySet(others),
    checkAccepted ? getKnownPmidsByCwid(others) : Promise.resolve({} as Record<string, Set<number>>),
  ]);
  return homonymRejections({
    isScopus, singleCandidate: false, candidates, target,
    hasIdentity: (c) => identities.has(c),
    hasAccepted: (c) => !!accepted[c]?.has(pmid),
  });
}

// POST /api/db/authorships/action — single-row curator action.
// body: { id, action: "accept"|"reject"|"snooze"|"dismiss"|"assign"|"reopen", cwid?, force? }
// cwid is required only for "assign"; force retries a scopus Accept past a 409 WARNING.
export const authorshipAction = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const curator = await resolveCurator(req);
    if (!curator.userID) return res.status(401).send("Could not resolve curator identity");

    const body = req.body || {};
    const id = Number(body.id);
    const action = String(body.action || "");
    if (!id || !action) return res.status(400).send("id and action are required");

    const row: any = await models.AuthorshipReview.findByPk(id);
    if (!row) return res.status(404).send("Authorship not found");

    const isScopus = row.source === "scopus";
    const pmid = row.pmid != null ? Number(row.pmid) : null;
    const cwid = row.top_cwid as string | undefined;
    const reviewer = curator.cwid || String(curator.userID);
    const force = String(body.force) === "true";

    switch (action) {
      case "accept": {
        if (!cwid) return res.status(409).send("No proposed identity to accept");
        // JSON (not plain text) so the client can route this into the inline conflict banner
        // and silently refetch the row instead of the generic "nothing was saved" toast — see
        // the card predicate at AuthorshipsTabs.tsx (isMulti) and the kind dispatch below it.
        if (!row.single_candidate) return res.status(409).json({ code: "MULTI_CANDIDATE", message: "Multiple candidates — use \"Pick one\" to assign" });
        // 422 (not 409) so the client's scopus force-add prompt doesn't fire for this
        if (!(await reciterIdentitySet([cwid])).size) {
          return res.status(422).send(`${row.top_name || cwid} has no record in ReCiter's Identity table, so there is nothing to add this authorship to — dismiss it instead`);
        }
        if (isScopus) {
          const resp = await addExternalArticle(cwid, scopusExternalPayload(row), reviewer, force);
          if (resp.statusCode === 409) {
            const dup = dupConflict(resp.statusText);
            // BLOCKED → already in the record: fall through and resolve the row as accepted
            if (!dup.blocked) {
              // Persist the WARNING so the row leaves the open queue for the "Possible
              // duplicates" view instead of sitting back in the feed to be re-attempted.
              // Session-scoped conflictLog state already showed this to the curator who hit
              // it; the column is what survives a refresh, another curator, and a bulk run.
              await models.AuthorshipReview.update(
                { accept_conflict: String(dup.message).slice(0, 500) }, { where: { id } });
              return res.status(409).json({ message: dup.message, matches: dup.matches });
            }
          } else if (resp.statusCode !== 201 && resp.statusCode !== 200) {
            return res.status(502).send(`ExternalArticle add failed (${resp.statusCode})`);
          }
          await models.AuthorshipReview.update({ status: "accepted", resolution_cwid: cwid, reviewer, resolved_at: new Date() }, { where: { id } });
          break; // no AdminFeedbackLog / pending-count for scopus (PMID-keyed)
        }
        // Data-integrity guard: never let an accept add pmid to knownpmids while it's still
        // sitting in rejectedpmids for the same identity (see goldStandardRejections.ts).
        if ((await getRejectedPmidsByCwid([cwid]))[cwid]?.has(pmid as number)) {
          return res.status(409).send(`${row.top_name || cwid} already rejected this article — cannot accept without reviewing that rejection first`);
        }
        const gs = await writeGoldStandard(cwid, pmid as number, "known", "UPDATE", curator.userID);
        if (gs !== 200) return res.status(502).send(`Gold-standard write failed (${gs})`);
        await models.AuthorshipReview.update({ status: "accepted", resolution_cwid: cwid, reviewer, resolved_at: new Date() }, { where: { id } });
        try { await appendFeedbackLog(curator.userID, cwid, pmid as number, "ACCEPTED"); }
        catch (e) { console.log("[authorships] feedbacklog (accept) non-fatal:", e); }
        break;
      }
      case "assign": {
        const chosen = String(body.cwid || "");
        if (!chosen) return res.status(400).send("cwid is required for assign");
        if (!/^[A-Za-z0-9]{1,32}$/.test(chosen)) return res.status(400).send("cwid must be alphanumeric");
        // Trust boundary: `chosen` is client-supplied and can drive an authoritative
        // GoldStandard write, so the server establishes two facts about it — is it one of
        // this authorship's produced candidates, and does ReCiter know it at all — and
        // assignGate turns them into which path runs. Neither fact BLOCKS the assign any
        // more (#925 opened the no-identity one, this change opens off-candidate); being on
        // the wrong side of either one costs a confirm round-trip instead.
        const allowed = new Set(candidateCwidsFromRow(row));
        // Both facts are established about `target`, the identifier as ReCiter STORES it, not
        // about the raw keystrokes — and so is every write below. DynamoDB keys are byte-exact
        // and Set.has is case-sensitive, so before this a curator who typed "Aaa2014" for a row
        // whose own top_cwid is "aaa2014" was told that person has no ReCiter identity, and
        // confirming filed the authorship as a local-only record that never reaches their
        // publication list. Asking for the typed form and its lowercase together costs one extra
        // key in the same BatchGetItem, and nothing at all when the cwid is already lowercase
        // (reciterIdentitySet dedupes). See canonicalCwid for why an exact hit beats the
        // lowercased one rather than the other way round.
        const found = await reciterIdentitySet([chosen, chosen.toLowerCase()]);
        const target = canonicalCwid(chosen, found);
        const offCandidate = !allowed.has(target);
        const hasIdentity = found.has(target);
        const gate = assignGate({
          offCandidate, hasIdentity,
          confirmNoIdentity: String(body.confirmNoIdentity) === "true",
          confirmOffCandidate: String(body.confirmOffCandidate) === "true",
        });
        // Not every WCM author has an identity record. Master's students, visiting
        // researchers, and any person type outside the identity feed never get one, and
        // since the AAR producer builds its candidate list FROM `identity`, such a person
        // can never be a produced candidate either — so for them the candidate check is
        // unsatisfiable by construction and is deliberately bypassed. Before #925 the only
        // offer was "dismiss it instead", which throws a real attribution away.
        //
        // Deliberate, not silent: an unrecognised cwid is still far more likely to be a
        // typo than a Master's student, so the #861 guard keeps its purpose. The client
        // re-sends with confirmNoIdentity after showing the curator what it means.
        if (gate === "confirm_no_identity") {
          // F-2: name who this ALSO rejects, up front — the assignee having no identity does
          // not exempt this row's other candidate(s) from the same policy the write below
          // applies. Preview only (this is a 422, nothing is written yet), computed through the
          // same homonymRejectionTargets() the write and reopen both use, so the confirm can
          // never promise a different set than what actually lands.
          const alsoRejected = await homonymRejectionTargets(row, target, pmid as number);
          let alsoRejectedNote = "";
          if (alsoRejected.length) {
            const names = await Promise.all(alsoRejected.map(async (c) => {
              const who = await identityLabel(c);
              return who ? `${who} (${c})` : c;
            }));
            alsoRejectedNote = ` It also records "not mine" for ${names.join(", ")}.`;
          }
          return res.status(422).json({
            code: "NO_RECITER_IDENTITY",
            localOnly: true,
            cwid: target,
            offCandidate,
            alsoRejected,
            message: `${target} has no ReCiter identity. Assigning anyway records your decision on `
              + "this row only — it will NOT be added to the person's publication record, because there "
              + `is no identity to add it to.${alsoRejectedNote} Confirm to proceed.`,
          });
        }
        // Data-integrity guard, the same direction as the rejectedpmids one ~60 lines down but
        // for the opposite list: don't let an assign write a no-op gold-standard merge (plus a
        // bogus ACCEPTED FeedbackLog row) over a target who already has THIS pmid in knownpmids
        // — most often because they took it on their own /curate page while this row, naming
        // them as one of several candidates, sat open. That's reachable from an on-candidate
        // assign with no confirm step in front of it at all (gate goes straight to "write"),
        // which is why this runs here rather than inside confirm_off_candidate below — 454 open
        // rows are in this shape as of 2026-08-30, so it is not rare. hasIdentity gates it
        // because gate can also be "local_only" here (confirmed, no identity), and there is no
        // knownpmids to speak of for a cwid ReCiter has no Identity record for.
        if (hasIdentity && !isScopus && pmid != null
          && (await getKnownPmidsByCwid([target]))[target]?.has(pmid)) {
          return res.status(422).send(
            `${target} already has this article as ACCEPTED — assigning again would just be a `
            + "no-op merge. Dismiss this row instead.");
        }
        // A real person the producer simply didn't propose — the common case being a
        // single-candidate row where the producer was confidently wrong and the curator knows
        // who actually wrote it. This used to be a flat 400, which made the typed-cwid box a
        // no-identity escape hatch rather than a general assign tool. It is still a trust
        // boundary (a client-supplied cwid driving a GoldStandard write), so it becomes an
        // explicit confirm rather than an absent check: the server looks the person up and
        // hands back their NAME, so the curator confirms against a human being and not a
        // string they might have typo'd.
        // ponytail: confirm-on-submit, not a typeahead — the name has to cross the wire on
        // this 422 anyway, so a search endpoint + debounce + dropdown would buy nothing the
        // round-trip doesn't already provide here. (B-8: that endpoint now exists —
        // authorshipLookupCwid above, over this same identityLabel()/canonicalCwid() path —
        // but it's wired to the BULK confirm dialog, which has no 422 round-trip to piggyback
        // on; this single-row confirm-on-submit is unchanged and still doesn't need it.)
        if (gate === "confirm_off_candidate") {
          const who = await identityLabel(target);
          return res.status(422).json({
            code: "OFF_CANDIDATE",
            cwid: target,
            offCandidate: true,
            message: `${who ? `${who} · ${target}` : `${target} (no name on file anywhere — check the identifier)`}`
              + " was not one of the candidates proposed for this authorship. Confirming ADDS this article "
              + "to that person's publication record — the same write an Accept makes. Check the identifier.",
          });
        }
        if (gate === "local_only") {
          // Local record only for the ASSIGNEE. No writeGoldStandard, no addExternalArticle, no
          // appendFeedbackLog for THEM: every one of those targets an identity that does not
          // exist, and faking one would put a publication in a record nobody can see or
          // correct. This preserves the curator's judgment without pretending the person
          // exists downstream. If the identity is created later (PM#104 / IC#148), this row is
          // the record of what was already decided.
          //
          // F-2 runs anyway for the OTHER candidates: the assignee having no ReCiter identity
          // doesn't make this any less a homonym judgment for whoever else was proposed and
          // DOES have one — the curator is still saying "not this row's other candidate(s)".
          // Same function, same writes, same feedback log as the authoritative "write" path
          // below; the rejections go before the row is resolved for the same idempotent-retry
          // reason that block explains (there is no positive write here to sequence them after).
          const alsoRejected = await homonymRejectionTargets(row, target, pmid as number);
          for (const other of alsoRejected) {
            const rs = await writeGoldStandard(other, pmid as number, "rejected", "UPDATE", curator.userID);
            if (rs !== 200) return res.status(502).send(`Homonym rejection write failed for ${other} (${rs})`);
          }
          await models.AuthorshipReview.update({
            status: "assigned", resolution_cwid: target, reviewer, resolved_at: new Date(),
            note: `${row.note ? `${row.note} | ` : ""}assigned to ${target} `
              + `(no ReCiter identity) — ${LOCAL_ONLY_MARKER}`,
          }, { where: { id } });
          for (const other of alsoRejected) {
            try { await appendFeedbackLog(curator.userID, other, pmid as number, "REJECTED"); }
            catch (e) { console.log("[authorships] feedbacklog (homonym reject) non-fatal:", e); }
          }
          break;
        }
        // gate === "write": everything below is the authoritative assign, unchanged. An
        // off-candidate assign that got confirmed lands here and is byte-for-byte an
        // on-candidate one — same rejectedpmids guard, same gold-standard write, same
        // feedback log — which is also what keeps `reopen` sound: it has an identity, so
        // reopen's "no identity == it was local-only" inference still holds and the
        // gold-standard DELETE it does is exactly the write this made.
        if (isScopus) {
          const resp = await addExternalArticle(target, scopusExternalPayload(row), reviewer, force);
          if (resp.statusCode === 409) {
            const dup = dupConflict(resp.statusText);
            if (!dup.blocked) return res.status(409).json({ message: dup.message, matches: dup.matches });
          } else if (resp.statusCode !== 201 && resp.statusCode !== 200) {
            return res.status(502).send(`ExternalArticle add failed (${resp.statusCode})`);
          }
          await models.AuthorshipReview.update({ status: "assigned", resolution_cwid: target, reviewer, resolved_at: new Date() }, { where: { id } });
          break;
        }
        // Data-integrity guard: never let an assign add pmid to knownpmids while it's still
        // sitting in rejectedpmids for the same identity (see goldStandardRejections.ts).
        if ((await getRejectedPmidsByCwid([target]))[target]?.has(pmid as number)) {
          return res.status(409).send(`${target} already rejected this article — cannot assign without reviewing that rejection first`);
        }
        const gs = await writeGoldStandard(target, pmid as number, "known", "UPDATE", curator.userID);
        if (gs !== 200) return res.status(502).send(`Gold-standard write failed (${gs})`);
        // ...and the other homonyms. Same write "None of these" makes for each of them, so
        // /curate, the feedback log and the model all see an ordinary curator "not mine"
        // rather than a new kind of record. See homonymRejections() for what it excludes.
        //
        // Ordering is load-bearing. The positive write goes first because it is the curator's
        // actual intent: if IT fails, nobody has been rejected for a paper that was never
        // assigned to anyone. A rejection failing after it 502s and leaves the row open —
        // `case "reject"`'s shape — which is safe here because every write in this block is an
        // idempotent MERGE: the curator clicks Assign again, the ones that landed re-land as
        // no-ops, and only the one that failed actually writes. The alternative (resolve the
        // row and log the rejection failure) would bury a half-written decision where nothing
        // in the queue can find it again.
        const alsoRejected = await homonymRejectionTargets(row, target, pmid as number);
        for (const other of alsoRejected) {
          const rs = await writeGoldStandard(other, pmid as number, "rejected", "UPDATE", curator.userID);
          if (rs !== 200) return res.status(502).send(`Homonym rejection write failed for ${other} (${rs})`);
        }
        await models.AuthorshipReview.update({ status: "assigned", resolution_cwid: target, reviewer, resolved_at: new Date() }, { where: { id } });
        try { await appendFeedbackLog(curator.userID, target, pmid as number, "ACCEPTED"); }
        catch (e) { console.log("[authorships] feedbacklog (assign) non-fatal:", e); }
        for (const other of alsoRejected) {
          try { await appendFeedbackLog(curator.userID, other, pmid as number, "REJECTED"); }
          catch (e) { console.log("[authorships] feedbacklog (homonym reject) non-fatal:", e); }
        }
        break;
      }
      case "reject": {
        if (!cwid) return res.status(409).send("No proposed identity to reject");
        if (isScopus) {
          // scopus reject = local dismissal, never gold standard (no PMID to reject).
          await models.AuthorshipReview.update({ status: "rejected", reviewer, resolved_at: new Date() }, { where: { id } });
          break;
        }
        // "None of these" on a multi-candidate row asserts none of them wrote it — reject
        // every candidate, not just top_cwid. reopen() reverses the same set, recomputed
        // from candidate_cwids_json (stable once a row leaves "open" — see aar_db.py: the
        // producer never revisits an already-resolved row's upsert).
        const targets = row.single_candidate ? [cwid] : candidateCwidsFromRow(row);
        for (const target of targets) {
          const gs = await writeGoldStandard(target, pmid as number, "rejected", "UPDATE", curator.userID);
          if (gs !== 200) return res.status(502).send(`Gold-standard write failed for ${target} (${gs})`);
        }
        await models.AuthorshipReview.update({ status: "rejected", reviewer, resolved_at: new Date() }, { where: { id } });
        for (const target of targets) {
          try { await appendFeedbackLog(curator.userID, target, pmid as number, "REJECTED"); }
          catch (e) { console.log("[authorships] feedbacklog (reject) non-fatal:", e); }
        }
        break;
      }
      case "snooze": {
        const wake = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
        await models.AuthorshipReview.update({ status: "snoozed", snooze_until: wake, reviewer }, { where: { id } });
        break;
      }
      case "dismiss": {
        // "Same paper" from the PubMed-twin panel: dup_of_matched_pmid composes its own note
        // server-side from the row's own matched_pmid (never from client-supplied free text —
        // see `assign`'s local_only note above for the `${row.note ? ... : ""}` append
        // convention this mirrors). Plain dismiss (no reason) is unchanged.
        if (body.reason === "dup_of_matched_pmid") {
          if (row.matched_pmid == null) return res.status(400).send("Row has no matched_pmid to dismiss against");
          await models.AuthorshipReview.update({
            status: "dismissed", reviewer, resolved_at: new Date(),
            note: `${row.note ? `${row.note} | ` : ""}dup of PMID ${row.matched_pmid} (curator)`,
          }, { where: { id } });
          break;
        }
        await models.AuthorshipReview.update({ status: "dismissed", reviewer, resolved_at: new Date() }, { where: { id } });
        break;
      }
      case "reopen": {
        const reverseCwid = row.resolution_cwid || cwid;
        if (isScopus) {
          // undo a scopus accept/assign = revoke the ExternalArticle (reject/dismiss wrote none).
          if ((row.status === "accepted" || row.status === "assigned") && reverseCwid) {
            const resp = await deleteExternalArticle(reverseCwid, `SCOPUS:${row.external_id}`);
            if (resp.statusCode !== 200) return res.status(502).send(`ExternalArticle revoke failed (${resp.statusCode})`);
          }
        } else if ((row.status === "accepted" || row.status === "assigned") && reverseCwid) {
          // A #925 local-only assign wrote no gold standard for the ASSIGNEE, so there is
          // nothing to delete for THEM specifically. (An earlier comment here claimed the
          // DELETE would 404 for a uid ReCiter has no Identity row for. It does not — POST
          // /reciter/goldstandard checks only uid != null and returns 200. The real reason to
          // skip is simply that nothing was ever written for this uid, so the DELETE would be
          // a pointless no-op.)
          // PM#949: local-only now comes from the note marker (src/lib/localOnlyMarker.ts), not
          // a live identity check — so a row survives an IC#148 identity backfill without
          // reopen silently flipping to a destructive DELETE. A marker-less legacy row still
          // falls back to the old live-identity inference (today's behaviour, unchanged). Once a
          // row carries a marker at all, isLocalOnlyNote reads the note positionally (most
          // recent marker wins) rather than "local but not reconciled", because the note is
          // append-only and a row can cycle back through a second local-only assign after being
          // reconciled — see src/lib/localOnlyMarker.ts.
          const wasLocalOnly = noteHasLocalOnlyMarker(row.note)
            ? isLocalOnlyNote(row.note)
            : !(await reciterIdentitySet([reverseCwid])).size;
          if (wasLocalOnly) {
            console.log(`[authorships] reopen ${id}: ${reverseCwid} local-only assign, nothing to undo for the assignee`);
          } else {
            const gs = await writeGoldStandard(reverseCwid, pmid as number, "known", "DELETE", curator.userID);
            if (gs !== 200) return res.status(502).send(`Gold-standard undo failed (${gs})`);
          }
          // F-2: ...and the homonym rejections that assign wrote alongside it, REGARDLESS of
          // whether the assignee themselves has an identity — a local-only assign still
          // recorded "not mine" for every OTHER candidate that DOES have one (see the
          // local_only branch above), and reopen must take that back even when there is
          // nothing to undo for the assignee. Without this there is no undo path for them at
          // all: reopen would clear the row and leave N-1 people permanently rejected on a
          // decision the curator just took back. Recomputed through the same
          // homonymRejections() the write used, so the two sets cannot drift; see that
          // function for why checkAccepted is false here. Covers "accepted" as well as
          // "assigned": assign is the only ACTION that writes these, but the backfill script
          // writes them onto already-resolved rows and defaults to assigned,accepted — 30 of
          // its 170 planned writes land on accepted rows, and scoping this to "assigned" alone
          // would make exactly those permanent with no undo path. Safe for rows that never had
          // any: a genuine single-candidate Accept (the "accept" action, gated on
          // row.single_candidate) never calls homonymRejectionTargets at all, and for an
          // "assigned"/"accepted" row this recomputes to [] on its own once `others` collapses
          // to empty — same as at write time. A legacy un-backfilled multi accept issues
          // DELETEs ReCiter treats as 200 no-ops (DynamoDbGoldStandardService removes a pmid
          // only `if(rejectedPmids.contains(...))`, so a miss is not an error).
          for (const other of await homonymRejectionTargets(row, reverseCwid, pmid as number, false)) {
            const rs = await writeGoldStandard(other, pmid as number, "rejected", "DELETE", curator.userID);
            if (rs !== 200) return res.status(502).send(`Homonym rejection undo failed for ${other} (${rs})`);
          }
        } else if (row.status === "rejected") {
          const targets = row.single_candidate ? (reverseCwid ? [reverseCwid] : []) : candidateCwidsFromRow(row);
          for (const target of targets) {
            const gs = await writeGoldStandard(target, pmid as number, "rejected", "DELETE", curator.userID);
            if (gs !== 200) return res.status(502).send(`Gold-standard undo failed for ${target} (${gs})`);
          }
        }
        await models.AuthorshipReview.update({ status: "open", snooze_until: null, resolved_at: null, resolution_cwid: null, reviewer }, { where: { id } });
        break;
      }
      case "verdict": {
        // "Different papers" from the PubMed-twin panel. Only stops future re-flagging — it is
        // NOT a resolution of the row, so status/reviewer/resolved_at/note are untouched and the
        // row stays wherever it was (open queue, once matched_pmid_verdict='distinct' takes it
        // out of the "duplicates" view per openStatusWhere above). 'same' is never written here
        // or anywhere else — "same paper" is expressed by dismissing the row with a note instead.
        if (body.verdict !== "distinct") return res.status(400).send('verdict must be "distinct"');
        if (row.matched_pmid == null) return res.status(400).send("Row has no matched_pmid to give a verdict on");
        await models.AuthorshipReview.update({ matched_pmid_verdict: "distinct" }, { where: { id } });
        break;
      }
      default:
        return res.status(400).send(`Unknown action: ${action}`);
    }

    const updated = await models.AuthorshipReview.findByPk(id, { attributes: LIST_ATTRIBUTES });
    return res.send({ ok: true, row: updated });
  } catch (e) {
    console.log(e);
    return res.status(500).send(String(e));
  }
};

// lowercase + strip everything but [a-z0-9] — the equality test for the Scopus-vs-PubMed
// comparison below (title/journal/doi and surnames), tolerant of punctuation/hyphen/casing
// drift between the two sources without needing a fuzzy-match library.
function normForCompare(s?: string | null): string {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Best-effort DOI probe against the two article-id JSON shapes NLM's PubMedArticle XML→JSON
// conversion typically carries (an elocationid entry tagged EIdType="doi", or an
// articleidlist entry tagged IdType="doi"). Neither is exercised by any existing PM code —
// formatPubmedSearch() (controllers/pubmed.controller.ts) never extracts a DOI from this same
// article JSON — and the Java class backing it (reciter.model.pubmed.PubMedArticle) is an
// external Maven dependency (ReCiter-Pubmed-Model), not defined in this repo, so this exact
// field shape was not independently verified against a live payload. Never throws; returns
// null (never surfaced to the client as an error — see doiEqual below) on any shape mismatch.
function extractDoiFromArticle(art: any): string | null {
  try {
    const idFrom = (entry: any): string | null => {
      const type = String(entry?.eidtype ?? entry?.idtype ?? entry?.EIdType ?? entry?.IdType ?? "").toLowerCase();
      if (type !== "doi") return null;
      const val = entry?.content ?? entry?.value ?? entry?._ ?? (typeof entry === "string" ? entry : null);
      return typeof val === "string" && val ? val : null;
    };
    const eloc = art?.elocationid;
    for (const e of Array.isArray(eloc) ? eloc : eloc ? [eloc] : []) {
      const doi = idFrom(e);
      if (doi) return doi;
    }
    const idList = art?.articleidlist ?? art?.pubmeddata?.articleidlist;
    for (const i of Array.isArray(idList) ? idList : idList ? [idList] : []) {
      const doi = idFrom(i);
      if (doi) return doi;
    }
  } catch { /* fall through to null */ }
  return null;
}

// POST /api/db/authorships/counterpart — read-only Scopus-vs-PubMed comparison for a row the
// producer flagged with a possible PubMed twin (matched_pmid). Powers CounterpartPanel in
// AuthorshipsTabs.tsx. No GoldStandard/ExternalArticle/AdminFeedbackLog write — see the
// "Same paper"/"Different papers" actions in case "dismiss" / case "verdict" above for the
// writes this panel's buttons actually make.
export const authorshipCounterpart = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const id = Number(req.body?.id);
    if (!id || !Number.isInteger(id) || id <= 0) return res.status(400).send("id must be a positive integer");

    const row: any = await models.AuthorshipReview.findByPk(id, { attributes: LIST_ATTRIBUTES });
    if (!row) return res.status(404).send("Authorship not found");
    if (row.matched_pmid == null) return res.status(400).send("Row has no matched_pmid");
    const pmid = Number(row.matched_pmid);

    // Scopus side: straight off the row. authors_json is the same [{given,surname}, ...]
    // shape formatAuthorsJson() (AuthorshipsTabs.tsx) already renders for the collapsed card.
    let scopusAuthors: { given: string; surname: string }[] = [];
    try {
      const parsed = JSON.parse(row.authors_json || "[]");
      if (Array.isArray(parsed)) {
        scopusAuthors = parsed.map((a: any) => ({ given: String(a?.given || ""), surname: String(a?.surname || "") }));
      }
    } catch { scopusAuthors = []; }
    const scopus = {
      title: row.title || null,
      journal: row.journal || null,
      year: row.entrez_date ? String(row.entrez_date).slice(0, 4) : null,
      doi: row.doi || null,
      authors: scopusAuthors,
      external_id: row.external_id || null,
      pub_type: row.pub_type || null,
    };

    // PubMed side — the exact same proxy findPubmedByDoi() (pubmedLookup.controller.ts) uses
    // (same endpoint, same POST shape, PUBMED_API_KEY held entirely by the retrieval tool),
    // term `<pmid>[PMID]` instead of `<doi>[AID]`. 10s timeout: unlike findPubmedByDoi's
    // background DOI check, this now drives a UI panel synchronously on card expand, so a
    // hung upstream call must not hang the panel — degrade to fetchError instead. Any failure
    // here is HTTP 200 with fetchError set, never a 5xx: the panel's actions (Same paper /
    // Different papers, and the "already in record" check) work from the Scopus side alone
    // even when PubMed is unreachable.
    let pubmed: any = null;
    let fetchError: string | null = null;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const resp = await fetch(reciterConfig.reciterPubmed.searchPubmedEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "reciter-pub-manager-server" },
        body: JSON.stringify({ "strategy-query": `${pmid}[PMID]` }),
        signal: controller.signal,
      });
      if (!resp.ok) {
        fetchError = `pubmed retrieval tool HTTP ${resp.status}`;
      } else {
        const data: any = await resp.json();
        const article = Array.isArray(data) ? data[0] : null;
        const mc = article?.medlinecitation;
        if (!mc) {
          fetchError = "no PubMed record returned";
        } else {
          const art = mc.article || {};
          const pdate = art.journal?.journalissue?.pubdate || {};
          const authorlist = Array.isArray(art.authorlist) ? art.authorlist : [];
          pubmed = {
            pmid: mc.medlinecitationpmid?.pmid ? Number(mc.medlinecitationpmid.pmid) : pmid,
            title: art.articletitle || null,
            journal: art.journal?.title || null,
            year: pdate.year || null,
            month: pdate.month || null,
            doi: extractDoiFromArticle(art),
            authors: authorlist.map((a: any) => ({
              lastName: a?.lastname || "",
              foreName: a?.forename || "",
              initials: a?.initials || "",
            })),
          };
        }
      }
    } catch (e: any) {
      fetchError = e?.name === "AbortError" ? "PubMed retrieval tool timed out after 10s" : String(e?.message || e);
    } finally {
      clearTimeout(timeoutId);
    }

    // inRecordFor: which candidate cwids (top_cwid + candidate_cwids_json, same set case
    // "assign"'s homonym rejections operate over) already have this PMID in person_article —
    // a genuinely new query pattern for this file. PM's existing "does cwid X already have
    // PMID Y" check goes through DynamoDB GoldStandard.knownpmids/rejectedpmids (see
    // goldStandardRejections.ts), not this MySQL table; person_article is queried nowhere
    // else in controllers/ or src/ today.
    const candidateCwids = candidateCwidsFromRow(row);
    let inRecordFor: string[] = [];
    if (candidateCwids.length > 0) {
      const hits = await models.PersonArticle.findAll({
        where: { personIdentifier: { [Op.in]: candidateCwids }, pmid },
        attributes: ["personIdentifier"],
        raw: true,
      });
      inRecordFor = Array.from(new Set((hits as any[]).map((h) => String(h.personIdentifier)).filter(Boolean)));
    }

    // pubmedLaneRow: was this PMID also independently proposed on the pubmed lane (source =
    // "pubmed" rows come from the identity-matched PubMed retrieval path — an entirely
    // separate producer pass from this scopus row's matched_pmid flag).
    const pubmedLaneRow = await models.AuthorshipReview.findOne({
      where: { source: "pubmed", pmid },
      attributes: ["id", "status", "top_cwid"],
      raw: true,
    });

    const scopusNorm = { title: normForCompare(scopus.title), journal: normForCompare(scopus.journal), doi: normForCompare(scopus.doi) };
    const pubmedNorm = { title: normForCompare(pubmed?.title), journal: normForCompare(pubmed?.journal), doi: normForCompare(pubmed?.doi) };
    const scopusSurnames = new Set(scopusAuthors.map((a) => normForCompare(a.surname)).filter(Boolean));
    const pubmedSurnameList: string[] = (pubmed?.authors || []).map((a: any) => normForCompare(a.lastName)).filter(Boolean);
    let sharedSurnames = 0;
    scopusSurnames.forEach((s) => { if (pubmedSurnameList.includes(s)) sharedSurnames++; });

    const compare = {
      titleEqual: !!scopusNorm.title && scopusNorm.title === pubmedNorm.title,
      yearEqual: !!scopus.year && !!pubmed?.year && String(scopus.year) === String(pubmed.year),
      journalEqual: !!scopusNorm.journal && scopusNorm.journal === pubmedNorm.journal,
      // null (not false) when either side lacks a DOI — "unknown", not "different".
      doiEqual: scopusNorm.doi && pubmedNorm.doi ? scopusNorm.doi === pubmedNorm.doi : null,
      sharedSurnames,
      scopusAuthorCount: scopusAuthors.length,
      pubmedAuthorCount: (pubmed?.authors || []).length,
    };

    return res.status(200).send({ scopus, pubmed, fetchError, inRecordFor, pubmedLaneRow: pubmedLaneRow || null, compare });
  } catch (e) {
    console.log(e);
    return res.status(500).send(String(e));
  }
};
