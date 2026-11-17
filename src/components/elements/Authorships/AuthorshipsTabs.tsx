import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Popover from "@mui/material/Popover";
import Checkbox from "@mui/material/Checkbox";
import { toast } from "react-toastify";
import { showUndoToast } from "../ToastHost/ToastHost";
import { Button, Input, Select } from "../../ui";
import { actionErrorToast, actionToast, plainReason } from "../../../utils/authorshipMessages";
import { KEY_LEGEND, chipText, drillBanner, keyCommand, singleChipText } from "../../../utils/authorshipChips";
import FilterChip, { Chevron, optionRowClass, popoverPaper } from "./FilterChip";
import type { ChipOption } from "./FilterChip";
import { reciterConfig } from "../../../../config/local";
import { sanitizeInlineHtml, stripHtml } from "../../../utils/htmlText";
import { uniqueById } from "../../../utils/uniqueById";
import {
  isAcceptEligible, isBulkSelectable,
  unionCandidates, partitionForAssign, assignConfirmFlags, bucketAssignFailures,
  assignOptionSummary, assignPreview, isParkedQueue, looksLikeCwid, orderAssignOptions,
  bucketRejectFailures,
  typedCwidPreview,
} from "../../../lib/bulkAssign";
import type { CandidateLite, TypedCwidLookupState } from "../../../lib/bulkAssign";
import { externalSourceLabel, isExternalSource, openalexRecordUrl } from "../../../lib/externalSource";
import type { AuthorshipSource } from "../../../lib/externalSource";
import { curatorConflictMessage, matchIdText, matchWhereText, parseStoredConflict } from "../../../lib/acceptConflictMatches";
import type { StoredConflict } from "../../../lib/acceptConflictMatches";
import { CompareGrid, EvidenceTable, orderByEvidence, useCandidateEvidence } from "./CandidateEvidence";
import { buildCandidateEvidence } from "../../../utils/candidateEvidence";
import {
  bylineParts, compareHint, fgLine, formatRowDate, ioBadge, ioBand as ioBandOf, ioScoreText, rankCandidates, roleLine, shareLine,
  conflictIdentities, conflictKeep, emptyState, parkedNote, shortcutsLine, sourceBadgeText, splitAffiliation, venueFitBand,
} from "../../../utils/authorshipRow";

// ---- types ---------------------------------------------------------------
interface AuthorshipRow {
  id: number;
  pmid: number;
  author_key: string;
  // Scopus lane (source='scopus'): not-in-PubMed docs from the AF-ID sweep. pmid is null,
  // top_fg_score/top_io_score are null (production never scored a non-PubMed doc), and the
  // record is keyed by external_id (numeric Scopus id). OpenAlex lane (source='openalex'):
  // conference abstracts and preprints, same shape, external_id = OpenAlex W id and pub_type =
  // the OpenAlex work type. PubMed rows leave these undefined.
  source?: AuthorshipSource;
  external_id?: string;
  pub_type?: string;
  container_id?: string;
  wcm_author?: string;
  author_position_label?: string;
  author_affiliation?: string;
  entrez_date?: string;
  title?: string;
  journal?: string;
  doi?: string;
  // Full byline ([{given,surname}, ...] as a JSON string) — scopus rows only, "[]" if the
  // document had no author field, never populated (undefined) for pubmed rows.
  authors_json?: string;
  classification?: "assigned" | "suggested" | "buried" | "absent";
  top_cwid?: string;
  top_name?: string;
  top_person_type?: string;
  top_dept?: string;
  // §2.6 identity hover card. Both come from the list endpoint's widened SELECT (phase 1):
  // institution off the `person` join already attached to every row, division off the IDM
  // roster. `null` (never "") when the row's cwid has no such record — the card omits the line.
  top_institution?: string | null;
  top_division?: string | null;
  top_fg_score?: number;
  top_io_score?: number;
  top_confidence?: number;
  top_cohort_size?: number;
  top_given_match?: string;
  top_affil_match?: boolean;
  // How well the venue fits the proposed person's department (ReCiterDB v3.14); see venueFitBand.
  // Only ever set on Scopus / OpenAlex rows whose candidates are all Cornell Ithaca people.
  top_venue_fit?: number | null;
  n_candidates?: number;
  single_candidate?: boolean;
  candidate_cwids_json?: string;
  pmid_sibling_count?: number;
  // false → top_cwid has no row in ReCiter's DynamoDB Identity table, so there is nothing to
  // add the article to; Accept is impossible. Absence means "never synced or since removed" —
  // NOT necessarily "departed", and not that the attribution is wrong.
  identity_in_reciter?: boolean;
  // true → top_cwid already rejected this exact pmid via their own /curate page
  // (GoldStandard.rejectedpmids); Accept is impossible for the same reason as noIdentity.
  top_already_rejected?: boolean;
  // true → WCM ED has RETIRED top_cwid (`weillCornellEduStatus: retired-cwid`) and the person is
  // recorded under `top_superseded_by` now. Server-set per page from the cached ED census, NOT
  // by the AAR producer, which baked top_cwid long before ED retired it — which is the whole
  // reason this cannot be answered from the row alone. Accept is refused server-side.
  top_retired_cwid?: boolean;
  top_superseded_by?: string | null;
  // #990: other WCM identities who already hold ACCEPTED at this row's exact (pmid,
  // author_position) byline slot (identityConflictWhere()'s own rival(s), named rather than
  // just counted) — always [] rather than undefined when there is none, computed for every
  // pubmed row regardless of single_candidate. Renders the "Already accepted by ..." line on
  // the card and the "Accepted this article" badge on a matching candidate in Pick-one.
  accepted_by?: Array<{ cwid: string; name: string }>;
  // T5: how many OTHER open rows share this row's normalized author key (authorKey() in
  // src/lib/bulkAssign.ts — first+last whitespace token, tolerant of middle-initial variants
  // like "Bernard Park" vs "Bernard J. Park"). Drives "Show N others like this" — hidden at 0.
  like_count?: number;
  // Informational heads-up only (both source lanes) — producer already found a matching
  // ExternalArticle by DOI. Does not gate Accept/Assign; the live 409 at click time is the
  // actual safety net.
  dup_flag?: boolean;
  dup_reason?: string;
  accept_conflict?: string;   // persisted ExternalArticleDupCheck 409 from a previous Accept
  // What that 409 matched (ReCiterDB v3.12), as stored JSON; parseStoredConflict reads it. NULL
  // for rows parked before the column existed and not yet backfilled.
  accept_conflict_matches?: string | Record<string, any> | null;
  // Producer-flagged PubMed twin for a scopus row (ReCiterDB v2.7). 'title' = heuristic
  // unquoted title+surname PubMed search (row stays open for a curator); 'doi' = exact DOI
  // match (producer auto-dismisses these itself); 'scopus' = reserved. matched_pmid_verdict
  // is set ONLY by this UI's "Different papers" action — 'same' is never stored; "same paper"
  // is expressed by dismissing the row with a note instead (see CounterpartPanel below).
  matched_pmid?: number | null;
  matched_pmid_source?: "scopus" | "doi" | "title" | null;
  matched_pmid_at?: string | null;
  matched_pmid_verdict?: "same" | "distinct" | null;
  status?: string;
  snooze_until?: string;
  reviewer?: string;
  resolved_at?: string;
}

// One ReCiter ExternalArticleDupCheck.Match — title/journal/pubYear are undefined until
// ReCiter#705 (structured Match fields) is deployed; render gracefully without them.
interface DupMatch {
  type?: string;
  matchedId?: string;
  detail?: string;
  title?: string;
  journal?: string;
  pubYear?: string;
}

// The persisted matches of a parked Accept (accept_conflict_matches), in the shape the conflict
// prompt lists, so a refresh or another curator sees what the check matched, not just that it did.
const storedDupMatches = (r: { accept_conflict_matches?: unknown }): DupMatch[] =>
  (parseStoredConflict(r.accept_conflict_matches) as StoredConflict | null)?.matches.map((m) => ({
    type: m.type ?? undefined, matchedId: matchIdText(m) || undefined, detail: m.detail ?? undefined,
    title: m.title ?? undefined, journal: m.journal ?? undefined, pubYear: m.pubYear ?? undefined,
  })) ?? [];

// A duplicate-conflict prompt for one row: rendered inline on that row's own card (never a
// global toast — a fixed-position Snackbar can drift over an unrelated card while the
// curator scrolls, see HANDOFF_2026-08-14). Stays up until the curator acts on it (no
// auto-dismiss timer), and a copy survives in the conflict log after it's cleared so a
// curator can look back at one they've already scrolled past or resolved.
interface ConflictEntry {
  id: number;              // AuthorshipRow.id this conflict belongs to
  action: string;
  // "dup"           — scopus 409 WARNING, retried with force:"true"
  // "no_identity"   — #925 422, retried with confirmNoIdentity:"true". Different consequence,
  //                   so a different prompt: force-add writes to the person's record, this one
  //                   explicitly does NOT.
  // "off_candidate"   — 422, retried with confirmOffCandidate:"true": a real person the producer
  //                     never proposed. This one DOES write their publication record, so its
  //                     prompt must not read like the no_identity one it sits next to.
  // "multi_candidate" — 409 MULTI_CANDIDATE: the card's own isMulti predicate went stale
  //                     (data changed mid-session) and let Accept fire on a row the server
  //                     gates to "Pick one". Not retried — fetchData(true) below refreshes the
  //                     row so the card itself flips to the Pick-one controls; this banner is
  //                     explanation only, no confirm action.
  kind: "dup" | "no_identity" | "off_candidate" | "multi_candidate";
  action_label?: string;   // confirm-button text; kind decides it, held here for the log
  extra?: Record<string, any>;
  message: string;
  matches: DupMatch[];
  wcm_author?: string;     // captured at fire time — "who was this for"
  top_name?: string;
  ts: number;
}

// One resolved row for the server-backed "Recent activity" panel — a global, cross-curator,
// cross-session feed off authorship_review.resolved_at (see authorshipRecentActivity), not to
// be confused with ConflictEntry above (session-local, client-side conflict history) or the
// per-person /curate "Recent activity" panel (CurateIndividual.tsx, a different feed/page).
interface ActivityEntry {
  id: number;
  title?: string;
  wcm_author?: string;
  top_name?: string;
  top_cwid?: string;
  resolution_cwid?: string;
  resolution_name?: string;   // name of resolution_cwid's identity, looked up server-side
  status?: string;
  reviewer?: string;
  resolved_at?: string;
  source?: AuthorshipSource;
  pmid?: number;
  external_id?: string;
}

// One cwid's answer from POST /api/db/authorships/prior-names — the "NAMES ON ACCEPTED PAPERS"
// block of §2.6's identity hover card. `names` is capped at 8 forms server-side (most frequent
// first) with `more` counting the rest.
//
// `accepted` is NOT derivable from `names`: 4,449 person_article rows with userAssertion=
// 'ACCEPTED' carry a blank byline name (ACCEPTED ONLY — the all-assertion-states count is 5,662
// and says nothing about accepted papers), so a cwid can legitimately have accepted > 0 and
// names === [] — on the dev DB 25 cwids are in exactly that state. The
// mockup's "No accepted papers yet" line belongs to `accepted === 0` alone — reading it off
// names.length would tell a curator someone has published nothing when they have published a lot.
interface PriorNames {
  // lastYear: the latest year on an accepted paper under that form (the card's "Last" column).
  names: Array<{ first: string; last: string; n: number; lastYear?: number }>;
  accepted: number;
  more?: number;
  // Titles of accepted papers. A byline name alone often cannot separate two WCM homonyms
  // publishing in the same field; what they have already published usually can.
  papers?: Array<{ pmid: number; title: string; year?: number }>;
  // Roster names, both of them: `identity` holds the DIRECTORY (ED) LEGAL name, `person` the
  // DynamoDB PUBLISHING name. They disagree often enough that showing only the legal one
  // reads as "the matcher ignored the primary name" when it did nothing of the kind.
  identity?: { legalName?: string; publishingName?: string; title?: string; division?: string };
  // The MeSH descriptors this person's ACCEPTED papers carry most often, 6 at most, descending
  // by `n` (server contract). `n` is a raw paper count and is NOT comparable across cwids — a
  // prolific person's floor beats a junior person's ceiling — so it labels a chip, it does not
  // rank one person against another. Optional for the same reason `papers` is: the handler's
  // early return for an empty cwid list sends `{ names, accepted }` alone.
  topics?: Array<{ keyword: string; n: number }>;
  // UI refresh 4d-2. The shape of their whole record (accepted years span the accepted papers
  // only), their top journals, and the bylines on papers they REJECTED that never appear on an
  // accepted one: the namesakes they have already been confused with.
  counts?: { accepted: number; rejected: number; pending: number; firstYear?: number; lastYear?: number };
  journals?: Array<{ journal: string; n: number }>;
  namesakes?: Array<{ first: string; last: string; n: number }>;
  // UI refresh PR 4: the people beside them most often on accepted papers, by distinct paper.
  coauthors?: Array<{ name: string; n: number }>;
}

interface Candidate {
  cwid: string;
  name?: string;
  // Which of the person's names `name` is — the AAR producer's pick among "primary",
  // "directory", "alternate" and "accepted" (a byline on their accepted papers, with `name_n`
  // = how many). Absent on rows the producer wrote before it labelled names: no badge.
  name_source?: string;
  name_n?: number;
  person_type?: string;
  dept?: string;
  io_score?: number;
  final_score?: number;
  confidence?: number;
  affil_dept_match?: boolean;
  given_match?: string;
  // true → this candidate already rejected this exact pmid via their own /curate page
  // (GoldStandard.rejectedpmids) — must never be the highlighted lead, radio stays disabled.
  already_rejected?: boolean;
  // true → WCM ED has RETIRED this cwid (`weillCornellEduStatus: retired-cwid`): the person is
  // real but is recorded under `superseded_by` now, and this identifier is a dead end. Server-set
  // from the cached ED census (retiredCwidIndex), never from the AAR producer, which bakes
  // candidate_cwids_json long before and carries no directory state. Removed from the picker
  // entirely — see MultiEvidence — and refused by the assign route.
  retired_cwid?: boolean;
  superseded_by?: string | null;
}

interface Summary {
  total: number; single_candidate: number; classes: Record<string, number>;
  fullname?: number;                                 // single-candidate AND full given-name match
  venuefit?: number;                                 // single-candidate, initials-only byline, venue fits the department
  duplicates?: number;                               // accepts parked by a dup-check 409
  // Identity conflicts (#986/#990): open rows whose exact byline slot — same PMID AND same
  // author position — is already ACCEPTED by a different WCM identity (one that exists in the
  // HR `identity` roster, so the external-validation cohorts in person_article don't count as
  // rivals). Like `duplicates`, it is computed over the OPEN queue whatever queue the caller is
  // browsing, so the QUEUE list can label the branch with a stable N from inside any other queue.
  conflicts?: number;
  personTypes?: Array<{ type: string; n: number }>;
  bySource?: Record<string, number>;                 // { pubmed: n, scopus: n } — source-segment counts
  pubTypes?: Array<{ type: string; n: number }>;      // scopus pub_type facet
  // Two institution facets over the SAME bucket keys, one per basis (see INSTITUTION_LABELS):
  // `institutions` is the person/HR basis behind IDENTITY AFFILIATION, `authorInstitutions` the
  // byline basis behind ARTICLE AFFILIATION. They are independent lists, ANDed by the server.
  institutions?: Array<{ key: string; n: number }>;
  // ABSENT unless the request carried `includeAuthorInstitutions: true` — its 13 byline LIKEs
  // cost 563 ms of a 896 ms endpoint on production, so they are opt-in (see fetchSummary).
  // Absent means "not computed": render a loading state, never a zero. Present-and-[] is a
  // different, legitimate answer ("computed, no bucket matched") and the server never conflates
  // the two.
  authorInstitutions?: Array<{ key: string; n: number }>;
  // How many rows each Hide box hides (4b). ABSENT unless the request carried
  // `includeHideCounts: true`, same contract as authorInstitutions.
  hidden?: { noSuggestion: number; noIdentity: number };
  // The canned reports' row counts — the ONE field POST /api/db/authorships/summary gained for
  // them, and the only thing they need from this endpoint. Undefined until the first summary
  // response lands, which is why the reports menu reserves the width of its count column
  // instead of letting the numbers shove the labels sideways when they arrive.
  reports?: { lowScoringAccepts: number; highScoringRejects: number };
}

// ---- canned reports ------------------------------------------------------
// Two saved curator/model disagreement queries over reciterdb.person_article. NOT a statusView
// and NOT a review queue: only 2.3% of the low-scoring accepts and 0.5% of the high-scoring
// rejects have an authorship_review row at all (the AAR producer skips already-curated
// authorships on purpose), so these rows carry no id, no status and no curator columns —
// nothing the authorship card or the bulk-action machinery could bind to. They need no actions
// of their own either: the article is already curated, so the only useful verb is "look at this
// again", and /curate/<cwid> already provides it.
type ReportKey = "lowScoringAccepts" | "highScoringRejects";
// The report currently on screen; `null` is the normal authorships feed.
//
// Held as a SIBLING of AuthorshipFilters, never as a member of it, and this is a hard contract
// rather than a preference. buildFilterBody's output is byte-compared (key order included)
// against a committed baseline by scripts/check-authorships-filter-body.mjs, and the chip row
// plus "Reset all" measure against FILTER_DEFAULTS. Keeping the report out of the filter object
// is what makes "choosing a report does not touch the curator's filters, and leaving it restores
// the feed exactly" true by construction instead of by careful bookkeeping. The report body is
// `{ ...buildFilterBody(f), report }` — a spread of a copy; buildFilterBody itself never changes.
type ReportView = null | ReportKey;

// One person_article row as POST /api/db/authorships/reports returns it. Every field is
// nullable because person_article is: a row can predate the score column, carry no PMID, or
// have been written before a feedback channel existed.
interface ReportRow {
  cwid: string; person: string; pmid: number | null; score: number | null;
  pubDate: string | null; journal: string | null; title: string | null;
  // The four feedback evidence channels behind the burial mechanism (see FEEDBACK_CHANNELS).
  fbInstitution: number | null; fbJournal: number | null;
  fbOrganization: number | null; fbCoAuthor: number | null;
  groupCount: number;   // how many rows this person has in THIS report
}
interface ReportResponse {
  report: ReportKey;
  total: number;       // rows returned
  people: number;      // distinct cwids among them
  capped: boolean;     // true when the server's REPORT_ROW_CAP truncated the result
  // Already ordered and ready to group in document order: groupCount DESC, then the person's
  // worst score, then cwid, then within a person by score (ascending for accepts, descending
  // for rejects). Never re-sorted client-side.
  rows: ReportRow[];
}

const REPORT_LABEL: Record<ReportKey, string> = {
  lowScoringAccepts: "Low-scoring accepts",
  highScoringRejects: "High-scoring rejects",
};
// Which filters the reports endpoint honours, stated in the menu where the curator PICKS a
// report rather than left to be discovered afterwards from a filter bar that quietly did
// nothing. The controls it does not honour are hidden while a report is on screen (see
// isChipHiddenByReport and the hide sites in the render), so this sentence and the filter bar
// always agree.
//
// The date window and the identity-affiliation list are both honoured but RESET on entry (see
// selectReport), so the counts beside each label are the whole population rather than a slice of
// it. Together the queue's defaults hid 94% of both reports: the two-year window took accepts
// from 1,065 to 106, and the WCM affiliation took that to 66.
const REPORT_FILTER_NOTE = "All years and affiliations by default; honours person type, institution and search";
// Verified against production 2026-09-06: ~1,065 rows / 816 people and ~430 rows / 332 people
// over all years and all affiliations, which is what these counts now show (the server holds both
// of those filters neutral for them — see authorshipSummary). Those two counts are the acceptance test for the endpoint behind this
// menu, so a number here that drifts far from them is a server-side regression, not a re-skin.
const REPORT_OPTIONS: Array<{ key: ReportKey; note: string; count: (s: Summary | null) => number | undefined }> = [
  { key: "lowScoringAccepts", note: "Curator accepted, model scored it below 10", count: (s) => s?.reports?.lowScoringAccepts },
  { key: "highScoringRejects", note: "Curator rejected, model scored it 90 or above", count: (s) => s?.reports?.highScoringRejects },
];

// Response shape of POST /api/db/authorships/counterpart (authorshipCounterpart in
// authorships.controller.ts) — the PubMed-twin comparison CounterpartPanel renders.
interface CounterpartScopusSide {
  title: string | null; journal: string | null; year: string | null; doi: string | null;
  authors: { given: string; surname: string }[];
  external_id: string | null; pub_type: string | null;
}
interface CounterpartPubmedSide {
  pmid: number; title: string | null; journal: string | null;
  year: string | null; month: string | null; doi: string | null;
  authors: { lastName: string; foreName: string; initials: string }[];
}
interface CounterpartCompare {
  titleEqual: boolean; yearEqual: boolean; journalEqual: boolean;
  doiEqual: boolean | null;   // null when either side lacks a DOI — "unknown", not "different"
  sharedSurnames: number; scopusAuthorCount: number; pubmedAuthorCount: number;
}
interface CounterpartResponse {
  scopus: CounterpartScopusSide;
  pubmed: CounterpartPubmedSide | null;
  fetchError: string | null;
  inRecordFor: string[];
  pubmedLaneRow: { id: number; status: string; top_cwid: string | null } | null;
  compare: CounterpartCompare;
}

const PAGE_SIZE = 20;
// A "Show N others like this" view is one person's pile, and a curator selects the whole pile
// to bulk-assign it — paging it at 20 meant "select all on this page" quietly took 20 of 25
// (owner report 2026-09-15). That view is NOT paged at all: one request for the whole pile
// (the server lifts its 200 clamp to LIKE_PILE_CAP for likeAuthor) and no pager. A name/cwid/
// PMID search widens to 200 for the same reason but keeps paging; the ordinary queue keeps 20.
const SEARCH_PAGE_SIZE = 200;
const LIKE_PILE_CAP = 5000;
// Bulk accept is one POST per row and each one is a gold-standard or ExternalArticle write
// into ReCiter. A page's worth at a time is proven load; firing a whole 2,000-row selection
// at once is not, against the same service the May 3-4 contention incident came off. Chunks
// run sequentially, so the concurrency ceiling is the same as accepting one page today.
const BULK_CHUNK = 20;
const apiHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
  Authorization: reciterConfig.backendApiKey,
};

// case-insensitive WCM institution token matcher (F6) — longest variants first
const WCM_RE = /Weill[ -]Cornell(?:\s+(?:Medicine|Medical College|Medical Cent(?:er|re)))?/i;

// Display names for the curated institution-bucket keys the server returns (summary.institutions
// and the institutions filter body field) — keeps INSTITUTION_BUCKETS' server-side literal
// primaryInstitution strings out of this file entirely; the client only ever sees bucket keys.
const INSTITUTION_LABELS: Record<string, string> = {
  wcm: "Weill Cornell Medicine",
  nyp: "New York-Presbyterian Hospital",
  wcm_qatar: "WCM-Qatar",
  msk: "Memorial Sloan Kettering",
  houston_methodist: "Houston Methodist",
  hss: "Hospital for Special Surgery",
  hamad_medical: "Hamad Medical Corporation",
  ny_methodist: "New York Methodist Hospital",
  nyp_queens: "NewYork-Presbyterian Queens",
  lincoln: "Lincoln Medical and Mental Health Center",
  columbia: "Columbia University",
  sidra: "Sidra Medicine",
  cornell: "Cornell University",
  rockefeller: "Rockefeller University",
};

const CLASS_META: Record<string, { label: string; color: string; hint: string }> = {
  buried: { label: "Buried", color: "var(--pm-red)", hint: "Production buried it (Authorship Score < 30)" },
  absent: { label: "Never retrieved", color: "var(--pm-amber)", hint: "Production never scored this person" },
  suggested: { label: "Suggested", color: "#475467", hint: "Already in a curator's pending queue (Authorship Score ≥ 30)" },
  assigned: { label: "Assigned", color: "var(--pm-slate)", hint: "Accepted by a WCM person" },
};

// Every /authorships message, errors included, goes through the app's one toast host (the dark
// pill at bottom centre), worded as plain sentences by utils/authorshipMessages. Errors stay up a
// little longer than the 5s default because they usually carry a reason worth reading.
const showError = (message: string) => { toast.error(message, { autoClose: 8000 }); };

// The identity an accept or assign lands on, for the toast's "→ Name". Falls back to the cwid.
const targetNameOf = (row: AuthorshipRow, action: string, cwid?: string): string | null => {
  if (action === "accept") return row.top_name || row.top_cwid || null;
  if (action !== "assign" || !cwid) return null;
  return rowCandidateLites(row).find((c) => c.cwid === cwid)?.name || cwid;
};

// row STATUS -> display verb for the "Recent activity" panel. Distinct from actionToast's verbs
// (action verbs the curator clicked, e.g. "accept") — these are the terminal values persisted
// in authorship_review.status once resolved_at is set (never "open"/"snoozed" here).
const STATUS_LABEL: Record<string, string> = {
  accepted: "Accepted", assigned: "Assigned", rejected: "Rejected", dismissed: "Dismissed",
};

// The noun phrase after the count in §2.1's one-line header ("7,412 unassigned authorships,
// past 5 years"). summary.total is scoped to the caller's own queue, so every queue needs its
// own phrase — a snoozed count is not "unassigned", and the two review queues read as a
// qualifier on "authorships" rather than an adjective in front of it.
const SUMMARY_HEADLINE: Record<string, string> = {
  open: "unassigned authorships", snoozed: "snoozed authorships", dismissed: "dismissed authorships",
  conflicts: "authorships with an identity conflict", duplicates: "possible duplicate authorships",
};

// The date phrase that trails that line (§2.1: "…, past 5 years"). Keyed by datePreset, which is
// a module constant at mount, so the statically-prerendered first paint and the client agree —
// dateFrom/dateTo are computed client-side and must never be echoed into it except under
// "custom", which no first render can be in.
const DATE_PHRASE: Record<string, string> = {
  any: "", "30d": "past 30 days", "90d": "past 90 days", "6m": "past 6 months",
  "12m": "past 12 months", "24m": "past 2 years", "60m": "past 5 years",
};
const datePhrase = (preset: string, from: string, to: string): string => {
  if (preset !== "custom") return DATE_PHRASE[preset] ?? "";
  if (from && to) return `${from} to ${to}`;
  if (from) return `since ${from}`;
  if (to) return `through ${to}`;
  return "";
};

// ---- filter model (single source of truth) -------------------------------
// Every server-visible filter on this page lives in ONE object. Two dependency arrays in this
// file have repeatedly gone stale when a filter was added by hand:
//   * filterBody()'s deps — a filter missing there silently stops triggering refetches, so the
//     list keeps showing rows the filter says are gone.
//   * the ephemeral-clear effect's deps — a filter missing there leaves `selected` alive on
//     rows the curator can no longer see, and the next bulk action fires on them.
// Both now depend on this one object, so neither can be forgotten: add a key to
// AuthorshipFilters, give it a default in FILTER_DEFAULTS, and read it in buildFilterBody().
// scripts/check-authorships-filter-body.mjs fails the build-time check if a key is added
// without reaching the posted body.
//
// Deliberately NOT in here (each one is a documented exception, not an oversight):
//   * `page`        — appended as `offset` at the fetch site, never part of the posted filter
//                     body; it IS in the ephemeral-clear deps (paging must drop the selection).
//   * `searchInput` — the raw text box. It debounces (300 ms) into `search`, which is the
//                     filter; binding a fetch to every keystroke is what the debounce avoids.
//   * `datePreset`  — a LABEL for the dateFrom/dateTo pair, not a filter. Selecting "Custom…"
//                     changes only the preset and must not refetch or drop a selection.
//   * anchors, `expanded`, `selected`, `picked`, `allMatching` — UI state, not filters.
interface AuthorshipFilters {
  lane: "fullname" | "venuefit" | "single" | "all";
  classification: "all" | "buried" | "absent" | "suggested";
  search: string;
  selectedTypes: string[];
  // IDENTITY AFFILIATION (HANDOFF §2.2): institution buckets matched against the proposed
  // person's HR/roster institution — #982's `person` basis, which buildFilterBody now pins.
  selectedInstitutions: string[];
  // ARTICLE AFFILIATION (HANDOFF §2.2): the same bucket keys matched against the affiliation
  // printed on THIS paper — #982's `byline` basis. A separate, independent list: the server
  // ANDs the two, so "identity WCM + article NYP" means "a WCM person on an NYP byline".
  selectedAuthorAffiliations: string[];
  source: "all" | AuthorshipSource;
  selectedPubTypes: string[];
  dateFrom: string;
  dateTo: string;
  sort: string;
  statusView: "open" | "snoozed" | "dismissed" | "duplicates" | "conflicts";
  hideNoSuggestion: boolean;
  hideNoIdentity: boolean;
  likeAuthor: string;
}

const DEFAULT_DATE_PRESET = "24m";                       // "Last 2 years" (HANDOFF §2.4)
// "All time" / "Last 12 months" / "Last 2 years" / "Last 5 years" are the four the mockup's DATE
// select names (HANDOFF §2.3, mockup:244-249); "Last 5 years" is new. The other three presets
// (and Custom…, which reveals the explicit From/To inputs) are pre-existing windows this page
// already supports — the mockup's list is a subset, and dropping a working filter is not a
// re-skin, so they stay.
const DATE_PRESET_LABEL: Record<string, string> = {
  any: "All time", "30d": "Last 30 days", "90d": "Last 90 days", "6m": "Last 6 months",
  "12m": "Last 12 months", "24m": "Last 2 years", "60m": "Last 5 years", custom: "Custom…",
};
const DATE_PRESET_ORDER = ["any", "30d", "90d", "6m", "12m", "24m", "60m", "custom"];
const STATUS_VIEW_LABEL: Record<AuthorshipFilters["statusView"], string> = {
  open: "Open", conflicts: "Identity conflicts", duplicates: "Duplicate records",
  snoozed: "Snoozed", dismissed: "Dismissed",
};
// QUEUE (HANDOFF §2.3, mockup:498-504) — `statusView` plus the new Identity-conflicts branch.
// The lane does NOT live here (see MATCH_CLASS_OPTIONS below and HANDOFF §3a): these five are
// mutually exclusive server-side views, a precision lane is not.
const QUEUE_OPTIONS: Array<{ key: AuthorshipFilters["statusView"]; note?: string }> = [
  { key: "open" },
  { key: "conflicts", note: "Two CWIDs on one authorship" },
  { key: "duplicates", note: "Same paper from PubMed and Scopus" },
  { key: "snoozed" },
  { key: "dismissed" },
];
// Duplicates and Identity conflicts are REVIEW queues, not status values: the rows in them are
// still status="open" underneath. Two consequences, both already true of duplicates and both
// now true of conflicts — a card inside one must be handed statusView="open" so it offers the
// same per-row actions as the open feed, and the page-level bulk actions stay off (eligibleRows
// gates on statusView === "open"), because a review queue is resolved one row at a time.

// The defaults "Reset all" restores and the chip row measures against (HANDOFF §2.4, from the
// mockup's DEFAULTS at mockup:552 plus its resetAll at mockup:702).
const FILTER_DEFAULTS: AuthorshipFilters = {
  lane: "all", classification: "all",                    // match class "All unassigned"
  search: "",
  selectedTypes: [],
  selectedInstitutions: ["wcm"],                         // identity affiliation = WCM
  selectedAuthorAffiliations: ["wcm"],                   // article affiliation = WCM (2026-09-15)
  source: "all",
  selectedPubTypes: [],
  dateFrom: "", dateTo: "",                              // the real default window is computed
                                                         // by applyDatePreset(DEFAULT_DATE_PRESET)
  sort: "io",                                            // never reset — see RESET_EXEMPT
  statusView: "open",
  hideNoSuggestion: false, hideNoIdentity: false,
  likeAuthor: "",
};

// What the page mounts with. Phase 3 adopts HANDOFF §2.4's defaults wholesale, so this is now
// FILTER_DEFAULTS exactly and the page loads with an empty chip row.
//
// Two first-load behaviours changed with it, both deliberate and both owner-confirmed (§2.2):
//   lane "single" -> "all"             — the old mount silently pinned the queue to the
//                                        high-precision lane through a control that no longer
//                                        exists as a strip. Leaving it at "single" while
//                                        deleting the strip is exactly the stranded-default
//                                        trap §3a warns about; the lane now lives in MATCH
//                                        CLASS and starts at its own all-value.
//   selectedInstitutions [] -> ["wcm"] — the identity-affiliation default. Narrower than
//                                        before: the queue shows fewer rows on first load.
const INITIAL_FILTERS: AuthorshipFilters = {
  ...FILTER_DEFAULTS,
};

// The curator's last view, kept across reloads and return visits (2026-10-23). A curator
// working one slice of the queue (Article affiliation = Cornell, ~23k rows) otherwise lands on
// the default WCM 2-year queue after every reload, waits for it, re-applies the chips, and waits
// again. Restored on mount BEFORE the first fetch, so the saved view is the only one queried.
// localStorage, not the URL: the owner wants "pick up where I left off", not a bookmark.
// The date window is saved as its PRESET, so "Last 2 years" still means the last two years when
// it is restored a month later; only "Custom…" carries its literal From/To. likeAuthor is never
// saved — a like view is a detour whose filters are deliberately widened (LIKE_WIDEN_PATCH), and
// restoring it would strand the curator in that widened queue with no stash to return to.
const SAVED_VIEW_KEY = "authorships.view.v1";
type SavedView = { filters: Partial<AuthorshipFilters>; datePreset: string };
const loadSavedView = (): SavedView | null => {
  try {
    const v = JSON.parse(window.localStorage.getItem(SAVED_VIEW_KEY) || "null");
    if (!v || typeof v.filters !== "object" || typeof v.datePreset !== "string") return null;
    if (!DATE_PRESET_LABEL[v.datePreset]) return null;
    // Only keys this build still knows, with the type the default has — a view saved by an
    // older or newer build must not inject a stale or misshapen filter.
    const filters: Partial<AuthorshipFilters> = {};
    (Object.keys(FILTER_DEFAULTS) as Array<keyof AuthorshipFilters>).forEach((k) => {
      const saved = v.filters[k];
      const dflt = FILTER_DEFAULTS[k];
      if (saved === undefined || Array.isArray(saved) !== Array.isArray(dflt) || typeof saved !== typeof dflt) return;
      (filters as any)[k] = saved;
    });
    filters.likeAuthor = "";
    return { filters, datePreset: v.datePreset };
  } catch { return null; }
};
const saveView = (view: SavedView) => {
  try { window.localStorage.setItem(SAVED_VIEW_KEY, JSON.stringify(view)); } catch { /* private window / quota */ }
};

// "Reset all" restores FILTER_DEFAULTS except these. Sort is a view preference, not a filter:
// the mockup's DEFAULTS omits it, it is never a chip, and the owner's standing requirement is
// that changing one control must not lose the others, sort in particular.
const RESET_EXEMPT: Array<keyof AuthorshipFilters> = ["sort"];
const filterResetPatch = (): Partial<AuthorshipFilters> => {
  const patch: Partial<AuthorshipFilters> = {};
  (Object.keys(FILTER_DEFAULTS) as Array<keyof AuthorshipFilters>).forEach((k) => {
    if (RESET_EXEMPT.indexOf(k) > -1) return;
    const v = FILTER_DEFAULTS[k];
    (patch as any)[k] = Array.isArray(v) ? v.slice() : v;   // never hand out the shared array
  });
  return patch;
};

// #1011: what "Show N others like this" clears when it is clicked. The server's like_count is
// ONE grouped COUNT over open + name key (+ the immaturity hold) — deliberately blind to every
// other chip, because the button's promise is "here is the rest of this person's pile". The
// filtered list, though, ANDs the name key onto every active filter, so the two answered
// different questions: a card offering "Show 5 others like this" landed on "Showing 1 of 1"
// once an Article-affil chip and the default date window had removed the other four.
//
// So the click widens the list to the count's own scope. These are every buildWhere predicate
// EXCEPT the status branch and the name key, set to their WIDEST value — not FILTER_DEFAULTS,
// which still narrows via selectedInstitutions ["wcm"] and the 24-month default window.
// statusView goes to "open" because the count always does (the overflow menu offers this button
// from the snoozed/dismissed views too).
//
// Nothing is silently lost: the prior filter set is stashed and restored when the "Like: …"
// chip is dismissed, exactly as selectReport does for the report views.
//
// Authorships PR 2: the like drill no longer applies this (it keeps the curator's filters, as
// the prototype does, and the drill banner names the pile). It is still what
// /authorships?cwid=<uid> opens with, so a person link shows all of that person's rows.
const LIKE_WIDEN_PATCH: Partial<AuthorshipFilters> = {
  lane: "all", classification: "all", search: "",
  selectedTypes: [], selectedInstitutions: [], selectedAuthorAffiliations: [],
  source: "all", selectedPubTypes: [],
  dateFrom: "", dateTo: "",
  statusView: "open",
  hideNoSuggestion: false, hideNoIdentity: false,
};

// Two filter values are "the same" when a write of one over the other is a no-op. Arrays are
// compared by content because several call sites re-set an already-empty list (the
// source-leaves-scopus reset, "Clear selection"); with one shared object a fresh [] would
// otherwise look like a change and cost a refetch plus the curator's selection.
const sameFilterValue = (a: any, b: any): boolean => {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => v === b[i]);
  return Object.is(a, b);
};

// MATCH CLASS (HANDOFF §2.3) is the union of today's two chip strips — the lane strip
// (fullname / venuefit / single / all) and the classification strip — as ONE single-select list
// in the mockup's order (mockup:488-496). Picking a lane value resets classification to its
// all-value and vice versa, which is why 8 entries cover 4 lane values + 4 classification values.
const LANE_LABEL: Record<AuthorshipFilters["lane"], string> = {
  all: "All unassigned", fullname: "Unique and full given-name match", venuefit: "Initials + venue fit",
  single: "High-precision",
};
const MATCH_CLASS_DEFAULT = LANE_LABEL.all;
// `hint` is the tooltip the deleted strips carried (they are the only place these explanations
// lived); `count` is the right-aligned number the popover shows (§2.3), read off the same
// summary facets the strips used — no new server field.
type MatchClassOption = {
  label: string;
  lane: AuthorshipFilters["lane"];
  classification: AuthorshipFilters["classification"];
  sub: string;    // the one-line description under the label (prototype's Match class list)
  hint: string;
  count: (s: Summary | null) => number | undefined;
};
const MATCH_CLASS_OPTIONS: MatchClassOption[] = [
  { label: LANE_LABEL.all, lane: "all", classification: "all", sub: "Every unassigned authorship", hint: "Every unassigned authorship", count: (s) => s?.total },
  {
    label: LANE_LABEL.fullname, lane: "fullname", classification: "all",
    sub: "Exactly one identity matches and the given name matches in full",
    hint: "Exactly one WCM identity matches AND the given name matches in full (not just the initial). Curators have accepted 4,723 of these and rejected none; the initial-only rows next door were rejected 373 times.",
    count: (s) => s?.fullname,
  },
  {
    label: LANE_LABEL.venuefit, lane: "venuefit", classification: "all",
    sub: "Exactly one identity matches on initials, and the venue fits their department",
    hint: "Exactly one identity matches, the byline gives initials only, AND the person's department often publishes in this venue's field. On adjudicated Cornell Ithaca Scopus rows these were correct 99.1% of the time (n=1,007, 2026-11-16).",
    count: (s) => s?.venuefit,
  },
  {
    label: LANE_LABEL.single, lane: "single", classification: "all",
    sub: "Exactly one identity matches the name",
    hint: "Only authorships where exactly one WCM identity matches the name",
    count: (s) => s?.single_candidate,
  },
  { label: CLASS_META.suggested.label, lane: "all", classification: "suggested", sub: "Already in a curator's pending queue (Authorship Score ≥ 30)", hint: CLASS_META.suggested.hint, count: (s) => s?.classes?.suggested },
  { label: CLASS_META.buried.label, lane: "all", classification: "buried", sub: "Production buried it (Authorship Score < 30)", hint: CLASS_META.buried.hint, count: (s) => s?.classes?.buried },
  { label: CLASS_META.absent.label, lane: "all", classification: "absent", sub: "Production never scored this person", hint: CLASS_META.absent.hint, count: (s) => s?.classes?.absent },
  // SEVEN options: the mockup's first six plus "Initials + venue fit" (2026-11-16). The mockup's
  // own 7th, "All classes", is left out on purpose: it is the classification strip's
  // all-value and lands on exactly the same (lane:"all", classification:"all") state as
  // "All unassigned" at the top of this list — the mockup lists both only because it is today's
  // two chip strips concatenated (HANDOFF §3a) and does not know they are two axes. Two entries
  // for one state is a dead control: activeMatchClass uses .find(), so the later duplicate could
  // never highlight and clicking it did nothing visible. The two all-values collapse into one.
  // Do not re-add it.
];
// The two strips can still express a combination the single-select list cannot (e.g. the
// fullname lane AND the Buried class); name it honestly rather than mislabel it as one option.
const matchClassLabel = (f: AuthorshipFilters): string => {
  const lane = f.lane === "all" ? "" : LANE_LABEL[f.lane];
  const cls = f.classification === "all" ? "" : (CLASS_META[f.classification]?.label || f.classification);
  if (lane && cls) return `${lane} + ${cls}`;
  return lane || cls || MATCH_CLASS_DEFAULT;
};

// The exact JSON body every list/selectable request posts. Module-level and pure so it can be
// diffed across revisions without a browser — scripts/check-authorships-filter-body.mjs pulls
// this literal out of the file and compares its output, state by state, against a committed
// baseline captured before the controls were restructured. KEY ORDER IS PART OF THAT CONTRACT:
// the check is a byte comparison of JSON.stringify, so reordering keys fails it.
const buildFilterBody = (f: AuthorshipFilters) => ({
  feed: "unassigned",
  precision: f.lane,
  classification: f.classification,
  searchTextInput: f.search,
  personTypes: f.selectedTypes,
  institutions: f.selectedInstitutions,
  // Pinned, no longer a control. #982 shipped a user-facing `match: either/person/byline`
  // select; HANDOFF §2.2 replaces it with the two-list Affiliation popover, in which
  // `institutions` IS the identity list and therefore always means the person basis, while the
  // byline basis is expressed by `authorAffiliations` below. The server parameter is kept and
  // still works, so restoring an OR across the two conditions later is a UI change only.
  institutionBasis: "person",
  authorAffiliations: f.selectedAuthorAffiliations,
  source: f.source,
  pubTypes: f.source === "scopus" ? f.selectedPubTypes : [],   // pub-type facet only meaningful for scopus
  dateFrom: f.dateFrom,
  dateTo: f.dateTo,
  sort: f.sort,
  statusView: f.statusView,
  hideNoSuggestion: f.hideNoSuggestion,
  hideNoIdentity: f.hideNoIdentity,
  likeAuthor: f.likeAuthor,
});

// The body POST /api/db/authorships/summary gets. Derived from buildFilterBody by REMOVAL, not
// rebuilt from a second hand-written key list, so the two can never disagree about a filter's
// spelling or value and a filter added to buildFilterBody later reaches the summary for free.
//
// #988: the summary honours every filter the list does. authorshipSummary
// (controllers/db/authorships.controller.ts) used to force source/classification/precision/
// personTypes/pubTypes/institutions/authorAffiliations to neutral values on arrival, which made
// every facet describe a totally unfiltered queue — wrong for the header total (must equal the
// list's own row count) and for the two alert pills (statusView forced, everything else still
// meant to apply). That override literal is gone; the server now excludes each of those seven
// keys ONLY from the one or two response fields that are themselves an option along that key
// (see the exclusion map on authorshipSummary's per-field `where`s). `sort` is the sole key
// still dropped here, and for the original, unrelated reason: the endpoint is ten COUNT/GROUP BY
// queries with no ORDER BY and never reads it —
// scripts/check-authorships-filter-body.mjs §6 checks that directly against the controller
// source (authorshipSummary must never read body.sort).
//
// institutionBasis is not in this list and so always reaches the summary body: it is not a
// filter (buildWhere only ever reads it when `institutions` itself is non-empty for that
// field's own where), it says which basis the `institutions` facet is COUNTED on, and it has to
// stay "person" because that facet feeds the IDENTITY AFFILIATION list while buildFilterBody
// pins the same basis — otherwise the list would show "either" counts next to checkboxes that
// filter on person (on dev: wcm 3,335 vs 2,279 for the same box).
const SUMMARY_BLIND_BODY_KEYS = [
  "sort",   // counts have no ORDER BY
] as const;
const buildSummaryBody = (f: AuthorshipFilters) => {
  const body: Record<string, any> = { ...buildFilterBody(f) };
  for (const k of SUMMARY_BLIND_BODY_KEYS) delete body[k];
  return body;
};

// Active-filter chips (HANDOFF §2.4). A transcription of the mockup's chipsFor (mockup:607-624),
// except that neither the source segment nor the search box is a chip.
// `patch` is what removing the chip writes back — a plain object rather than a closure, so the
// rule set stays pure and testable. `preset` accompanies the date chip, whose removal has to go
// through applyDatePreset (it recomputes dateFrom/dateTo) rather than a direct patch.
// filterCount, the number on the Filters button in phase 3, is this array's length.
type FilterChip = { id: string; label: string; patch: Partial<AuthorshipFilters>; preset?: string };
const filterChips = (f: AuthorshipFilters, datePreset: string): FilterChip[] => {
  const out: FilterChip[] = [];
  if (f.statusView !== FILTER_DEFAULTS.statusView)
    out.push({ id: "queue", label: `Queue: ${STATUS_VIEW_LABEL[f.statusView]}`, patch: { statusView: FILTER_DEFAULTS.statusView } });
  const matchClass = matchClassLabel(f);
  if (matchClass !== MATCH_CLASS_DEFAULT)
    out.push({ id: "class", label: `Class: ${matchClass}`, patch: { lane: FILTER_DEFAULTS.lane, classification: FILTER_DEFAULTS.classification } });
  f.selectedTypes.forEach((v) => out.push({
    id: `type:${v}`, label: `Person type: ${v}`, patch: { selectedTypes: f.selectedTypes.filter((x) => x !== v) },
  }));
  // Identity affiliation: an EMPTY list is off-default (the default is WCM), so it gets its own
  // chip whose × restores the default rather than clearing anything — mockup:617 exactly.
  if (f.selectedInstitutions.length === 0)
    out.push({ id: "affil:any", label: "Identity affil: any", patch: { selectedInstitutions: FILTER_DEFAULTS.selectedInstitutions.slice() } });
  else if (!(f.selectedInstitutions.length === 1 && f.selectedInstitutions[0] === FILTER_DEFAULTS.selectedInstitutions[0]))
    f.selectedInstitutions.forEach((v) => out.push({
      id: `affil:${v}`, label: `Identity affil: ${INSTITUTION_LABELS[v] || v}`,
      patch: { selectedInstitutions: f.selectedInstitutions.filter((x) => x !== v) },
    }));
  // Article affiliation: same rules as the identity list now that its default is WCM too
  // (2026-09-15) — an empty list is off-default and gets an "any" chip that restores WCM.
  if (f.selectedAuthorAffiliations.length === 0)
    out.push({ id: "authorAffil:any", label: "Article affil: any", patch: { selectedAuthorAffiliations: FILTER_DEFAULTS.selectedAuthorAffiliations.slice() } });
  else if (!(f.selectedAuthorAffiliations.length === 1 && f.selectedAuthorAffiliations[0] === FILTER_DEFAULTS.selectedAuthorAffiliations[0]))
    f.selectedAuthorAffiliations.forEach((v) => out.push({
      id: `authorAffil:${v}`, label: `Article affil: ${INSTITUTION_LABELS[v] || v}`,
      patch: { selectedAuthorAffiliations: f.selectedAuthorAffiliations.filter((x) => x !== v) },
    }));
  if (datePreset !== DEFAULT_DATE_PRESET)
    out.push({ id: "date", label: `Date: ${DATE_PRESET_LABEL[datePreset] || datePreset}`, patch: {}, preset: DEFAULT_DATE_PRESET });
  if (f.hideNoSuggestion) out.push({ id: "hideNoSuggestion", label: "Hiding no suggested identity", patch: { hideNoSuggestion: false } });
  if (f.hideNoIdentity) out.push({ id: "hideNoIdentity", label: "Hiding no ReCiter identity", patch: { hideNoIdentity: false } });
  // The search box is NOT a chip (the prototype's chipsFor never listed it): the box itself
  // shows what is typed, and a chip repeating it only crowded the row. "Reset all" still clears it.
  // likeAuthor ("Show N others like this") has no counterpart in the mockup, which never saw
  // the filter. It used to render its own dismissible "Like: …" pill beside the search box;
  // phase 3 folds it in here, because the row's whole promise (§2.2 point 2) is that the
  // filters in effect are listed in ONE place — a filter with a private pill elsewhere breaks
  // that, and the Filters badge, being chips.length, would undercount it.
  if (f.likeAuthor.trim()) out.push({ id: "like", label: `Like: ${f.likeAuthor.trim()}`, patch: { likeAuthor: "" } });
  return out;
};

// While a canned report is on screen the filter bar must not advertise a filter the report
// silently ignores — a partially-applied filter bar is worse than one that says what it is
// doing. These are the chip ids whose CONTROLS are hidden for the same reason (each hide site
// carries its own one-line reason), so the chip row drops them too and the Filters badge, being
// the visible chip count, drops with it.
//
// The curator's filter STATE is never touched: this filters filterChips' OUTPUT for display
// only, so leaving the report restores every chip and the badge count exactly as they were.
const REPORT_HIDDEN_CHIP_IDS = new Set([
  "queue",              // authorship_review statuses; person_article has no such column
  "class",              // lane + classification are producer match-quality axes, review-only
  "hideNoSuggestion",   // vacuous — the report INNER JOINs identity, so every row has one
  "hideNoIdentity",     // same
  "like",               // likeAuthor keys off authorship_review.wcm_author
]);
const isChipHiddenByReport = (id: string): boolean =>
  REPORT_HIDDEN_CHIP_IDS.has(id) || id.startsWith("authorAffil:");   // byline affiliation is an authorship_review column

// ---- inline Lucide SVG icons (no npm deps) -------------------------------
type IconProps = { size?: number; style?: CSSProperties };
const svgBase = (size: number, style?: CSSProperties): CSSProperties => ({
  width: size, height: size, flex: "none", stroke: "currentColor", fill: "none",
  strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", verticalAlign: -2, ...style,
});
const Icon = ({ size = 15, style, children }: IconProps & { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" aria-hidden style={svgBase(size, style)}>{children}</svg>
);
const IconCheck = (p: IconProps) => <Icon {...p}><path d="M20 6 9 17l-5-5" /></Icon>;
const IconChecks = (p: IconProps) => <Icon {...p}><path d="M18 6 7 17l-5-5" /><path d="m22 10-7.5 7.5L13 16" /></Icon>;
const IconX = (p: IconProps) => <Icon {...p}><path d="M18 6 6 18M6 6l12 12" /></Icon>;
const IconChevR = (p: IconProps) => <Icon {...p}><path d="m9 18 6-6-6-6" /></Icon>;
const IconChevD = (p: IconProps) => <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>;
const IconExt = (p: IconProps) => <Icon {...p}><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></Icon>;
const IconInfo = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></Icon>;
const IconAlert = (p: IconProps) => <Icon {...p}><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" /><path d="M12 9v4M12 17h.01" /></Icon>;
const IconMore = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></Icon>;
const IconUsers = (p: IconProps) => <Icon {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></Icon>;
const IconCopy = (p: IconProps) => <Icon {...p}><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></Icon>;
const IconZoom = (p: IconProps) => <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /><path d="M8 11h6M11 8v6" /></Icon>;
const IconClock = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></Icon>;

// ---- small presentational bits -------------------------------------------
// MUI Tooltip with a larger, more readable font (the default tooltip text is tiny).
const Tip = ({ children, ...rest }: any) => (
  <Tooltip {...rest}
    componentsProps={{ tooltip: { style: { fontSize: 13, maxWidth: 380, lineHeight: 1.45, padding: "8px 10px" } } }}>
    {children}
  </Tooltip>
);

// ---- pure helpers --------------------------------------------------------
const hasWcm = (aff?: string) => !!aff && WCM_RE.test(aff);

// IO color band (F2): >=90 green, 50-89 amber, <50 muted grey
const ioColor = (v?: number) => (v == null ? "#94a3b8" : v >= 90 ? "var(--pm-slate)" : v >= 50 ? "var(--pm-amber)" : "#94a3b8");
const fmtScore = (v?: number) => (v == null ? "—" : Number.isInteger(v) ? String(v) : v.toFixed(1));
// confidence band (F10): >=0.8 High, 0.5-0.79 Medium, <0.5 Low
const confBand = (c?: number) => (c == null ? "—" : c >= 0.8 ? "High" : c >= 0.5 ? "Medium" : "Low");
// days in a given month (0-indexed) — used to clamp the day when shifting date presets across months
const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
// resolved_at formatting for the "Recent activity" panel — date + time-of-day, seconds included,
// so rapid same-day resolutions stay distinguishable. Mirrors CurateIndividual's
// formatActivityDate (same options), kept as a local copy since the two components don't share
// a helpers module.
const formatActivityDate = (timestamp?: string): string => {
  if (!timestamp) return "—";
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" });
};

const parseCandidates = (json?: string): Candidate[] => {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// T4: a row's candidates in the CandidateLite shape src/lib/bulkAssign.ts's unionCandidates
// and partitionForAssign consume — parseCandidates(candidate_cwids_json) for a multi-candidate
// row (the same JSON the card's Pick-one radios already render from), or the row's own single
// proposed identity for a single-candidate one. Kept here rather than in bulkAssign.ts because
// it depends on parseCandidates/AuthorshipRow, which that pure module deliberately does not.
// `score` is the identity-only score, the same number the card's rail and the row header's
// "top IO" show, so the picker's order matches the cards it summarises. A single-candidate row
// carries it as the row's own top_io_score; a multi row carries one per candidate.
const rowCandidateLites = (row: AuthorshipRow): CandidateLite[] =>
  row.single_candidate
    ? (row.top_cwid ? [{ cwid: row.top_cwid, name: row.top_name, score: row.top_io_score ?? null, person_type: row.top_person_type, dept: row.top_dept }] : [])
    : parseCandidates(row.candidate_cwids_json).map((c) => ({
      cwid: c.cwid, name: c.name, score: c.io_score ?? null, person_type: c.person_type, dept: c.dept,
    }));

// Full Scopus byline from authors_json ([{given,surname}, ...]) as a comma-joined
// "Given Surname" string. "" for absent/malformed/empty input — never throws.
const formatAuthorsJson = (json?: string): string => {
  if (!json) return "";
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return "";
    return parsed
      .map((a: any) => {
        const given = (a?.given || "").trim();
        const surname = (a?.surname || "").trim();
        if (given && surname) return `${given} ${surname}`;
        return given || surname || "";
      })
      .filter(Boolean)
      .join(", ");
  } catch {
    return "";
  }
};

// entrez_date means two different things by lane — the NCBI index date on pubmed rows,
// Scopus's prism:coverDate on scopus rows — so say which one is on screen rather than
// leaving the curator to guess from an unlabelled date (#927). authorship_review has no
// publication-date column at all; adding one is a ReCiterDB producer/schema change, so
// labelling what we already have is the whole of the PM-side fix here.
const dateLabel = (source?: string) => (source === "openalex"
  ? { label: "Published", tip: "OpenAlex publication date for this work. This lane is not in PubMed, so there is no Entrez date." }
  : source === "scopus"
  ? { label: "Cover date", tip: "Scopus cover date (prism:coverDate) — the issue date Scopus carries for this document. This lane is not in PubMed, so there is no Entrez date." }
  : { label: "Indexed", tip: "Date NCBI indexed this record (Entrez date), not the publication date — for a record indexed late the two can differ by years. authorship_review has no publication-date column." });

const btn = (variant: "accept" | "reject" | "soft" | "ghost", disabled?: boolean): CSSProperties => {
  const base: CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 7, padding: "6px 12px",
    font: "inherit", fontSize: 13, fontWeight: 600, cursor: disabled ? "default" : "pointer",
    border: "1px solid transparent", whiteSpace: "nowrap", opacity: disabled ? 0.5 : 1,
  };
  if (variant === "accept") return { ...base, background: "var(--pm-slate)", color: "#fff" };
  if (variant === "reject") return { ...base, background: "#fff", color: "var(--pm-red)", borderColor: "var(--pm-red-tint-border)" };
  if (variant === "soft") return { ...base, background: "var(--pm-slate-tint)", color: "var(--pm-slate)", borderColor: "var(--pm-slate-tint-border)" };
  return { ...base, background: "#fff", color: "#475569", borderColor: "#dde3ea" };
};
const iconBtn = (disabled?: boolean): CSSProperties => ({
  background: "transparent", border: "none", color: "#94a3b8", padding: 6, borderRadius: 6,
  cursor: disabled ? "default" : "pointer", display: "inline-flex", opacity: disabled ? 0.5 : 1,
});

// signal chips (F7)
const Chip = ({ kind, children, style }: { kind: "ok" | "warn" | "neutral"; children: ReactNode; style?: CSSProperties }) => {
  const styles: Record<string, CSSProperties> = {
    ok: { background: "var(--pm-slate-tint)", color: "var(--pm-slate)", borderColor: "transparent" },
    warn: { background: "var(--pm-amber-tint)", color: "var(--pm-amber)", borderColor: "transparent" },
    neutral: { background: "#fff", color: "#475569", borderColor: "#dde3ea" },
  };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, padding: "2px 9px",
      borderRadius: 6, border: "1px solid #dde3ea", ...styles[kind], ...style,
    }}>{children}</span>
  );
};

// The small pill after a candidate's name saying which of their names it is (Candidate.name_source).
const NAME_SOURCE_LABEL: Record<string, string> = {
  primary: "Primary name", directory: "Directory name", alternate: "Alternate name", accepted: "Name on accepted pubs",
};
const nameSourceBadge = (c?: { name_source?: string; name_n?: number }) => {
  const label = c?.name_source ? NAME_SOURCE_LABEL[c.name_source] : undefined;
  if (!c || !label) return null;
  return (
    <Chip kind="neutral" style={{ fontWeight: 400 }}>
      {label}{c.name_source === "accepted" && typeof c.name_n === "number" ? ` · ${c.name_n}` : ""}
    </Chip>
  );
};

const outLinkStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600,
  color: "var(--pm-slate)", textDecoration: "none",
};

// N-line ellipsis clamp. A one-line clamp on a shared line is the worst of both worlds —
// a long title eats the whole line and drags the venue/date off the end with it, leaving
// the curator hovering for a tooltip to read the primary evidence (#927).
const clampStyle = (lines: number): CSSProperties => ({
  display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: lines, overflow: "hidden",
});

// §2.6's meta-line PMID: an outbound PubMed link plus a 22px copy button that flips to a green
// check for 1.4s (mockup:387-394, :798-803). It replaces the old evidence-panel PmidLink — the
// number is now on the collapsed card, so it is not also repeated inside the panel.
// stopPropagation on both, so neither toggles the card open (Item 6).
// `bare`: the number alone, for the expanded row's footer where the key already says "PMID".
const PmidCite = ({ pmid, bare }: { pmid: number; bare?: boolean }) => {
  const [copied, setCopied] = useState(false);
  // cleanup on unmount/re-trigger, so a card removed (accept/reject) inside the 1.4s window
  // can't setState after unmount.
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <a href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`} target="_blank" rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{ color: "var(--pm-slate)", textDecoration: "none", fontVariantNumeric: "tabular-nums" }}>
        {bare ? pmid : `PMID ${pmid}`}
      </a>
      <button
        onClick={(e) => {
          e.stopPropagation();
          navigator.clipboard?.writeText(String(pmid));
          setCopied(true);
        }}
        aria-label="Copy PMID" title="Copy PMID"
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22,
          border: "1px solid #e6e1d9", background: "#fff", borderRadius: 4, padding: 0, cursor: "pointer",
          color: copied ? "var(--pm-slate)" : "#6f7889", flex: "none" }}>
        {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
      </button>
    </span>
  );
};

// ---- Scopus lane bits ----------------------------------------------------
const scopusRecordUrl = (externalId?: string) =>
  externalId ? `https://www.scopus.com/record/display.uri?eid=2-s2.0-${externalId}&origin=inward` : undefined;

// Scopus evidence lead: no PMID — Scopus record + DOI links (mirrors PmidLink's slot).
const ScopusLinks = ({ row: r }: { row: AuthorshipRow }) => {
  const scopusUrl = scopusRecordUrl(r.external_id);
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
      {scopusUrl && (
        <a href={scopusUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={outLinkStyle}>
          Scopus record <IconExt size={13} />
        </a>
      )}
      {r.doi && (
        <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={outLinkStyle}>
          doi.org/{r.doi} <IconExt size={13} />
        </a>
      )}
      {r.container_id && <span style={{ fontSize: 12, color: "#94a3b8" }}>in book {r.container_id}</span>}
      {!scopusUrl && !r.doi && <span style={{ fontSize: 12, color: "#94a3b8" }}>No external link</span>}
    </div>
  );
};

// OpenAlex evidence lead: no PMID — OpenAlex work + DOI links (same slot as ScopusLinks).
const OpenAlexLinks = ({ row: r }: { row: AuthorshipRow }) => {
  const openalexUrl = openalexRecordUrl(r.external_id);
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
      {openalexUrl && (
        <a href={openalexUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={outLinkStyle}>
          OpenAlex record <IconExt size={13} />
        </a>
      )}
      {r.doi && (
        <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={outLinkStyle}>
          doi.org/{r.doi} <IconExt size={13} />
        </a>
      )}
      {!openalexUrl && !r.doi && <span style={{ fontSize: 12, color: "#94a3b8" }}>No external link</span>}
    </div>
  );
};

// §2.6's identity hover card (mockup:337-369). Name + CWID, then whatever of department /
// division / affiliation the row actually carries, then the byline names this person has
// already published under, then what they publish about, then their recent titles.
//
// 460px wide, not the mockup's 296. The card's densest line is an accepted-paper title clamped
// to two lines, so the width is set by how much of a title survives that clamp: at 12.5px with a
// ~0.5em average advance, the two lines hold roughly (width - 65) * 0.32 characters once the
// padding and the flex-none year column are taken out. Measured against all 267,322 non-empty
// analysis_summary_article titles (mean length 102 characters), the share landing whole rather
// than trailing into an ellipsis runs 296px → 21.6%, 380px → 52.4%, 460px → 76.0%, 500px → 84.2%.
// 460 is where that curve flattens: it buys 23.6 points over 380, while another 40px past it buys
// only 8.2 more and starts reading as a side panel rather than a card. Wider is not free — this is
// also the number that decides how often the horizontal-overflow shift below has to fire.
//
// The three states of the names block are deliberately distinct, because two of them look the
// same from the client and mean opposite things:
//   * no answer yet          -> "Loading…"          (the parent's fetch is in flight)
//   * accepted === 0         -> "No accepted papers yet"  (the mockup's line; genuinely none)
//   * accepted > 0, names [] -> says so explicitly   (they HAVE accepted papers, but every one
//                               of them has a blank byline name in person_article — 4,449 such
//                               rows exist WITH userAssertion='ACCEPTED', the only state this
//                               card counts; 5,662 is the all-states figure and is not the
//                               claim. Calling this "no accepted papers" is a lie)
// "115 accepted · 40 rejected · 3 pending · 1983–2024" (years span the accepted papers).
const recordLine = (c: NonNullable<PriorNames["counts"]>): string => {
  const years = c.firstYear && c.lastYear ? (c.firstYear === c.lastYear ? `${c.firstYear}` : `${c.firstYear}–${c.lastYear}`) : "";
  return [`${c.accepted.toLocaleString()} accepted`, `${c.rejected.toLocaleString()} rejected`, `${c.pending.toLocaleString()} pending`, years].filter(Boolean).join(" · ");
};

// The hover card's "names they publish under" columns: name | pubs | share bar | last year.
const HC_FORMS = "minmax(0,1fr) 40px 92px 38px";
type HoverPill = { text: string; tone: "slate" | "amber" | "red" | "muted" };
const HOVER_PILL: Record<HoverPill["tone"], { bg: string; fg: string; bd: string }> = {
  slate: { bg: "var(--pm-slate-tint)", fg: "var(--pm-slate)", bd: "var(--pm-slate-tint-border)" },
  amber: { bg: "var(--pm-amber-tint)", fg: "var(--pm-amber)", bd: "var(--pm-amber-tint-border)" },
  red: { bg: "var(--pm-red-tint)", fg: "var(--pm-red)", bd: "var(--pm-red-tint-border)" },
  muted: { bg: "var(--pm-surface-2)", fg: "var(--pm-muted-foreground)", bd: "var(--pm-border)" },
};
// What the row says about one candidate, as the hover card's pills.
const hoverPills = (c: { io_score?: number | null; given_match?: string; affil_dept_match?: boolean }, affiliation?: string): HoverPill[] => {
  const out: HoverPill[] = [];
  const band = ioBandOf(c.io_score);
  if (band) out.push({ text: `IO ${ioScoreText(c.io_score)}`, tone: band === "High" ? "slate" : band === "Medium" ? "amber" : "red" });
  if (c.given_match === "full") out.push({ text: "Full given name", tone: "slate" });
  if (c.affil_dept_match) out.push({ text: "Dept in affiliation", tone: "slate" });
  if (hasWcm(affiliation)) out.push({ text: "WCM in affiliation", tone: "slate" });
  return out;
};

const IdentityHoverCard = ({ subject, priorNames, byline, pills }: {
  // Takes a plain identity rather than an AuthorshipRow so the multi-candidate list can show
  // the same card per CANDIDATE. It was row-shaped and therefore single-candidate-only, which
  // is precisely backwards: the row that needs an identity dossier most is the homonym row
  // asking a curator to choose among five people with the same surname.
  subject: { name?: string; cwid?: string; dept?: string; division?: string; institution?: string; person_type?: string; name_source?: string; name_n?: number };
  priorNames?: PriorNames;
  // The row's byline, so the card can say when it is not one of their accepted names.
  byline?: string;
  // What this row already says about the match ("IO 99 · High", "Full given name", …).
  pills?: HoverPill[];
}) => {
  const r = subject;
  const id = priorNames?.identity;
  // Only worth the line when it says something the header does not: a legal name that differs
  // from the publishing name is the useful case, an identical pair is noise.
  const norm = (x?: string) => (x || "").replace(/\s+/g, " ").trim().toLowerCase();
  const showLegal = !!id?.legalName && norm(id.legalName) !== norm(id.publishingName) && norm(id.legalName) !== norm(r.name);
  const showPublishing = !!id?.publishingName && norm(id.publishingName) !== norm(r.name);
  const hasDetail = !!(r.dept || r.division || r.institution || id?.title);
  // Only when the list is complete (`more` absent): a capped list can't prove a form is missing.
  // Accents and periods are ignored ("Nicolás" = "Nicolas", "Y. S." = "Y S").
  const formKey = (x: string) => norm(x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\./g, " "));
  const bylineMiss = !!byline && !!priorNames?.names.length && !priorNames.more &&
    !priorNames.names.some((p) => formKey(`${p.first} ${p.last}`) === formKey(byline));
  // A namesake needs an accepted baseline: with no accepted papers every rejected byline,
  // their own name included, would be listed as someone else's.
  const showNamesakes = !!priorNames?.namesakes?.length && priorNames.accepted > 0;
  // Which way the card opens, measured rather than assumed. It was hard-coded to open DOWN and
  // LEFT-ALIGNED, which is right for a row near the top of a long scrolling queue and wrong for
  // every row near the bottom of the window: the card ran off the bottom edge and the ACCEPTED
  // PAPERS block — the block a curator hovers FOR — was unreadable. Nothing on the row can know
  // this; it is a property of where the row happens to sit in the viewport at hover time, so it
  // has to come off getBoundingClientRect.
  //
  // Re-measured when priorNames lands, and that dependency is the actual fix. The card mounts as
  // a one-line "Loading…" box and roughly triples in height when the fetch resolves, so a flip
  // decided on the short box is a flip decided on the wrong height — it fits below, then the
  // content arrives and it does not. Adding TOPICS made that worse, not better.
  //
  // useLayoutEffect, not useEffect: React flushes a layout effect's re-render before the browser
  // paints, so the corrected placement is the FIRST thing painted and the card never appears in
  // one spot and jumps to another. (Safe on the server too — the card only ever renders behind a
  // hover state that starts false, so it is never part of an SSR pass.)
  //
  // ponytail: mount and data-arrival only, no scroll or resize listener, and no library. The
  // card lives exactly as long as one hover and closes on mouseleave, so a mid-hover scroll is
  // not a state worth subscribing to. CSS anchor positioning (`position-try-fallbacks`) would
  // delete this whole effect, but it is still Chromium-only — not something an internal tool can
  // assume — so the measurement stays until it is safe everywhere.
  const cardRef = useRef<HTMLSpanElement>(null);
  const bodyRef = useRef<HTMLSpanElement>(null);
  const [place, setPlace] = useState({ up: false, dx: 0, max: 0 });
  useLayoutEffect(() => {
    const el = cardRef.current;
    const body = bodyRef.current;
    // offsetParent, not parentElement: it IS the box `top`/`left` below resolve against (the
    // position:relative hover target both call sites wrap the card in), so the two can never
    // disagree if someone adds a wrapper element later.
    const anchor = el?.offsetParent;
    if (!el || !body || !anchor) return;
    const a = anchor.getBoundingClientRect();
    // Breathing room from the viewport edge, both axes, counted twice: once for this span's own
    // 8px stand-off from the anchor and once to keep the card off the window edge itself.
    const GAP = 8;
    // clientWidth/clientHeight, NOT window.innerWidth/innerHeight: the window figures include the
    // scrollbar, the layout viewport does not. On a platform with classic ~15px scrollbars
    // (Windows/Linux Chrome — this is an internal tool, not a mac-only one) the window number
    // would say there is room that does not exist, and the card would clip or force a horizontal
    // scroll. Invisible on macOS overlay scrollbars, which is the easy way to never notice it.
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    // The app header is position:sticky at the top of the viewport (Header.module.css .topNav)
    // and z-indexed over everything, so the room ABOVE an anchor ends at its bottom edge, not at
    // y=0 — measured from a.top alone, a card flipped upward ran its header (name, cwid — the
    // identifying part) underneath the app header (owner screenshot 2026-09-15).
    // ponytail: found by class-name substring — CSS modules hash the name but keep it in there.
    const hdr = document.querySelector<HTMLElement>('[class*="topNav"]')?.getBoundingClientRect().bottom || 0;
    const below = vh - a.bottom - GAP * 2;
    const above = a.top - hdr - GAP * 2;
    // The card's NATURAL height, off the body's scrollHeight rather than the positioner's
    // offsetHeight. This is what keeps the effect idempotent now that `max` clamps the body:
    // offsetHeight would come back already-clamped on the second run, the card would look like
    // it fits, and the placement would oscillate. scrollHeight ignores the clamp.
    const natural = body.scrollHeight;
    // Flip only when it does NOT fit below and there is genuinely more room above. Fitting below
    // always wins, because opening downward keeps the header — name, cwid, department — adjacent
    // to the row the pointer is on.
    const up = natural > below && above > below;
    // …and then never let either direction clip. Choosing by "which side is bigger" is only safe
    // because of this clamp: a 610px card on an ~800px viewport fits NEITHER side for a row in
    // the middle of the window, and an unclamped flip would cut the card off at the TOP, which is
    // exactly where the identifying header lives. Clipping the bottom of the paper list is a
    // survivable loss; clipping the name off the top of a homonym disambiguation card is not.
    // Scrolling is also recoverable in a way clipping is not — the curator can reach the rest
    // without moving the pointer off the anchor and dismissing the card.
    const max = Math.max(120, up ? above : below);
    // Right-edge overflow shifts the card left, but only as far as the left edge allows: a card
    // pushed past 0 is worse than one clipped on the right, because the name and cwid — the two
    // things that identify which person this card is even about — live at its left.
    const over = a.left + el.offsetWidth + GAP - vw;
    const dx = over > 0 ? -Math.min(over, Math.max(0, a.left - GAP)) : 0;
    // Idempotent: every input is read off the ANCHOR or off the unclamped content height, never
    // off the card's own current placement, so re-running on the corrected layout computes the
    // same answer. Returning the previous object makes React bail out instead of looping.
    setPlace((p) => (p.up === up && p.dx === dx && p.max === max ? p : { up, dx, max }));
  }, [priorNames]);
  const label: CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--pm-muted-foreground)" };
  const muted: CSSProperties = { color: "var(--pm-muted-foreground)" };
  const org = [r.dept, r.division || id?.division, r.person_type, r.institution].map((x) => (x || "").trim()).filter(Boolean).join(" · ");
  const formTotal = (priorNames?.names || []).reduce((t, p) => t + p.n, 0) || 1;
  const thisForm = (p: { first: string; last: string }) => !!byline && formKey(`${p.first} ${p.last}`) === formKey(byline);
  const topN = (xs: Array<{ label: string; n: number }>) => xs.map((x) => (x.n > 1 ? `${x.label} (${x.n.toLocaleString()})` : x.label)).join(" · ");
  const counts = priorNames?.counts;
  const hasCounts = !!counts && counts.accepted + counts.rejected + counts.pending > 0;
  const grid: Array<[string, ReactNode, CSSProperties?]> = [];
  if (hasCounts) grid.push(["Record", recordLine(counts!)]);
  if (priorNames?.topics?.length) grid.push(["Topics", priorNames.topics.map((t) => t.keyword).join(" · ")]);
  if (priorNames?.journals?.length) grid.push(["Journals", topN(priorNames.journals.map((j) => ({ label: j.journal, n: j.n })))]);
  if (priorNames?.coauthors?.length) grid.push(["Co-authors", topN(priorNames.coauthors.map((c) => ({ label: c.name, n: c.n })))]);
  if (showNamesakes) grid.push(["Not them", topN(priorNames!.namesakes!.map((x) => ({ label: `${x.first} ${x.last}`.trim(), n: x.n }))), { color: "var(--pm-red)" }]);
  if (priorNames?.papers?.length) grid.push(["Recent", (
    <span key="recent" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {priorNames.papers.slice(0, 3).map((p) => (
        <span key={p.pmid} title={p.title} style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {p.year && <span style={{ ...muted, fontVariantNumeric: "tabular-nums" }}>{p.year} </span>}{p.title}
        </span>
      ))}
    </span>
  )]);
  return (
    <span ref={cardRef} onClick={(e) => e.stopPropagation()} data-hovercard
      style={{
        position: "absolute", zIndex: 60, width: 370, maxWidth: "calc(100vw - 48px)", display: "block", cursor: "default",
        left: place.dx,
        // The 6px stand-off travels with the card: it has to sit between the card and the
        // anchor, which is the other side of the box once flipped.
        top: place.up ? "auto" : "100%", bottom: place.up ? "100%" : "auto",
        paddingTop: place.up ? 0 : 6, paddingBottom: place.up ? 6 : 0,
      }}>
      <span ref={bodyRef} role="dialog" aria-label={r.name || r.cwid} style={{
        display: "flex", flexDirection: "column", gap: 9, background: "#fff", border: "1px solid var(--pm-border-strong)",
        borderRadius: 10, boxShadow: "0 10px 28px rgba(34,30,28,0.14)", padding: "12px 14px",
        fontSize: 12.5, lineHeight: 1.45, fontWeight: 400, letterSpacing: 0, color: "var(--pm-foreground)", textAlign: "left", whiteSpace: "normal",
        // 0 until the effect has measured, which is the pre-paint pass — never a visible state.
        // When the content is shorter than the room available this is inert.
        ...(place.max ? { maxHeight: place.max, overflowY: "auto" as const } : {}) }}>
        <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: 13.5 }}>{r.name || r.cwid}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--pm-muted-foreground)" }}>{r.cwid}</span>
            {nameSourceBadge(r)}
          </span>
          {id?.title && <span style={muted}>{id.title}</span>}
          {org && <span style={muted}>{org}</span>}
          {(showLegal || showPublishing) && (
            <span style={muted}>
              {showPublishing && <>Publishes as {id!.publishingName}</>}
              {showPublishing && showLegal && " · "}
              {showLegal && <>Directory name {id!.legalName}</>}
            </span>
          )}
        </span>
        {!priorNames ? (
          <span style={muted}>Loading…</span>
        ) : priorNames.accepted === 0 ? (
          <span style={{ ...muted, borderTop: "1px solid var(--pm-border)", paddingTop: 9 }}>No curated publications yet.</span>
        ) : priorNames.names.length === 0 ? (
          <span style={muted}>
            {priorNames.accepted.toLocaleString()} accepted paper{priorNames.accepted === 1 ? "" : "s"}, none with a byline name recorded
          </span>
        ) : (
          <span style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={label}>Names they publish under</span>
            <span style={{ display: "block", border: "1px solid var(--pm-border)", borderRadius: 7, overflow: "hidden" }}>
              <span style={{ display: "grid", gridTemplateColumns: HC_FORMS, gap: 8, alignItems: "center", padding: "5px 9px", background: "var(--pm-surface-2)",
                fontSize: 10.5, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--pm-muted-foreground)" }}>
                <span>Name as published</span><span style={{ textAlign: "right" }}>Pubs</span><span>Share</span><span style={{ textAlign: "right" }}>Last</span>
              </span>
              {priorNames.names.map((p, i) => {
                const mine = thisForm(p);
                const pct = `${Math.max(1, Math.round((100 * p.n) / formTotal))}%`;
                return (
                  <span key={`${p.last}|${p.first}|${i}`} data-form={mine ? "this" : undefined} style={{ display: "grid", gridTemplateColumns: HC_FORMS, gap: 8, alignItems: "center",
                    padding: "5px 9px", borderTop: "1px solid var(--pm-border)", background: mine ? "var(--pm-slate-tint)" : "#fff", fontSize: 12.5 }}>
                    <span style={{ minWidth: 0, display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: mine ? 600 : 500 }}>{`${p.first} ${p.last}`.trim()}</span>
                      {mine && <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--pm-slate)", whiteSpace: "nowrap" }}>this byline</span>}
                    </span>
                    <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{p.n.toLocaleString()}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--pm-surface-2)", overflow: "hidden" }}>
                        <span style={{ display: "block", height: 6, width: pct, background: "var(--pm-slate)" }} />
                      </span>
                      <span style={{ fontSize: 11, color: "var(--pm-muted-foreground)", fontVariantNumeric: "tabular-nums", width: 28, textAlign: "right" }}>{pct}</span>
                    </span>
                    <span style={{ textAlign: "right", fontSize: 11.5, color: "var(--pm-muted-foreground)", fontVariantNumeric: "tabular-nums" }}>{p.lastYear || ""}</span>
                  </span>
                );
              })}
            </span>
            {!!priorNames.more && (
              <span style={{ fontSize: 11.5, ...muted }}>+{priorNames.more.toLocaleString()} more form{priorNames.more === 1 ? "" : "s"}</span>
            )}
            {bylineMiss && (
              <span style={{ fontSize: 11.5, color: "var(--pm-amber)", fontWeight: 500 }}>This byline (“{byline}”) isn’t one of the names they’ve published under.</span>
            )}
          </span>
        )}
        {!!pills?.length && (
          <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {pills.map((p) => (
              <span key={p.text} style={{ height: 20, padding: "0 7px", display: "inline-flex", alignItems: "center", borderRadius: 999, fontSize: 11.5,
                background: HOVER_PILL[p.tone].bg, color: HOVER_PILL[p.tone].fg, border: `1px solid ${HOVER_PILL[p.tone].bd}` }}>{p.text}</span>
            ))}
          </span>
        )}
        {grid.length > 0 && (
          <span style={{ display: "grid", gridTemplateColumns: "96px minmax(0,1fr)", gap: "5px 10px", borderTop: "1px solid var(--pm-border)", paddingTop: 9 }}>
            {grid.map(([k, v, st]) => (
              <span key={k} style={{ display: "contents" }}>
                <span style={label}>{k}</span><span style={{ minWidth: 0, ...st }}>{v}</span>
              </span>
            ))}
          </span>
        )}
        {r.cwid && (
          <a href={`/curate/${r.cwid}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
            style={{ fontSize: 12.5, width: "fit-content", color: "var(--pm-slate)" }}>Open curation page →</a>
        )}
      </span>
    </span>
  );
};

// ---- main component ------------------------------------------------------
const AuthorshipsTabs = () => {
  const [rows, setRows] = useState<AuthorshipRow[]>([]);
  const [count, setCount] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  // The exact summary body `summary` came back for, and the ordering guard that keeps a slow
  // earlier response from overwriting a fast later one. Both exist for the on-demand
  // Article-affiliation facet — see fetchSummary and authorFacetsReady.
  const [summaryFor, setSummaryFor] = useState("");
  const summarySeqRef = useRef(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  // Rows matching the current filters beyond this page, pulled by "Select all N matching".
  // Held apart from `rows` because the bulk loop needs off-page rows the feed never loaded.
  const [allMatching, setAllMatching] = useState<AuthorshipRow[] | null>(null);
  const [selectingAll, setSelectingAll] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  // The raw text box. Debounced (300 ms) into the `search` filter below — deliberately NOT a
  // filter itself, so typing does not fire a request per keystroke.
  const [searchInput, setSearchInput] = useState("");
  // A label for the dateFrom/dateTo pair, not a filter of its own: "Custom…" changes only this
  // and must not refetch. Kept out of the filter object for exactly that reason.
  const [datePreset, setDatePreset] = useState(DEFAULT_DATE_PRESET); // "any"|"30d"|"90d"|"6m"|"12m"|"24m"|"custom"
  // The default window is applied on mount (client-side, below) so the statically-prerendered
  // initial render stays date-free and hydrates cleanly; the first list fetch waits on this.
  const [datesReady, setDatesReady] = useState(false);
  // Which filter chip's list is open (queue | match | ptype | inst | ainst | pubType | date |
  // hide), or null. One value for the whole chip row, so at most one list is ever up.
  const [chipMenu, setChipMenu] = useState<string | null>(null);
  // The search box inside the two affiliation lists. Cleared whenever a chip opens.
  const [affilQuery, setAffilQuery] = useState("");
  const [keysAnchor, setKeysAnchor] = useState<HTMLElement | null>(null);
  const keysBtnRef = useRef<HTMLButtonElement>(null);
  // The sort Select's own menu. Tracked so the row shortcuts stand down while it is open.
  const [sortOpen, setSortOpen] = useState(false);
  // §2.1: the explanatory paragraph is always-on today; it becomes collapsed-by-default behind
  // the "What am I looking at?" link (mockup:576 — aboutOpen starts false). `false` on both the
  // server render and the client's first paint, so nothing here can diverge at hydration.
  const [aboutOpen, setAboutOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  // ---- canned reports: state, deliberately outside AuthorshipFilters -----
  // See the ReportView type for why this is a sibling of the filter object rather than a member
  // of it. Everything here is view state for the report panel; none of it reaches
  // buildFilterBody, the chip row, or FILTER_DEFAULTS.
  const [reportView, setReportView] = useState<ReportView>(null);
  const [reportAnchor, setReportAnchor] = useState<HTMLElement | null>(null);
  const [reportData, setReportData] = useState<ReportResponse | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  // Which person groups are open. A Set rather than the card list's single `expanded` id: the
  // interesting cases in these reports are the people with several rows (~1,065 rows across 816
  // people, so most groups are one row and the tail is what matters), and comparing two of them
  // side by side is the point. Reset whenever the report or its filters change — a cwid held
  // open across a different result set means nothing.
  const [expandedPeople, setExpandedPeople] = useState<Set<string>>(new Set());
  // Same last-write-wins guard fetchData/fetchSummary use: two report requests have very
  // different result sizes, so a slow earlier one must not repaint over a fast later one.
  const reportSeqRef = useRef(0);

  // ---- filters: one object, one set of writers --------------------------
  // See AuthorshipFilters / FILTER_DEFAULTS above for what belongs in here and what does not.
  // filterBody() and the ephemeral-clear effect below both depend on THIS OBJECT, so adding a
  // filter cannot leave either dependency array behind.
  const [filters, setFilters] = useState<AuthorshipFilters>(INITIAL_FILTERS);
  // Destructured so every consumer below still reads plain `lane`, `statusView`, `sort`, …
  const {
    lane, classification, search, selectedTypes, selectedInstitutions, selectedAuthorAffiliations,
    source, selectedPubTypes, dateFrom, dateTo, sort, statusView,
    hideNoSuggestion, hideNoIdentity, likeAuthor,
  } = filters;

  // The single writer. Returns the SAME object when nothing actually changes, so re-picking the
  // value a control already holds stays the no-op it was when each filter had its own useState
  // (React bails out on identical primitive state). Without that guard, clicking the already-
  // active chip — or the source effect re-clearing an already-empty pub-type list — would mint
  // a new object, refetch the page and wipe the curator's selection.
  const patchFilters = useCallback((patch: Partial<AuthorshipFilters> | ((prev: AuthorshipFilters) => Partial<AuthorshipFilters>)) => {
    setFilters((prev) => {
      const p = typeof patch === "function" ? patch(prev) : patch;
      const changed = (Object.keys(p) as Array<keyof AuthorshipFilters>)
        .filter((k) => (p as any)[k] !== undefined && !sameFilterValue(prev[k], (p as any)[k]));
      if (changed.length === 0) return prev;
      const next: AuthorshipFilters = { ...prev };
      changed.forEach((k) => { (next as any)[k] = (p as any)[k]; });
      return next;
    });
  }, []);
  const setFilter = useCallback(<K extends keyof AuthorshipFilters>(
    key: K, value: AuthorshipFilters[K] | ((prev: AuthorshipFilters[K]) => AuthorshipFilters[K]),
  ) => {
    patchFilters((prev) => ({
      [key]: typeof value === "function" ? (value as (p: AuthorshipFilters[K]) => AuthorshipFilters[K])(prev[key]) : value,
    } as Partial<AuthorshipFilters>));
  }, [patchFilters]);

  // One named writer per filter, so the ~30 call sites below read exactly as they did when each
  // filter was its own useState. These are the only way anything reaches `filters`.
  type SetFilter<K extends keyof AuthorshipFilters> =
    (v: AuthorshipFilters[K] | ((prev: AuthorshipFilters[K]) => AuthorshipFilters[K])) => void;
  // No standalone setLane/setClassification any more: the two chip strips they backed are gone,
  // and the only control over either axis is the single MATCH CLASS list, which must write BOTH
  // together. narrowToPmid ("+N more WCM on this paper") is the one other writer, and it patches
  // both in one go for the same reason.
  // MATCH CLASS is ONE single-select list over TWO server axes (HANDOFF §3a): picking a lane
  // entry resets the classification to its all-value and vice versa. Writing both in a single
  // patch is what makes that a cross-axis RESET rather than two independent changes — one
  // refetch, one selection clear, and no state where the list highlights an entry the queue is
  // not actually showing. The one cross-filter reset the redesign adds; it follows the existing
  // source -> setSelectedPubTypes([]) precedent.
  const selectMatchClass = useCallback((opt: MatchClassOption) => {
    patchFilters({ lane: opt.lane, classification: opt.classification });
  }, [patchFilters]);
  const setSearch: SetFilter<"search"> = useCallback((v) => setFilter("search", v), [setFilter]);
  const setSelectedTypes: SetFilter<"selectedTypes"> = useCallback((v) => setFilter("selectedTypes", v), [setFilter]);
  // curated institution filter (multiselect) — mirrors selectedTypes/typeAnchor exactly, one
  // bucket key (see INSTITUTION_LABELS) per selection rather than a raw personTypes string.
  const setSelectedInstitutions: SetFilter<"selectedInstitutions"> = useCallback((v) => setFilter("selectedInstitutions", v), [setFilter]);
  // ARTICLE AFFILIATION — the byline-basis half of the Affiliation popover. Its own key, so
  // choosing an article affiliation never disturbs the identity list beside it (the two are
  // ANDed, not alternatives), nor sort / dates / class.
  const setSelectedAuthorAffiliations: SetFilter<"selectedAuthorAffiliations"> = useCallback((v) => setFilter("selectedAuthorAffiliations", v), [setFilter]);
  const setSource: SetFilter<"source"> = useCallback((v) => setFilter("source", v), [setFilter]);
  const setSelectedPubTypes: SetFilter<"selectedPubTypes"> = useCallback((v) => setFilter("selectedPubTypes", v), [setFilter]);
  const setDateFrom: SetFilter<"dateFrom"> = useCallback((v) => setFilter("dateFrom", v), [setFilter]);
  const setDateTo: SetFilter<"dateTo"> = useCallback((v) => setFilter("dateTo", v), [setFilter]);
  // default sort = IO desc (Highest Identity-Only Score, UI refresh 4a, 2026-11-09); Newest
  // from 2026-09-15 to then, IO desc before that. top_confidence
  // (the matcher's identity-match heuristic, not an authorship-likelihood score) was the
  // prior default, but it's near-constant across the queue — most rows land on the same
  // base value for a given given-name-match/affiliation-match combo — so it silently fell
  // through to the pmid tiebreaker for the vast majority of rows (live-verified: 19/20 on
  // one real page tied at 0.65, ordered only by pmid, unrelated to what's shown on the card).
  // Never cleared by "Reset all" (RESET_EXEMPT) and never a chip.
  const setSort: SetFilter<"sort"> = useCallback((v) => setFilter("sort", v), [setFilter]);
  const setStatusView: SetFilter<"statusView"> = useCallback((v) => setFilter("statusView", v), [setFilter]);
  // hide rows with no proposed identity at all (#938 — top_cwid null, the "No suggested
  // identity" pill below) — a real filter sent to the server (buildWhere) rather than sliced
  // client-side, so it stays consistent with the total count and "Select all N matching"
  // (authorshipSelectable shares the same buildWhere). Deliberately does NOT also hide "No
  // ReCiter identity" rows (identity_in_reciter===false) — that's hideNoIdentity below.
  const setHideNoSuggestion: SetFilter<"hideNoSuggestion"> = useCallback((v) => setFilter("hideNoSuggestion", v), [setFilter]);
  // hide rows proposing a person with no ReCiter identity (identity_in_reciter===false — a
  // person IS proposed, just not yet in ReCiter). Complements hideNoSuggestion above. The
  // per-page identity_in_reciter flag is resolved fresh against DynamoDB after LIMIT/OFFSET
  // and can't drive a WHERE clause directly, so the server keeps a short-TTL cache of the
  // "absent" cwid set instead of resolving identity for the whole matching set on every list
  // load — by the time it reaches buildWhere this is also a plain SQL predicate.
  const setHideNoIdentity: SetFilter<"hideNoIdentity"> = useCallback((v) => setFilter("hideNoIdentity", v), [setFilter]);
  // T5: "Show N others like this" — a structured filter (the anchor row's raw wcm_author),
  // independent of the free-text search box above. The server (buildWhere's likeAuthor block)
  // turns this into the normalized-key equality match authorKey() defines, not a LIKE
  // substring, so a middle-initial variant like "Bernard J. Park" is found starting from
  // "Bernard Park" and vice versa — the case the free-text box's LIKE cannot cover. Cleared by
  // the dismissible "Like: …" chip near the filter row.
  const setLikeAuthor: SetFilter<"likeAuthor"> = useCallback((v) => setFilter("likeAuthor", v), [setFilter]);
  // Resolve the LAST row in a "Show N others like this" view and the filter drops itself, so the
  // curator lands back in the queue instead of staring at an empty list with a "Like: …" chip
  // they now have to notice and dismiss by hand. The whole point of that view is to work a
  // cluster of one person's bylines to exhaustion, so exhausting it IS the exit.
  //
  // Declarative on purpose, rather than a clause inside the action handler. doActionAsync runs
  // once PER ROW and reads a rows mirror that has not re-rendered yet, so a bulk accept of the
  // final three rows would see three remaining on every call and never fire. Keying off "the
  // list is now empty" catches single, bulk, keyboard and undo-redo paths alike.
  //
  // Guarded on !loading so it cannot fire against the empty rows a fetch shows mid-flight, and
  // scoped to likeAuthor: every other filter is one the curator chose and should keep.
  //
  // #1011: exits via clearLikeAuthor (through a ref, since that callback is declared further
  // down), so the auto-exit ALSO restores the filters the button widened away. Clearing
  // likeAuthor alone would drop the curator back into a queue silently missing their chips.
  const clearLikeRef = useRef<() => void>();
  useEffect(() => {
    if (!loading && rows.length === 0 && filters.likeAuthor.trim()) clearLikeRef.current?.();
  }, [loading, rows.length, filters.likeAuthor]);
  const [actingId, setActingId] = useState<number | null>(null);
  // scopus Accept/Assign can 409 on a likely-duplicate ExternalArticle; the backend retries past
  // it with force:"true". This holds the pending action so the curator can confirm "Force add".
  // active conflicts, keyed by row id (a row's card renders its own entry inline — see
  // ConflictEntry doc comment) — plus a capped rolling log of every one seen this session
  // for the "recent conflicts" history list, independent of whether it's still active.
  const [conflicts, setConflicts] = useState<Record<number, ConflictEntry>>({});
  const [conflictLog, setConflictLog] = useState<ConflictEntry[]>([]);
  const [historyAnchor, setHistoryAnchor] = useState<HTMLElement | null>(null);
  // server-backed "Recent activity" feed (the 15 most-recently-resolved rows, global across
  // curators/sessions) — parallel to conflictLog/historyAnchor above, but fetched rather than
  // accumulated client-side.
  const [recentActivity, setRecentActivity] = useState<ActivityEntry[]>([]);
  const [activityAnchor, setActivityAnchor] = useState<HTMLElement | null>(null);
  // §2.6's identity hover card, cached per cwid for the life of the page. Held HERE rather than
  // in the card so paging back and forth, or hovering the same person on two rows, costs one
  // request in total — the answer ("which byline names has this cwid published under") does not
  // change while a curator works a queue.
  const [priorNames, setPriorNames] = useState<Record<string, PriorNames>>({});
  // Every cwid already asked for, in-flight ones included. This is what makes the hover safe:
  // the request fires at most once per cwid no matter how many times the pointer crosses the
  // name, and the card's own hover-intent delay (see the card) keeps a mouse sweeping down the
  // page from asking for every row it passes over.
  const priorNamesAsked = useRef<Set<string>>(new Set());
  const clearConflict = useCallback((id: number) => {
    setConflicts((c) => { if (!(id in c)) return c; const n = { ...c }; delete n[id]; return n; });
  }, []);
  const [menu, setMenu] = useState<{ anchor: HTMLElement; row: AuthorshipRow } | null>(null);
  // F4: undo holds a BATCH of rows (single-row actions push a 1-element batch)
  const [undo, setUndo] = useState<{ rows: AuthorshipRow[]; label: string } | null>(null);
  // The list request failed (HTTP error or network). Shown in the list card with a Retry instead
  // of the empty state, which would claim nothing matches. Cleared by the next good response.
  const [listError, setListError] = useState(false);
  // selection (bulk) — T4: single-candidate accept-eligible rows AND (now) open, non-scopus
  // multi-candidate rows (see isBulkSelectable) — the latter for bulk-ASSIGN only.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // multi-candidate: chosen cwid per row id
  const [picked, setPicked] = useState<Record<number, string>>({});
  // For the keyboard handler, which is bound once: Y on a multi-candidate row assigns the pick.
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  // T4/B-8: "Assign selected (N) to…" — anchor opens the candidate-union picker; choosing a
  // target (typed or from the union) fires ONE server lookup (authorshipLookupCwid) rather than
  // submitting anything, so assignLookupCwid holds the in-flight typed/picked string while that
  // resolves, and assignConfirm holds what the lookup returned (canonical cwid, name,
  // hasIdentity) plus the on/off-candidate split (partitionForAssign) until the curator
  // confirms. All null/empty when the picker/lookup/confirm step is closed.
  const [assignMenuAnchor, setAssignMenuAnchor] = useState<HTMLElement | null>(null);
  const [assignOtherCwid, setAssignOtherCwid] = useState("");
  const [assignLookupCwid, setAssignLookupCwid] = useState<string | null>(null);
  // PR 5: the "Someone else" box's one-line answer ("3 people match …"), shown in the popover.
  const [assignErr, setAssignErr] = useState("");
  // Bumped whenever the popover opens or closes, so a lookup still in flight from a popover the
  // curator has since closed lands nowhere. Without it a late answer set assignConfirm with the
  // popover shut, and overlayOpen then held every row shortcut off until it was reopened.
  const assignSeqRef = useRef(0);
  const [assignConfirm, setAssignConfirm] = useState<{
    cwid: string; name?: string | null; hasIdentity: boolean;
    onCandidate: AuthorshipRow[]; offCandidate: AuthorshipRow[];
  } | null>(null);
  // T-950: "Reject selected (N)" — unlike assign there's no server lookup step (reject never
  // targets a typed cwid; every row acts on its OWN proposed candidate(s)), so this is just a
  // confirm gate in front of doBulkReject — open while the dialog is up, closed otherwise.
  const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false);
  // F13: keyboard focus
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const cardRefs = useRef<Record<number, HTMLElement | null>>({});
  // Expanding a card anchors it to the top of the viewport (owner request 2026-09-15): the
  // expanded panel is tall, and a card opened near the bottom of the window put its header —
  // the byline, the "choose among N" line, the paper — above the fold behind the sticky app
  // header. block:"start" plus the card's scrollMarginTop (the header's height) lands its top
  // edge just below that header. Collapsing scrolls nothing.
  useEffect(() => {
    if (expanded != null) cardRefs.current[expanded]?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [expanded]);
  // ids optimistically removed by a curator action whose server write may still be in flight.
  // Guards the rolling-queue refill (topUp/fetchData) from resurrecting a just-actioned row when
  // a sibling action hasn't committed yet (rapid-accept race). Cleared per-id once its POST settles.
  const pendingRemoved = useRef<Set<number>>(new Set());
  // Monotonic request-sequence guard shared by fetchData and topUp. Each list request captures the
  // sequence at dispatch and discards its response if a newer request has since started — last-write-
  // wins, so a stale-filter/offset response (e.g. an out-of-range offset returning {rows:[]}) can't
  // clobber the current page or append rows from an abandoned filter.
  const seqRef = useRef(0);
  // Live mirrors of state the stable window-keydown listener and the focus-advance logic read
  // without re-subscribing. Kept in sync below so the single keydown handler always sees current
  // rows/focus/view rather than the values captured when it was registered.
  const rowsRef = useRef<AuthorshipRow[]>([]);
  const focusedIdRef = useRef<number | null>(null);
  const statusViewRef = useRef(statusView);
  // "is any overlay this component owns currently up?" — read by the same stable keydown
  // listener, which must not act on the row behind an open popover/menu/dialog.
  const overlayOpenRef = useRef(false);
  // "is a canned report on screen instead of the card list?" — read by that same listener.
  const reportViewRef = useRef<ReportView>(null);
  // latest action handlers, so the stable keydown listener invokes the current closures
  const doActionRef = useRef<(row: AuthorshipRow, action: string, extra?: Record<string, any>) => void>();
  const toggleSelectRef = useRef<(row: AuthorshipRow) => void>();
  const doUndoRef = useRef<() => void>();

  // The posted filter body is built by buildFilterBody() above from the whole filter object, so
  // this dependency array is the object itself: there is no per-filter name left to forget, and
  // a filter that never reaches the body is caught by
  // `node scripts/check-authorships-filter-body.mjs` rather than by a curator seeing stale rows.
  const filterBody = useCallback(() => buildFilterBody(filters), [filters]);

  // keep the refs the (stable) keydown listener reads in sync with the latest render
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  useEffect(() => { focusedIdRef.current = focusedId; }, [focusedId]);
  useEffect(() => { statusViewRef.current = statusView; }, [statusView]);
  // Every overlay this component owns, in one expression: the four control popovers, the three
  // MUI menus (row overflow, the two history panels), the bulk-assign popover (its lookup and
  // confirm step live inside it), and the reject confirm layer. The
  // keyboard handler bails while any of them is up.
  const overlayOpen = !!chipMenu || !!keysAnchor || sortOpen
    || !!reportAnchor
    || !!menu || !!assignMenuAnchor || !!historyAnchor || !!activityAnchor
    || !!assignLookupCwid || !!assignConfirm || rejectConfirmOpen;
  useEffect(() => { overlayOpenRef.current = overlayOpen; }, [overlayOpen]);
  const keysOpenRef = useRef(false);
  useEffect(() => { keysOpenRef.current = !!keysAnchor; }, [keysAnchor]);
  // A report REPLACES the card list, and the keydown listener reads rowsRef, which the feed
  // keeps populated underneath. Without this the y/n/s keys would accept, reject or snooze a
  // row the curator cannot see. Its own ref rather than a term in overlayOpen above: a report
  // is not an overlay, it is a different view, and folding it in there would make that
  // expression's name a lie.
  useEffect(() => { reportViewRef.current = reportView; }, [reportView]);

  // `silent` skips the loading flag, which is what unmounts the whole card list below (the
  // {loading && …}/{!loading && rows.map(…)} gate) — a curator scrolled into the middle of the
  // page loses their place the instant that gate flips, because the DOM collapses to a single
  // "Loading…" line and back. Rows are keyed by r.id, so a normal (non-silent) setRows already
  // reconciles in place without disturbing scroll; the gate is what actually causes the jump.
  // Use silent for every "restore/refresh the SAME view after acting on a row" call (a failed
  // action putting the optimistically-removed row back, a bulk-accept partial failure, an
  // undo) — none of those are navigation, so none of them should move the reader. Leave it
  // non-silent for the one effect below that fires on an actual filter/status/page change,
  // where landing back at the top is the reasonable, expected behaviour.
  // A response must be discarded when the filters it was built from are no longer the filters on
  // screen. The seq refs order requests, but the stale one here is typically the NEWEST, so they
  // cannot catch it: doAction's .then() calls topUp/fetchSummary through closures bound to
  // whatever filterBody was current when the row was clicked, so an action resolving AFTER a
  // filter change re-queries the OLD view and repaints it over the new one.
  //
  // Seen in prod: resolving the last row of a "like" view races the auto-exit that emptying the
  // view triggers. The restore fires its own correct fetch, then the action settles and its
  // stale trio lands on top — the spent view's count:0 over the restored queue's 2,281 rows, so
  // the curator reads "No authorships match these filters" about filters matching plenty.
  //
  // Compared BY VALUE, not with a generation counter: the staleness lives inside the closure's
  // captured filterBody, so a counter read at call time would look current and wave it through.
  // Every filter change fires its own fetch, so dropping a response can never strand the list.
  const pageSize = likeAuthor.trim() ? LIKE_PILE_CAP : search.trim() ? SEARCH_PAGE_SIZE : PAGE_SIZE;
  const listBody = useCallback(
    () => JSON.stringify({ ...filterBody(), limit: pageSize, offset: page * pageSize }),
    [filterBody, page, pageSize],
  );
  const liveListBody = useRef("");
  useEffect(() => { liveListBody.current = listBody(); }, [listBody]);
  // Dropping a stale response is only HALF the job. The fetch that should have replaced it was
  // issued FIRST, so the stale one bumped seqRef past it and its response was already dropped by
  // the sequence guard — leaving nothing to land and a view still showing counts from a filter
  // set the curator has left. (Observed on prod: header "5 unassigned" over an empty list, the
  // 5 left from a spent like group.) So a drop must also re-run. Through a ref, because the
  // closure that produced the stale body is by definition the wrong one to retry with.
  // ponytail: converges because the retry builds from the CURRENT body; a filter change during
  // the retry fires its own fetch, which supersedes it.
  const refetchLatest = useRef<(silent?: boolean) => void>();

  const fetchData = useCallback((silent = false) => {
    const myId = ++seqRef.current;
    const body = listBody();
    if (!silent) setLoading(true);
    fetch("/api/db/authorships", {
      credentials: "same-origin", method: "POST", headers: apiHeaders, body,
    })
      // A 500 (e.g. the RDS pool out of connections) still has a JSON-ish body; reading it as a
      // list showed "No authorships match these filters" for a list that never loaded.
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => {
        if (myId !== seqRef.current) return; // superseded by a newer request — drop this response
        if (body !== liveListBody.current) {         // filters moved on while this was in flight
          refetchLatest.current?.(true);              // ...and re-run, or nothing ever lands
          return;
        }
        setListError(false);
        // never show a row whose removal is still in flight (race protection, same as topUp)
        // uniqueById: rows are keyed by id, so a repeated id (the list query once fanned out on
        // duplicate `person` rows) gives React duplicate keys and leaves orphaned cards behind.
        setRows(uniqueById<AuthorshipRow>(d.rows || []).filter((row) => !pendingRemoved.current.has(row.id)));
        setCount(d.count || 0);
      })
      .catch((e) => {
        // warn, not error: the failure is handled on the page, and Next's dev overlay would
        // otherwise cover the very Retry button that handles it.
        console.warn("[authorships] list request failed:", String(e?.message || e));
        if (myId !== seqRef.current) return;
        // A silent refetch (after an action) keeps the rows on screen; it only says so.
        if (silent) showError("Couldn't refresh the list. What you see may be out of date.");
        else { setListError(true); setRows([]); setCount(0); }
      })
      .finally(() => { if (!silent) setLoading(false); });
  }, [listBody]);
  useEffect(() => { refetchLatest.current = fetchData; }, [fetchData]);

  // Rolling queue: silently refill the visible set back up to PAGE_SIZE after a curator action —
  // NO loading flash (unlike fetchData) and, critically, ADDITIVE rather than a wholesale swap.
  // The rows already on screen stay exactly where they are (no reflow of what the curator is
  // reading at the top); only genuinely-new rows are appended into the freed slots at the bottom,
  // out of the curator's focus area — so the late-arriving refill (gated on the slow gold-standard
  // write) is invisible. Filtering against pendingRemoved stops a refetch from resurrecting a row
  // a sibling action just removed but whose write hasn't committed yet (rapid-accept race). Steps
  // back a page only when this offset is genuinely empty, so you're never stranded on a dead tail.
  const topUp = useCallback(() => {
    const myId = ++seqRef.current;
    const body = listBody();
    fetch("/api/db/authorships", {
      credentials: "same-origin", method: "POST", headers: apiHeaders, body,
    })
      // An error body is not an empty page: without this check a failed refill zeroed the count
      // and stepped back a page. Failing quietly leaves the rows on screen as they are.
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => {
        if (myId !== seqRef.current) return; // a newer fetch/topUp started — don't merge stale rows
        if (body !== liveListBody.current) {         // filters moved on — this refill is for a dead view
          refetchLatest.current?.(true);              // ...and re-run, or nothing ever lands
          return;
        }
        const fetched: AuthorshipRow[] = uniqueById<AuthorshipRow>(d.rows || []).filter(
          (row) => !pendingRemoved.current.has(row.id),
        );
        setCount(d.count || 0);
        if (fetched.length === 0 && page > 0) { setPage((p) => Math.max(0, p - 1)); return; }
        setRows((current) => {
          const visibleIds = new Set(current.map((r) => r.id));
          const additions = fetched.filter((r) => !visibleIds.has(r.id));
          return [...current, ...additions].slice(0, pageSize);
        });
      })
      .catch((e) => console.warn("[authorships] refill failed:", String(e?.message || e)));
  }, [listBody, page, pageSize]);

  // DERIVED from the filter object, never hand-listed — the same rule filterBody follows, and
  // for the same reason: a summary dependency array typed out by hand is exactly how a filter
  // silently stops reaching the counts. buildSummaryBody drops only the keys SUMMARY_BLIND_BODY_KEYS
  // names, so a filter added later is carried here automatically unless it is declared blind.
  //
  // Keyed on the SERIALISED body rather than on `filters` so the two properties that matter both
  // hold: a filter the summary is blind to (source, person types, the two affiliation lists…)
  // produces an identical string, leaving fetchSummary's identity — and so the effect at
  // `useEffect(() => { fetchSummary(); }, [fetchSummary])` — untouched, costing no refetch; and
  // any filter it is NOT blind to changes the string and always refetches.
  const baseSummaryBody = useMemo(() => JSON.stringify(buildSummaryBody(filters)), [filters]);

  // ---- the Article-affiliation facet is fetched ON DEMAND ------------------------------
  // Its 13 byline_ SUMs are 13 leading-wildcard LIKEs over author_affiliation and measured
  // 563 ms of the endpoint's 896 ms on production (2026-09-04, "Last 2 years" open queue) —
  // paid on EVERY load by #983, for a list only visible while the Affiliation popover is open.
  // So `includeAuthorInstitutions: true` rides the summary body, and only while that popover
  // wants it. NOT a member of AuthorshipFilters and NOT a key of buildFilterBody: it is a
  // request option, not something the curator filtered on, so it belongs to neither the chip
  // row, filterBody()'s deps, nor the ephemeral-clear deps (opening a popover must not drop a
  // selection). It is appended HERE, downstream of buildSummaryBody, for that reason.
  //
  // The latch is a filter-body key rather than the raw `!!affilAnchor`, which buys two things a
  // bare boolean does not:
  //   * CLOSING the popover does not refetch. affilFacetKey still equals the current body, so
  //     the posted body is unchanged and the effect below never re-fires.
  //   * Changing a filter with the popover CLOSED drops the flag again (the key no longer
  //     matches), so the queue goes straight back to the cheap body instead of paying the
  //     LIKEs for the rest of the session.
  const [affilFacetKey, setAffilFacetKey] = useState<string | null>(null);
  useEffect(() => {
    if (chipMenu === "ainst") setAffilFacetKey(baseSummaryBody);
  }, [chipMenu, baseSummaryBody]);
  // Hide counts (4b) need absentCwidSet(), a DynamoDB sweep when its cache is cold, so they ride
  // the same latch pattern, armed by opening the Hide chip.
  const [hideCountsKey, setHideCountsKey] = useState<string | null>(null);
  useEffect(() => {
    if (chipMenu === "hide") setHideCountsKey(baseSummaryBody);
  }, [chipMenu, baseSummaryBody]);
  const summaryBody = useMemo(
    () => JSON.stringify({
      ...buildSummaryBody(filters),
      ...(affilFacetKey === baseSummaryBody ? { includeAuthorInstitutions: true } : {}),
      ...(hideCountsKey === baseSummaryBody ? { includeHideCounts: true } : {}),
    }),
    [filters, affilFacetKey, hideCountsKey, baseSummaryBody],
  );

  // `summaryFor` records the exact body that produced `summary`, so the popover can tell
  // "these counts describe what you are looking at" from "a response for some other state is
  // still in flight" — see authorFacetsReady. seqRef is not optional now that two summary
  // requests have very different latencies (a byline-facet call is ~900 ms, a plain one
  // ~400 ms): without it, opening the popover and immediately changing a filter lets the older,
  // slower response land last and repaint stale counts as fresh ones.
  // liveSummaryBody is fetchSummary's half of the staleness guard documented on listBody above:
  // doAction's .then() calls this through a closure holding the summaryBody that was current when
  // the row was clicked, and this is the call that paints the header's "N unassigned authorships"
  // — the 0 the curator actually reads.
  const liveSummaryBody = useRef("");
  useEffect(() => { liveSummaryBody.current = summaryBody; }, [summaryBody]);
  const refetchSummaryLatest = useRef<() => void>();

  const fetchSummary = useCallback(() => {
    const myId = ++summarySeqRef.current;
    const body = summaryBody;
    fetch("/api/db/authorships/summary", {
      credentials: "same-origin", method: "POST", headers: apiHeaders, body,
    })
      .then((r) => r.json())
      .then((d) => {
        if (myId !== summarySeqRef.current) return;   // a newer summary fetch started
        if (body !== liveSummaryBody.current) {       // filters moved on while this was in flight
          refetchSummaryLatest.current?.();            // ...and re-run, or the header stays stale
          return;
        }
        setSummary(d);
        setSummaryFor(body);
      })
      .catch(() => {
        if (myId !== summarySeqRef.current) return;
        if (body !== liveSummaryBody.current) {       // ...and never blank a live summary either
          refetchSummaryLatest.current?.();
          return;
        }
        setSummary(null);
        setSummaryFor("");
      });
  }, [summaryBody]);
  useEffect(() => { refetchSummaryLatest.current = fetchSummary; }, [fetchSummary]);

  // "Recent activity" — fixed-size global feed, no filters, so unlike fetchSummary this never
  // needs to re-key off the queue's own filter state.
  const fetchRecentActivity = useCallback(() => {
    fetch("/api/db/authorships/recent-activity", {
      credentials: "same-origin", method: "POST", headers: apiHeaders,
      body: JSON.stringify({}),
    })
      .then((r) => r.json())
      .then((d) => setRecentActivity(d.rows || []))
      .catch(() => setRecentActivity([]));
  }, []);

  // ---- the canned report's own request -----------------------------------
  // A SPREAD OF A COPY of the posted filter body plus the one extra key. buildFilterBody's own
  // return value is never mutated and never gains a key: its exact bytes, key order included,
  // are the contract scripts/check-authorships-filter-body.mjs holds it to.
  //
  // The whole body goes over even though the reports endpoint honours only four of its keys —
  // sending buildFilterBody's output verbatim is the contract, and a hand-pruned second body
  // would be one more place a filter could be forgotten. The filters the server drops are the
  // ones whose controls are hidden while a report is up, so nothing on screen claims otherwise.
  const reportBody = useMemo(
    () => (reportView ? JSON.stringify({ ...buildFilterBody(filters), report: reportView }) : ""),
    [filters, reportView],
  );
  useEffect(() => {
    if (!reportView) { setReportData(null); setReportError(""); setReportLoading(false); return; }
    if (!datesReady) return;                       // same hold the first list fetch takes
    const myId = ++reportSeqRef.current;
    setReportLoading(true);
    fetch("/api/db/authorships/reports", {
      credentials: "same-origin", method: "POST", headers: apiHeaders, body: reportBody,
    })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: ReportResponse) => {
        if (myId !== reportSeqRef.current) return;
        setReportData(d);
        setReportError("");
      })
      .catch((e) => {
        if (myId !== reportSeqRef.current) return;
        // Inline in the panel, not the error Snackbar: a failed report load is a persistent
        // state of the thing the curator is looking at, not a transient notice that should
        // time out from under them.
        setReportData(null);
        setReportError(String(e?.message || e));
      })
      .finally(() => { if (myId === reportSeqRef.current) setReportLoading(false); });
  }, [reportBody, reportView, datesReady]);

  // Entering, switching and LEAVING a report, in one writer.
  //
  // It writes exactly ONE filter, the date window, and puts it back on the way out. That is a
  // deliberate exception to holding reportView outside the filter object, and it exists because
  // the queue's default window made the reports look empty: measured on prod 2026-09-06, the
  // default "Last 2 years" cut low-scoring accepts from 1,065 rows to 106 and high-scoring
  // rejects from 430 to 43 — before the WCM institution filter took them to 66 and 22. A curator
  // reading "(66)" reasonably concludes that is the whole report.
  //
  // The window is also the one filter whose MEANING changes between the two views: in the queue
  // it is entrez_date, when ReCiter retrieved the article ("recent work to review"), and in a
  // report it is the publication date. A curation mistake made last month on a 2015 paper is
  // exactly what these reports exist to catch, and a publication-date window hides it. So a
  // report opens on the whole corpus and the curator narrows from there.
  //
  // Restoring on the way out keeps the original guarantee intact — the feed comes back with its
  // own window, chip row, Filters badge and queue position untouched — and the Date control
  // visibly reads "All time" while a report is open, so the bar never disagrees with the list.
  // The identity-affiliation default is widened for the same reason and with one extra argument
  // for it: `selectedInstitutions: ["wcm"]` renders NO chip (filterChips treats the one-element
  // WCM list as the default and stays silent), so it was the only active filter with no on-screen
  // trace at all — the property that made the original "(66)" so hard to account for. Cleared, the
  // chip row shows "Identity affil: any" and the widening is visible, exactly as the Date control
  // reading "All time" makes the other one visible.
  const reportFilterStash = useRef<
    { preset: string; from: string; to: string; institutions: string[] } | null>(null);
  // #1011's twin of the above, for "Show N others like this": that button widens the list to
  // the count's scope (LIKE_WIDEN_PATCH), and this holds everything it cleared so both exits —
  // the "Like: …" chip and the auto-exit on an emptied view — restore it. Whole-object snapshot
  // rather than a key list: LIKE_WIDEN_PATCH can grow a key and this needs no edit to match.
  const likeFilterStash = useRef<
    { filters: AuthorshipFilters; preset: string; searchInput: string; page: number } | null>(null);
  // How many rows a like drill promised (the button's like_count, plus the row it was opened from
  // when that row is itself open), for the banner's "Showing N of M". Every row the curator
  // resolves inside the drill leaves the pile too, so doActionAsync takes one off it; otherwise
  // the banner would blame the current filters for rows that were just accepted or rejected.
  const [likeExpected, setLikeExpected] = useState<number | null>(null);
  // true for a visit that arrived via /authorships?cwid=<uid> (see the mount effect): that view
  // is one person's, not the curator's own, so it never overwrites their saved view.
  const personLink = useRef(false);
  const selectReport = useCallback((next: ReportView) => {
    if (!reportView && next) {
      reportFilterStash.current = {
        preset: datePreset, from: dateFrom, to: dateTo, institutions: selectedInstitutions.slice(),
      };
      setDatePreset("any");
      patchFilters({ dateFrom: "", dateTo: "", selectedInstitutions: [] });
    } else if (reportView && !next && reportFilterStash.current) {
      const stashed = reportFilterStash.current;
      setDatePreset(stashed.preset);
      patchFilters({
        dateFrom: stashed.from, dateTo: stashed.to, selectedInstitutions: stashed.institutions,
      });
      reportFilterStash.current = null;
    }
    setReportView(next);
    setReportAnchor(null);
  }, [reportView, datePreset, dateFrom, dateTo, selectedInstitutions, patchFilters]);
  // A cwid held open across a different result set means nothing, so groups close whenever the
  // report or the filters behind it change. Keyed on the posted body, like every other
  // report-scoped derivation here.
  useEffect(() => { setExpandedPeople(new Set()); }, [reportBody]);
  const toggleReportPerson = useCallback((cwid: string) => {
    setExpandedPeople((s) => {
      const next = new Set(s);
      if (next.has(cwid)) next.delete(cwid); else next.add(cwid);
      return next;
    });
  }, []);

  // §2.6: fill the identity hover card's "NAMES ON ACCEPTED PAPERS" block for one cwid. Called
  // from the card once the pointer has settled on a name, never on render — a page is 20 rows
  // and most of them are never hovered, so warming the whole page up front would trade one
  // cheap on-demand request for twenty speculative ones.
  //
  // The endpoint answers per cwid (`names`/`accepted`/`more` keyed by cwid, and it always
  // returns an entry for a well-formed cwid it was asked about), so a missing key means the
  // request is still in flight — the card shows a loading line, never "No accepted papers yet".
  // On failure the cwid is dropped from the asked set so the next hover retries; leaving it in
  // would strand that card on "Loading…" for the rest of the session.
  const requestPriorNames = useCallback((cwid?: string | null) => {
    if (!cwid || priorNamesAsked.current.has(cwid)) return;
    priorNamesAsked.current.add(cwid);
    fetch("/api/db/authorships/prior-names", {
      credentials: "same-origin", method: "POST", headers: apiHeaders,
      body: JSON.stringify({ cwid }),
    })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => setPriorNames((p) => ({
        ...p,
        [cwid]: {
          names: d?.names?.[cwid] || [], accepted: d?.accepted?.[cwid] ?? 0, more: d?.more?.[cwid],
          papers: d?.papers?.[cwid] || [], identity: d?.identity?.[cwid],
          topics: d?.topics?.[cwid] || [],
          counts: d?.counts?.[cwid], journals: d?.journals?.[cwid] || [], namesakes: d?.namesakes?.[cwid] || [],
          coauthors: d?.coauthors?.[cwid] || [],
        },
      })))
      .catch(() => { priorNamesAsked.current.delete(cwid); });
  }, []);

  // Undo a resolved row straight from the "Recent activity" panel. Deliberately NOT
  // doActionAsync/doAction: those optimistically mutate the CURRENT PAGE's rows/count
  // (filtering the row out, decrementing count) — wrong here, since an activity entry
  // usually isn't part of the current page's filtered/paginated result set at all, and
  // reusing them would silently corrupt an unrelated row's count. This posts directly and
  // just re-pulls everything that could have changed.
  const undoRecentActivity = useCallback((entry: ActivityEntry) => {
    fetch("/api/db/authorships/action", {
      credentials: "same-origin", method: "POST", headers: apiHeaders,
      body: JSON.stringify({ id: entry.id, action: "reopen" }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        // reopened row drops out of the resolved-only feed and may now belong on the
        // currently-viewed page/statusView; summary counts change too. Silent: this fires
        // from the Recent-activity side panel, not a filter/page change — the main queue
        // underneath shouldn't jump to the top over an action taken in a popup.
        fetchRecentActivity();
        fetchData(true);
        fetchSummary();
      })
      .catch((e) => showError(`Couldn't undo ${entry.wcm_author || entry.title || `row ${entry.id}`}. ${plainReason(e)}`));
  }, [fetchRecentActivity, fetchData, fetchSummary]);

  // live-filter: debounce the search box so the queue narrows as you type (no Enter needed)
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput, setSearch]);   // setSearch is a stable useCallback; listed only to satisfy the lint rule

  // A filter/sort/status change must always show page 0. If we're already on a later page we
  // synchronously snap back to 0 and skip the about-to-fire stale-offset fetch, so ONLY the
  // offset-0 fetch runs (not both a stale-offset and an offset-0 request). pendingPageReset marks
  // the one fetchData call that would otherwise dispatch at the stale offset. Keyed on filterBody
  // (memoized on the same filter/sort/status values fetchData uses) so this reset can never drift
  // out of lockstep with the fetch it guards.
  const pendingPageReset = useRef(false);
  // Normally 0 — a filter change shows the first page. clearLikeAuthor sets it to the page the
  // curator left, for exactly one filterBody change; it is consumed unconditionally so a stale
  // target can never leak into an unrelated filter change later.
  const likeExitPage = useRef<number | null>(null);
  useEffect(() => {
    const target = likeExitPage.current ?? 0;
    likeExitPage.current = null;
    if (page !== target) { pendingPageReset.current = true; setPage(target); }
  }, [filterBody]);

  useEffect(() => {
    if (!datesReady) return;                                                    // hold the first fetch for the default window
    if (pendingPageReset.current) { pendingPageReset.current = false; return; } // offset-0 fetch follows
    fetchData();
  }, [fetchData, datesReady]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useEffect(() => { fetchRecentActivity(); }, [fetchRecentActivity]);
  // clear transient per-page UI state on deliberate navigation only (filter/sort/status/page) —
  // NOT on every `rows` change, so a silent rolling-queue refill (topUp) after a single action
  // doesn't collapse the card the curator is mid-read on or wipe an in-progress bulk selection.
  // Stale ids left in selected/picked when a row drops are harmless (they match no visible row).
  // Same derivation as filterBody's deps — the whole filter object, plus `page` (which is NOT a
  // filter: it is appended as `offset` at the fetch site, but paging still has to drop a
  // selection made on the page you left). Note what is deliberately absent: this effect clears
  // only ephemeral per-page state, it never RESETS a filter. Sort, dates, class, types and
  // institutions all survive a change to any other control.
  useEffect(() => { setSelected(new Set()); setExpanded(null); setPicked({}); setAllMatching(null); },
    [filters, page]);
  // pub-type facet is scopus-only — drop any selection when leaving the Scopus segment
  // (setSelectedPubTypes is stable, and patchFilters no-ops when the list is already empty, so
  // this cannot fire a second refetch of its own.)
  useEffect(() => { if (source !== "scopus") setSelectedPubTypes([]); }, [source, setSelectedPubTypes]);

  // perform a curator action: optimistically drop the row, POST, then offer Undo (or revert on failure).
  // `extra` carries the assign cwid; the returned promise lets bulk loops await settlement.
  const doActionAsync = useCallback((row: AuthorshipRow, action: string, extra?: Record<string, any>): Promise<boolean> => {
    // #938 backstop: a no-suggestion row (top_cwid null) has nothing for accept/reject to act
    // on and the server 409s (authorships.controller.ts accept/reject cases). The card, the
    // checkboxes, and the bulk-eligibility filters above all already keep these out of reach —
    // this is the one place that also catches the Y/N keyboard shortcuts, which bypass all of
    // that UI gating by calling straight through to here. Rejecting before the optimistic
    // remove below means the row never even flashes out of the list.
    // `local: true` marks this as a precondition failure that never touched the network — no
    // HTTP status at all, so it can't be mistaken for the server's real 409 (duplicate) or 422
    // (no-identity/off-candidate) responses in the catch below or in doBulkAccept's tally.
    if ((action === "accept" || action === "reject") && !row.top_cwid) {
      return Promise.reject(Object.assign(
        new Error("No proposed identity on this row — use “Someone else” to assign it."),
        { local: true },
      ));
    }
    pendingRemoved.current.add(row.id);
    // Keep the keyboard triage queue moving: if the row being removed is the focused one, advance
    // focus to whatever now sits at the same index (the next row), falling back to the new last row,
    // then the first remaining — or clear when nothing is left. Computed from the pre-removal index
    // off the live rows mirror. Without this the next Y/N/S would resolve the now-gone focusedId to
    // undefined and be silently swallowed.
    setFocusedId((cur) => {
      if (cur !== row.id) return cur;
      const curRows = rowsRef.current;
      const idx = curRows.findIndex((x) => x.id === row.id);
      const remaining = curRows.filter((x) => x.id !== row.id);
      return (remaining[idx] ?? remaining[remaining.length - 1] ?? remaining[0])?.id ?? null;
    });
    setRows((rs) => rs.filter((x) => x.id !== row.id));
    setCount((c) => Math.max(0, c - 1));
    setLikeExpected((n) => (n == null ? n : Math.max(0, n - 1)));
    return fetch("/api/db/authorships/action", {
      credentials: "same-origin", method: "POST", headers: apiHeaders,
      body: JSON.stringify({ id: row.id, action, ...extra }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const text = await r.text();
          // 409 dup-conflict and 409 MULTI_CANDIDATE come back as JSON ({ message, matches? });
          // everything else is plain text. Try JSON first, fall back to the raw text as the
          // message.
          let message = text || `HTTP ${r.status}`;
          let matches: DupMatch[] = [];
          // 409 dup-conflict/MULTI_CANDIDATE and the #925 422s all come back as JSON; every
          // other status is plain text.
          let code = "";
          if (r.status === 409 || r.status === 422) {
            try {
              const parsed = JSON.parse(text);
              message = parsed?.message || message;
              matches = Array.isArray(parsed?.matches) ? parsed.matches : [];
              code = String(parsed?.code || "");
            } catch { /* not JSON — keep the raw text as the message */ }
          }
          const err: any = new Error(message);
          err.status = r.status;
          err.matches = matches;
          err.code = code;
          throw err;
        }
        return true;
      })
      // settled (DB write committed on success, or failed): the id no longer needs guarding.
      // Runs before the caller's .then(topUp), so this row is clear while siblings stay guarded.
      .finally(() => { pendingRemoved.current.delete(row.id); });
  }, []);

  // single-row action with its own optimistic remove + Undo (PR-1 behaviour, extended for assign)
  const doAction = useCallback((row: AuthorshipRow, action: string, extra?: Record<string, any>) => {
    setMenu(null);
    setActingId(row.id);
    doActionAsync(row, action, extra)
      .then(() => {
        // reopen has nothing meaningful to undo (it's already the undo of a resolution);
        // verdict ("Different papers") sets matched_pmid_verdict, not a status a Snackbar
        // undo could sensibly reverse either — suppress the toast for both.
        if (action !== "reopen" && action !== "verdict") {
          // The duplicates queue's "Keep PubMed record" is a dismiss; its toast says what it kept.
          const label = action === "dismiss" && extra?.reason === "dup_of_matched_pmid"
            ? `Kept PubMed record: ${row.wcm_author || stripHtml(row.title || "")}`
            : actionToast(action, [row], targetNameOf(row, action, extra?.cwid));
          setUndo({ rows: [row], label });
        } else if (action === "verdict") {
          toast(`Marked not duplicates: ${row.wcm_author || stripHtml(row.title || "")}`, { autoClose: 5000 });
        }
        topUp();      // refill so the next pending authorship slides into the freed slot
        fetchSummary();
        fetchRecentActivity();
      })
      .catch((e) => {
        // external (scopus/openalex) Accept/Assign duplicate (409 WARNING) → offer a Force add instead of a dead error.
        // A same-work accept is excluded: it never calls addExternalArticle, so its only 409 is the
        // already-rejected guard, and "Force add anyway" would answer it by creating the very
        // duplicate ExternalArticle the curator just said not to create. That 409 belongs in the
        // plain error toast, where its message ("already rejected this article") is the right advice.
        const externalDup = e?.status === 409 && isExternalSource(row)
          && (action === "accept" || action === "assign") && !extra?.samePmid;
        // Both 422s are the same shape — "allowed, but say you meant it" — and each names the
        // confirmation flag it wants back. The consequences are opposite, so the prompts they
        // raise differ (see ConflictEntry.kind and the banner below); the plumbing doesn't.
        // MULTI_CANDIDATE checked ahead of externalDup: both are plain 409s, and an external row can
        // hit the multi-candidate gate too (it's checked before the isScopus branch server-side).
        const kind: ConflictEntry["kind"] | null =
          e?.status === 422 && e?.code === "NO_RECITER_IDENTITY" ? "no_identity"
            : e?.status === 422 && e?.code === "OFF_CANDIDATE" ? "off_candidate"
              : e?.status === 409 && e?.code === "MULTI_CANDIDATE" ? "multi_candidate"
                : externalDup ? "dup" : null;
        if (kind) {
          const entry: ConflictEntry = {
            id: row.id, action, kind,
            extra: kind === "no_identity" ? { ...extra, confirmNoIdentity: "true" }
              : kind === "off_candidate" ? { ...extra, confirmOffCandidate: "true" }
                : kind === "multi_candidate" ? { ...extra }
                  : { ...extra, force: "true" },
            message: String(e?.message || e),
            matches: Array.isArray(e?.matches) ? e.matches : [],
            wcm_author: row.wcm_author, top_name: row.top_name, ts: Date.now(),
          };
          setConflicts((c) => ({ ...c, [row.id]: entry }));
          setConflictLog((log) => [entry, ...log].slice(0, 20));
        }
        // e.local (the #938 backstop above) rejects before the optimistic remove ever runs, so
        // unlike every other rejection here the row never left the list — say so accurately.
        else if (e?.local) showError(actionErrorToast(action, row, e, { rowRestored: false }));
        else showError(actionErrorToast(action, row, e));
        // silent: this is the dupe/no-identity/off-candidate/error recovery path — put the row
        // back in place (React reconciles by key) without the loading-gate flash that used to
        // unmount the whole card list and throw the reader's scroll position to the top.
        fetchData(true);
      })
      .finally(() => setActingId(null));
  }, [doActionAsync, fetchData, fetchSummary, fetchRecentActivity, topUp]);

  // With a select-all-matching in force the selection includes rows this page never
  // loaded, so an on-page filter would silently shrink the batch to 20.
  const selectedRows = allMatching ?? rows.filter((r) => selected.has(r.id));
  // T4: `selected` can now also hold multi-candidate rows (bulk-assign only — see
  // toggleSelect/isBulkSelectable). Every accept-type consumer of the selection must read
  // THIS, never selectedRows directly, so a newly-selectable multi row can never reach
  // doBulkAccept. selectAllMatching is unaffected — authorshipSelectable already returns only
  // single_candidate rows server-side, so allMatching never contains one in the first place.
  const selectedAcceptRows = selectedRows.filter(isAcceptEligible);

  // F5: bulk orchestration — accept a batch of rows, collect into one Undo batch.
  // Runs BULK_CHUNK rows at a time, chunks sequential: a select-all-matching batch can be
  // thousands of rows, and each accept is a write into ReCiter. Per-row behaviour inside a
  // chunk is byte-for-byte what a single page's Accept does today.
  const doBulkAccept = useCallback((batch: AuthorshipRow[]) => {
    if (batch.length === 0) return;
    setMenu(null);
    setBulkProgress(batch.length > BULK_CHUNK ? { done: 0, total: batch.length } : null);
    const runChunks = async () => {
      const results: PromiseSettledResult<boolean>[] = [];
      for (let i = 0; i < batch.length; i += BULK_CHUNK) {
        const chunk = batch.slice(i, i + BULK_CHUNK);
        results.push(...await Promise.allSettled(chunk.map((row) => doActionAsync(row, "accept"))));
        if (batch.length > BULK_CHUNK) setBulkProgress({ done: results.length, total: batch.length });
      }
      return results;
    };
    runChunks()
      .then((results) => {
        const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
        const ok = batch.filter((_, i) => results[i].status === "fulfilled");
        if (ok.length > 0) setUndo({ rows: ok, label: actionToast("accept", ok, ok.length === 1 ? targetNameOf(ok[0], "accept") : null) });
        // success: silently refill the queue to the next batch ("accept 20 → next 20").
        // failure: refresh to restore the optimistically-removed rows (silently -- see below),
        // with the failures broken down by cause so the same rows don't fail opaquely forever.
        if (failures.length) {
          const dups = failures.filter((f) => (f.reason as any)?.status === 409).length;
          const noId = failures.filter((f) => (f.reason as any)?.status === 422).length;
          const other = failures.length - dups - noId;
          const parts: string[] = [];
          if (dups) parts.push(`${dups} possible duplicate${dups > 1 ? "s" : ""} — moved to Possible duplicates`);
          if (noId) parts.push(`${noId} with no ReCiter identity`);
          if (other) parts.push(`${other} failed`);
          showError(`Skipped ${failures.length} of ${batch.length} accepts: ${parts.join("; ")}. Refreshing the list.`);
          // silent — a partial bulk-accept failure is still "acted on rows in place", not a
          // navigation event; the curator is mid-review of this same page.
          fetchData(true);
        }
        else topUp();
        fetchSummary();
        fetchRecentActivity();
      })
      .finally(() => setBulkProgress(null));
    setSelected(new Set());
    setAllMatching(null);
  }, [doActionAsync, fetchData, fetchSummary, fetchRecentActivity, topUp]);

  // T-950: bulk reject — same shape as doBulkAccept (chunking/allSettled/Undo/refresh), just
  // "reject" with no extra body in place of "accept". Unlike doBulkAssign there's no server
  // lookup/confirm-flags step first: reject never targets a typed cwid, every row acts on its
  // own already-proposed candidate(s) (case "reject" in authorships.controller.ts derives
  // single/multi/scopus behaviour from the row itself), so the confirm dialog above is the only
  // gate and doActionAsync(row, "reject") is called exactly as every per-row Reject/Reject all
  // call site already does (no cwid, no flags).
  const doBulkReject = useCallback((batch: AuthorshipRow[]) => {
    if (batch.length === 0) return;
    setRejectConfirmOpen(false);
    setMenu(null);
    setBulkProgress(batch.length > BULK_CHUNK ? { done: 0, total: batch.length } : null);
    const runChunks = async () => {
      const results: PromiseSettledResult<boolean>[] = [];
      for (let i = 0; i < batch.length; i += BULK_CHUNK) {
        const chunk = batch.slice(i, i + BULK_CHUNK);
        results.push(...await Promise.allSettled(chunk.map((row) => doActionAsync(row, "reject"))));
        if (batch.length > BULK_CHUNK) setBulkProgress({ done: results.length, total: batch.length });
      }
      return results;
    };
    runChunks()
      .then((results) => {
        const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
        const ok = batch.filter((_, i) => results[i].status === "fulfilled");
        if (ok.length > 0) setUndo({ rows: ok, label: actionToast("reject", ok) });
        if (failures.length) {
          const { noProposal, writeFailed, other } = bucketRejectFailures(
            failures.map((f) => (f.reason as any) || {}));
          const parts: string[] = [];
          if (noProposal) parts.push(`${noProposal} had nothing to reject`);
          if (writeFailed) parts.push(`${writeFailed} failed to write`);
          if (other) parts.push(`${other} failed`);
          showError(`Rejected ${ok.length} of ${batch.length} selected: ${parts.join("; ")}. Refreshing the list.`);
          // silent — same as doBulkAccept/doBulkAssign: still mid-review of this same page.
          fetchData(true);
        }
        else topUp();
        fetchSummary();
        fetchRecentActivity();
      })
      .finally(() => setBulkProgress(null));
    setSelected(new Set());
    setAllMatching(null);
  }, [doActionAsync, fetchData, fetchSummary, fetchRecentActivity, topUp]);

  // §2.5: bulk Snooze — new as a bulk action, built on the SAME per-row call the overflow
  // menu's "Snooze 90 days" already makes (doActionAsync(row, "snooze")), with doBulkAccept's
  // chunking/allSettled/Undo/refresh shape around it. No confirm gate in front of it, unlike
  // bulk reject: snooze writes no gold standard and no rejection — it sets status/snooze_until
  // on the row and nothing else — and the Undo snackbar reverses the whole batch, so a
  // mis-click costs one click back, not a curator decision recorded against a person.
  // Deliberately no failure-bucketing helper: the server's snooze case has no precondition to
  // fail (unlike accept's dup/no-identity gates), so anything rejected here is a plain error.
  // Bulk Dismiss (owner request 2026-09-15) is the same shape with the other status-only action
  // — dismiss writes status/resolved_at and nothing else, and reopen (Undo) reverses both.
  const doBulkStatus = useCallback((batch: AuthorshipRow[], action: "snooze" | "dismiss") => {
    if (batch.length === 0) return;
    const done = action === "snooze" ? "Snoozed" : "Dismissed";
    setMenu(null);
    setBulkProgress(batch.length > BULK_CHUNK ? { done: 0, total: batch.length } : null);
    const runChunks = async () => {
      const results: PromiseSettledResult<boolean>[] = [];
      for (let i = 0; i < batch.length; i += BULK_CHUNK) {
        const chunk = batch.slice(i, i + BULK_CHUNK);
        results.push(...await Promise.allSettled(chunk.map((row) => doActionAsync(row, action))));
        if (batch.length > BULK_CHUNK) setBulkProgress({ done: results.length, total: batch.length });
      }
      return results;
    };
    runChunks()
      .then((results) => {
        const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
        const ok = batch.filter((_, i) => results[i].status === "fulfilled");
        if (ok.length > 0) setUndo({ rows: ok, label: actionToast(action, ok) });
        if (failures.length) {
          showError(`${done} ${ok.length} of ${batch.length} selected; ${failures.length} failed. Refreshing the list.`);
          // silent — same as every other bulk path: still mid-review of this same page.
          fetchData(true);
        }
        else topUp();
        fetchSummary();
        fetchRecentActivity();
      })
      .finally(() => setBulkProgress(null));
    setSelected(new Set());
    setAllMatching(null);
  }, [doActionAsync, fetchData, fetchSummary, fetchRecentActivity, topUp]);
  const doBulkSnooze = useCallback((batch: AuthorshipRow[]) => doBulkStatus(batch, "snooze"), [doBulkStatus]);
  const doBulkDismiss = useCallback((batch: AuthorshipRow[]) => doBulkStatus(batch, "dismiss"), [doBulkStatus]);

  // PR 5: bulk Reopen on the Snoozed and Dismissed queues — the same per-row "reopen" the row's
  // own Reopen button sends, BULK_CHUNK at a time. Like a single reopen it offers no Undo (it is
  // itself the undo of a snooze or dismiss), so success is a plain toast.
  const doBulkReopen = useCallback((batch: AuthorshipRow[]) => {
    if (batch.length === 0) return;
    setMenu(null);
    setBulkProgress(batch.length > BULK_CHUNK ? { done: 0, total: batch.length } : null);
    const runChunks = async () => {
      const results: PromiseSettledResult<boolean>[] = [];
      for (let i = 0; i < batch.length; i += BULK_CHUNK) {
        const chunk = batch.slice(i, i + BULK_CHUNK);
        results.push(...await Promise.allSettled(chunk.map((row) => doActionAsync(row, "reopen"))));
        if (batch.length > BULK_CHUNK) setBulkProgress({ done: results.length, total: batch.length });
      }
      return results;
    };
    runChunks()
      .then((results) => {
        const failures = results.filter((r) => r.status === "rejected").length;
        const ok = batch.filter((_, i) => results[i].status === "fulfilled");
        if (ok.length > 0) toast(actionToast("reopen", ok), { autoClose: 5000 });
        if (failures) {
          showError(`Reopened ${ok.length} of ${batch.length} selected; ${failures} failed. Refreshing the list.`);
          fetchData(true);
        }
        else topUp();
        fetchSummary();
        fetchRecentActivity();
      })
      .finally(() => setBulkProgress(null));
    setSelected(new Set());
    setAllMatching(null);
  }, [doActionAsync, fetchData, fetchSummary, fetchRecentActivity, topUp]);

  // T4: union of everything the current selection proposes, for the "Assign selected (N) to…"
  // picker — "Name (cwid) — matches k of N selected", ranked k desc. Recomputed on every
  // render off selectedRows; bulk-assign is a same-page/handful-of-rows tool (unlike
  // select-all-matching's thousands), so this is cheap.
  const assignCandidateUnion = unionCandidates(selectedRows.map(rowCandidateLites));
  // 4c: each candidate's IO on every selected row that proposes them, for the picker's range
  // and band counts (the card's F2 bands, ioColor). unionCandidates keeps only the max.
  const assignScoresOf = (cwid: string) => selectedRows.flatMap((r) => {
    const c = rowCandidateLites(r).find((x) => x.cwid === cwid);
    return c?.score != null ? [c.score] : [];
  });

  const openAssignPicker = useCallback((anchor: HTMLElement) => {
    assignSeqRef.current += 1;
    setAssignOtherCwid("");
    setAssignErr("");
    setAssignConfirm(null);
    setAssignMenuAnchor(anchor);
  }, []);
  // The popover holds the list, the lookup and the confirm step (PR 5), so closing it drops all
  // three. A lookup already in flight still lands, but with the popover shut it shows nothing.
  const closeAssignPicker = useCallback(() => {
    assignSeqRef.current += 1;
    setAssignMenuAnchor(null);
    setAssignConfirm(null);
    setAssignErr("");
  }, []);

  // B-8: picking a candidate — from the union list or the typed "someone else" box — doesn't
  // submit anything yet, and no longer just computes a client-side split off possibly-stale
  // candidate_cwids_json. It asks the server ONE question first (POST
  // /api/db/authorships/lookup -> authorshipLookupCwid, controllers/db/authorships.controller.ts):
  // canonicalize the typed/picked cwid the same way case "assign" does (canonicalCwid over
  // reciterIdentitySet), and say whether ReCiter has an identity for it and what its name is.
  // The confirm dialog is built ONLY on what comes back — never on the raw string typed, and
  // never on a union label whose candidate_cwids_json name might already be stale — which is
  // the same "confirm against a server-looked-up name, not a typed string" trust boundary the
  // per-row OFF_CANDIDATE/NO_RECITER_IDENTITY 422 confirms already enforce for one row.
  const chooseAssignTarget = useCallback((rawCwid: string) => {
    const typed = rawCwid.trim();
    if (!typed) return;
    const seq = assignSeqRef.current;
    setAssignErr("");
    setAssignLookupCwid(typed);
    fetch("/api/db/authorships/lookup", {
      credentials: "same-origin", method: "POST", headers: apiHeaders,
      body: JSON.stringify({ cwid: typed }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (assignSeqRef.current !== seq) return;
        const cwid = String(d.cwid || typed);
        const { onCandidate, offCandidate } = partitionForAssign(selectedRows, rowCandidateLites, cwid);
        setAssignConfirm({ cwid, name: d.name ?? null, hasIdentity: !!d.hasIdentity, onCandidate, offCandidate });
      })
      .catch((e) => { if (assignSeqRef.current === seq) setAssignErr(`Couldn't look up ${typed}. ${plainReason(e)}`); })
      .finally(() => setAssignLookupCwid(null));
  }, [selectedRows]);

  // The popover's "Someone else" box takes a CWID or a full name (prototype: "CWID or full
  // name"). A CWID goes straight to the lookup above. A name is searched in the directory with
  // the same read-only `q` lookup the row's own strip uses; exactly one assignable person
  // continues with their cwid, anything else asks for a CWID.
  const assignOtherGo = useCallback(() => {
    const q = assignOtherCwid.trim();
    if (!q || assignLookupCwid) return;
    if (looksLikeCwid(q)) { chooseAssignTarget(q); return; }
    const seq = assignSeqRef.current;
    setAssignErr("");
    setAssignLookupCwid(q);
    fetch("/api/db/authorships/lookup", {
      credentials: "same-origin", method: "POST", headers: apiHeaders,
      body: JSON.stringify({ q }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        const hits: any[] = (Array.isArray(d?.matches) ? d.matches : []).filter((m: any) => !m.retiredCwid);
        setAssignLookupCwid(null);
        if (assignSeqRef.current !== seq) return;
        if (hits.length === 1) {
          const m = hits[0];
          chooseAssignTarget(m.wcmCwidHasIdentity && m.wcmCwid ? String(m.wcmCwid) : String(m.id));
        } else {
          setAssignErr(hits.length ? `${hits.length} people match “${q}”. Enter a CWID.` : `Nobody in the directory matches “${q}”.`);
        }
      })
      .catch((e) => { setAssignLookupCwid(null); if (assignSeqRef.current === seq) setAssignErr(`Couldn't search for ${q}. ${plainReason(e)}`); });
  }, [assignOtherCwid, assignLookupCwid, chooseAssignTarget]);

  // F5 for assign: mirrors doBulkAccept's chunking/allSettled shape, same doActionAsync call,
  // just "assign"+{cwid,...flags} in place of "accept". B-8: EVERY selected row now submits —
  // the old toSubmit/toSkip dead end (an off-candidate target left the whole batch stuck at "0
  // rows to submit", the sts2022 prod incident) is gone. assignConfirmFlags derives the one
  // confirm flag each row's submit needs from (a) whether the cwid is on THAT row's own
  // candidate list (assignConfirm.offCandidate membership) and (b) whether the lookup found a
  // ReCiter identity for it (assignConfirm.hasIdentity, one fact for the whole batch) — the
  // curator already confirmed against the name/no-identity notice the dialog showed, so these
  // flags are pre-set, not auto-confirmed blindly: a 422 bouncing back from a submitted row
  // would mean the derivation disagreed with the server, which bucketAssignFailures still
  // surfaces rather than silently swallowing.
  // PR 5: `onlySafe` is the confirm step's "Assign the N high-confidence only" — just the rows
  // that list this person as a candidate at High IO (assignPreview). "Assign all N" sends every
  // row, as before.
  const doBulkAssign = useCallback((onlySafe = false) => {
    const confirm = assignConfirm;
    if (!confirm) return;
    const { cwid, hasIdentity, onCandidate, offCandidate } = confirm;
    setAssignConfirm(null);
    setAssignMenuAnchor(null);
    setMenu(null);
    const offIds = new Set(offCandidate.map((r) => r.id));
    const everyRow = [...onCandidate, ...offCandidate];
    const batch = onlySafe ? assignPreview(everyRow, rowCandidateLites, cwid).safe : everyRow;
    if (batch.length === 0) { setSelected(new Set()); setAllMatching(null); return; }
    setBulkProgress(batch.length > BULK_CHUNK ? { done: 0, total: batch.length } : null);
    const runChunks = async () => {
      const results: PromiseSettledResult<boolean>[] = [];
      for (let i = 0; i < batch.length; i += BULK_CHUNK) {
        const chunk = batch.slice(i, i + BULK_CHUNK);
        results.push(...await Promise.allSettled(chunk.map((row) =>
          doActionAsync(row, "assign", { cwid, ...assignConfirmFlags(offIds.has(row.id), hasIdentity) }))));
        if (batch.length > BULK_CHUNK) setBulkProgress({ done: results.length, total: batch.length });
      }
      return results;
    };
    runChunks()
      .then((results) => {
        const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
        const ok = batch.filter((_, i) => results[i].status === "fulfilled");
        if (ok.length > 0) setUndo({ rows: ok, label: actionToast("assign", ok, assignConfirm?.name || cwid) });
        const parts: string[] = [];
        if (failures.length) {
          const { offCandidate: offC, noIdentity, conflict409, other } = bucketAssignFailures(
            failures.map((f) => (f.reason as any) || {}));
          if (offC) parts.push(`${offC} off-candidate`);
          if (noIdentity) parts.push(`${noIdentity} with no ReCiter identity`);
          if (conflict409) parts.push(`${conflict409} conflict${conflict409 > 1 ? "s" : ""}`);
          if (other) parts.push(`${other} failed`);
        }
        if (parts.length) showError(`Assigned ${ok.length} of ${batch.length} selected to ${cwid}: ${parts.join("; ")}.`);
        // success: silently refill the queue, same as doBulkAccept. failure: refresh so
        // the optimistically-removed-then-failed rows come back — silent, still mid-review.
        if (failures.length) fetchData(true);
        else topUp();
        fetchSummary();
        fetchRecentActivity();
      })
      .finally(() => setBulkProgress(null));
    setSelected(new Set());
    setAllMatching(null);
  }, [assignConfirm, doActionAsync, fetchData, fetchSummary, fetchRecentActivity, topUp]);

  // "Select all N matching": pull every bulk-selectable row for the current filters, not just
  // this page. The server recomputes eligibility and omits anything the card would refuse, so
  // this can only ever select rows an individual Accept would also have allowed.
  const selectAllMatching = useCallback(() => {
    setSelectingAll(true);
    fetch("/api/db/authorships/selectable", {
      credentials: "same-origin", method: "POST", headers: apiHeaders,
      body: JSON.stringify(filterBody()),
    })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => {
        const matched: AuthorshipRow[] = d.rows || [];
        setAllMatching(matched);
        setSelected(new Set(matched.map((r) => r.id)));
        if (d.capped) showError(`Selected the first ${d.cap.toLocaleString()} matching rows — narrow the filters to reach the rest.`);
      })
      .catch((e) => showError(`Couldn't select all matching rows. ${plainReason(e)}`))
      .finally(() => setSelectingAll(false));
  }, [filterBody]);

  // undo = reopen over the whole batch (F4: extends PR-1's single-row undo)
  const doUndo = useCallback(() => {
    if (!undo) return;
    const batch = undo.rows;
    setUndo(null);
    Promise.allSettled(batch.map((row) =>
      fetch("/api/db/authorships/action", {
        credentials: "same-origin", method: "POST", headers: apiHeaders,
        body: JSON.stringify({ id: row.id, action: "reopen" }),
      }).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); })
    )).then((results) => {
      if (results.some((r) => r.status === "rejected")) showError("Undo failed for one or more rows.");
      // silent — undo restores rows in place, same as the action-catch path above.
    }).finally(() => { fetchData(true); fetchSummary(); fetchRecentActivity(); });
  }, [undo, fetchData, fetchSummary, fetchRecentActivity]);

  // F12: clicking "+N more" narrows the view to the pmid. The sibling count is scoped
  // only to the status view (it deliberately ignores lane/classification/type/date), so to
  // actually surface all N siblings we must relax those list filters too — otherwise the
  // default single-candidate lane would hide multi-candidate siblings and "+2 more" could
  // narrow to fewer than 2 cards. Lane→all + classification→all matches the count; the
  // person-type/date filters are left intact (they aren't part of the sibling-count scope
  // either, but relaxing lane+classification is what makes the primary mismatch go away).
  const narrowToPmid = useCallback((pmid: number | string | null | undefined) => {
    if (pmid == null || pmid === "") return;
    // One patch, so lane/classification/search land in a single filter-object update (one
    // refetch, one selection clear) instead of three.
    patchFilters({ lane: "all", classification: "all", search: String(pmid) });
    setSearchInput(String(pmid));
  }, [patchFilters]);

  // Shared by the "Assign to someone else…" overflow item and the no-identity pill/button
  // (T3): expands the card and focuses the AssignOther typed-cwid input it renders. Card
  // expansion mounts <AssignOther> on the next render, so focus has to wait for that DOM to
  // exist — zero-delay setTimeout, a paint wait rather than a debounce.
  // The byline name is seeded into that input: the shortcut is "this author is someone the
  // producer didn't offer", and the name on the card is the search term nine times in ten.
  // Keyed by row so only the row that asked is seeded — plain card expansion stays blank
  // (no directory lookup fired for every card the curator opens).
  const [assignPrefill, setAssignPrefill] = useState<{ id: number; name: string } | null>(null);
  const focusAssignOther = useCallback((id: number, name?: string) => {
    setExpanded(id);
    setAssignPrefill(name ? { id, name } : null);
    setTimeout(() => document.getElementById(`otherCwid-${id}`)?.focus(), 0);
  }, []);

  // T5: "Show N others like this" — sets the STRUCTURED likeAuthor filter (variant-tolerant
  // normalized-key match server-side, see buildWhere's likeAuthor block), not the free-text
  // search box: T4's version pasted wcm_author into the text box, whose LIKE substring match
  // misses a middle-initial variant like "Bernard J. Park" starting from "Bernard Park" — the
  // driving case for this rework. The text box (`search`/`searchInput`) is left untouched, so
  // it keeps working as its own independent filter. Page reset to 0 is already handled by the
  // pendingPageReset effect above, which watches filterBody (likeAuthor is now part of it).
  //
  // It stashes the filters on entry so "← Back to previous filters" (and the auto-exit on an
  // emptied view) puts them straight back. Since Authorships PR 2 it no longer widens them
  // (#1011's LIKE_WIDEN_PATCH): the banner says "Showing N of M" when the filters hide part of
  // the pile, using `expected` (see likeExpected).
  const findOthersLikeThis = useCallback((wcmAuthor?: string, expected?: number | null) => {
    if (!wcmAuthor) return;
    setLikeExpected(expected ?? null);
    // Stash only on ENTRY. Clicking the button again from inside a like view (a card for a
    // different name) must not overwrite the snapshot with the already-widened state — that
    // would restore the widening instead of the curator's chips.
    if (!likeFilterStash.current) {
      likeFilterStash.current = { filters: { ...filters }, preset: datePreset, searchInput, page };
    }
    // Authorships PR 2 (the prototype's drill): the curator's other filters stay exactly as they
    // are and stay visible on the chip row; the drill adds only the name, plus the Open queue the
    // pile is counted over. It used to widen every other filter to its widest value
    // (LIKE_WIDEN_PATCH), which changed five chips the curator never touched. The banner under
    // the chip row names the pile and says how to get back.
    patchFilters({ likeAuthor: wcmAuthor, statusView: "open" });
  }, [patchFilters, filters, datePreset, searchInput, page]);

  // Leaving the like view restores whatever it widened away. Used by BOTH exits — dismissing
  // the "Like: …" chip and the auto-exit when the last row in the view is resolved — so neither
  // can strand a curator in a silently-widened queue.
  const clearLikeAuthor = useCallback(() => {
    const stashed = likeFilterStash.current;
    likeFilterStash.current = null;
    if (!stashed) { setLikeAuthor(""); return; }
    setDatePreset(stashed.preset);
    setSearchInput(stashed.searchInput);
    // sort is deliberately NOT restored. It is the one key the widen never touched (see
    // WIDEN_EXEMPT in check-authorships-filter-body.mjs), so a curator who re-sorted while
    // inside the like view chose that sort — restoring the snapshot's would be exactly the
    // "changing one control loses another" failure this file's stash pattern exists to avoid.
    const { sort: _keepCurrentSort, ...restored } = stashed.filters;
    // Land back on the page the curator was reading when they stepped into the like view. A
    // detour is not navigation, so the blanket "any filter change shows page 0" rule below does
    // not apply to this one exit — likeExitPage tells it where to go instead. Set BEFORE
    // patchFilters, because that call is what triggers the effect that consumes it.
    likeExitPage.current = stashed.page;
    patchFilters({ ...restored, likeAuthor: "" });
  }, [patchFilters, setLikeAuthor]);
  useEffect(() => { clearLikeRef.current = clearLikeAuthor; }, [clearLikeAuthor]);

  // T4: single-candidate rows keep the pre-existing accept-eligible gate (no-ReCiter-identity,
  // already-rejected, no proposed identity at all (#938) stay unselectable). Multi-candidate
  // rows are now ALSO selectable — open, non-scopus (see isMultiAssignEligible) — but only for
  // bulk-assign: isBulkSelectable never lets a multi row satisfy isAcceptEligible, which is
  // what every accept-type bulk consumer below (eligibleRows, "Accept selected") filters on.
  const toggleSelect = useCallback((row: AuthorshipRow) => {
    // PR 5: every row on Snoozed / Dismissed is selectable, for bulk Reopen only. Elsewhere
    // the open-queue gate below (pinned by check-authorships-no-suggestion.mjs) decides.
    if (!isParkedQueue(statusView)) {
      if (!isBulkSelectable(row, statusView)) return;
    }
    setSelected((s) => {
      const next = new Set(s);
      next.has(row.id) ? next.delete(row.id) : next.add(row.id);
      return next;
    });
  }, [statusView]);

  useEffect(() => { doActionRef.current = doAction; }, [doAction]);
  useEffect(() => { toggleSelectRef.current = toggleSelect; }, [toggleSelect]);
  useEffect(() => { doUndoRef.current = doUndo; }, [doUndo]);
  // The pending Undo rides the global toast host ("Undo · U"). Same 12s window the Snackbar had;
  // a newer action replaces it, doUndo clears it, and leaving the page takes it down with us.
  // The U shortcut is the host's, gated here exactly as this page's own shortcuts are: not
  // while one of its overlays is up, and not while a canned report replaces the card list.
  useEffect(() => {
    if (!undo) return;
    // `live` goes false in our cleanup: that dismiss must not clear the undo replacing this one,
    // and a dismissed toast stays registered until its exit animation ends, so neither U nor its
    // button may fire this undo after we have left the page or moved on to a newer one.
    let live = true;
    const id = showUndoToast(undo.label, () => { if (live) doUndoRef.current?.(); }, {
      autoClose: 12000,
      canUndo: () => live && !overlayOpenRef.current && !reportViewRef.current,
      onClose: () => { if (live) setUndo((u) => (u === undo ? null : u)); },
    });
    return () => { live = false; toast.dismiss(id); };
  }, [undo]);

  // Item 8: date preset → sets dateFrom/dateTo client-side. entrez_date is DATEONLY;
  // backend buildWhere already handles ranges, so no backend change. "Custom..." reveals
  // the explicit From/To inputs and leaves whatever is there; "Any time" clears both.
  const applyDatePreset = useCallback((preset: string) => {
    setDatePreset(preset);
    if (preset === "custom") return; // keep current From/To, just show the inputs
    if (preset === "any") { patchFilters({ dateFrom: "", dateTo: "" }); return; }
    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    const today = new Date();
    const from = new Date(today);
    if (preset === "30d") from.setDate(from.getDate() - 30);
    else if (preset === "90d") from.setDate(from.getDate() - 90);
    // Shift the month/year off day 1 then re-clamp the day, so Aug 31 − 6mo lands on the last day of
    // February, not rolls forward into March (setMonth/setFullYear overflow on short target months).
    else if (preset === "6m") { const day = from.getDate(); from.setDate(1); from.setMonth(from.getMonth() - 6); from.setDate(Math.min(day, daysInMonth(from.getFullYear(), from.getMonth()))); }
    else if (preset === "12m") { const day = from.getDate(); from.setDate(1); from.setFullYear(from.getFullYear() - 1); from.setDate(Math.min(day, daysInMonth(from.getFullYear(), from.getMonth()))); }
    else if (preset === "24m") { const day = from.getDate(); from.setDate(1); from.setFullYear(from.getFullYear() - 2); from.setDate(Math.min(day, daysInMonth(from.getFullYear(), from.getMonth()))); }
    // §2.3's new "Last 5 years" — same clamp-the-day dance as the two above (Feb 29 back five
    // years is Feb 28, not Mar 1).
    else if (preset === "60m") { const day = from.getDate(); from.setDate(1); from.setFullYear(from.getFullYear() - 5); from.setDate(Math.min(day, daysInMonth(from.getFullYear(), from.getMonth()))); }
    patchFilters({ dateFrom: fmt(from), dateTo: fmt(today) });
  }, [patchFilters]);

  // "Reset all" (HANDOFF §2.4): FILTER_DEFAULTS for every filter except sort (RESET_EXEMPT),
  // plus the two pieces of presentation state that shadow a filter — the search box's own text
  // and the date preset, whose default window applyDatePreset recomputes. Both patches land in
  // one render, so this is a single refetch. Phase 3 wires it to the Filters popover's
  // "Reset all" and to the chip row's "Clear"; nothing else may reset a filter.
  const resetAll = useCallback(() => {
    // Reset ends a like drill too; its stash would otherwise come back on the next drill's exit.
    likeFilterStash.current = null;
    patchFilters(filterResetPatch());
    setSearchInput("");
    applyDatePreset(DEFAULT_DATE_PRESET);
  }, [patchFilters, applyDatePreset]);

  // Apply the default "recent" window (Last 2 years) on mount — client-only so the statically
  // prerendered initial render (empty dates) hydrates cleanly. datesReady then releases the first
  // list fetch, so curators land on the windowed view instead of flashing the full backlog.
  // A saved view (see SAVED_VIEW_KEY) replaces the default here, in the same render that releases
  // datesReady, so the first list fetch is for the restored view — never default-then-restored.
  //
  // /authorships?cwid=<uid> (Find People's Authorships link for a Cornell-only person) opens on
  // that person instead: the free-text search on their cwid, widened like a like
  // view so no default chip hides their rows, and the saved view left alone (personLink).
  useEffect(() => {
    const cwid = (new URLSearchParams(window.location.search).get("cwid") || "").trim();
    const saved = cwid ? null : loadSavedView();
    if (cwid) {
      personLink.current = true;
      patchFilters({ ...LIKE_WIDEN_PATCH, search: cwid });
      setSearchInput(cwid);
      applyDatePreset("any");
    } else if (saved) {
      patchFilters(saved.filters);
      setSearchInput(saved.filters.search || "");
      applyDatePreset(saved.datePreset);   // "custom" returns early and keeps the restored From/To
    } else {
      applyDatePreset(DEFAULT_DATE_PRESET);
    }
    setDatesReady(true);
  }, [applyDatePreset, patchFilters]);
  // Outside a like view only: its widened filters are not the curator's own (see SAVED_VIEW_KEY).
  useEffect(() => {
    if (!datesReady || likeAuthor || personLink.current) return;
    saveView({ filters, datePreset });
  }, [filters, datePreset, datesReady, likeAuthor]);

  // A bulk run is a loop in THIS tab: reloading or closing it mid-run silently abandons the rest
  // of the batch. Ask first.
  useEffect(() => {
    if (!bulkProgress) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [bulkProgress]);

  // F13: keyboard nav — J/K move, Y accept (single), N reject, S snooze, X select, Enter open
  // PubMed (U undo is the global toast host's, see the showUndoToast effect). Registered ONCE:
  // it reads the latest rows/focus/view/handlers from refs, so
  // an optimistic action or a rolling-queue refill never swaps the listener (and the post-action
  // focus-advance still sees current state through those same refs).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea") return;
      const cmd = keyCommand(e);
      if (!cmd) return;
      // "?" opens and closes the shortcut list itself, so it is the one key that works while that
      // list (an overlay) is up; every other overlay still blocks it.
      if (cmd === "legend") {
        if (reportViewRef.current) return;
        if (overlayOpenRef.current && !keysOpenRef.current) return;
        setKeysAnchor((a) => (a ? null : keysBtnRef.current));
        e.preventDefault();
        return;
      }
      // …and not while a popover, menu or confirm dialog is up. The tag test above is not enough:
      // MUI moves focus INTO the popover's paper (a div, not an input), so with the Filters or
      // Affiliation list open every keystroke still fell through to the row behind it — j/k moved
      // an invisible focus ring and y/n/s ACTED on a row the curator could not see. Every overlay
      // this component owns is folded into one boolean (see overlayOpen) so a new one cannot be
      // added and forgotten here.
      if (overlayOpenRef.current) return;
      // …and not while a canned report has replaced the card list. The feed keeps its rows in
      // rowsRef underneath, so every shortcut would otherwise still fire — j/k moving an
      // invisible focus ring, y/n/s ACTING on a row that is not on screen.
      if (reportViewRef.current) return;
      const visible = rowsRef.current;
      if (visible.length === 0) return;
      const focusedId = focusedIdRef.current;
      const statusView = statusViewRef.current;
      const idx = focusedId == null ? -1 : visible.findIndex((r) => r.id === focusedId);
      const focus = (i: number) => {
        const r = visible[Math.max(0, Math.min(visible.length - 1, i))];
        if (r) { setFocusedId(r.id); cardRefs.current[r.id]?.scrollIntoView({ block: "nearest" }); }
      };
      if (cmd === "next") { focus(idx + 1); e.preventDefault(); return; }
      if (cmd === "prev") { focus(idx < 0 ? 0 : idx - 1); e.preventDefault(); return; }
      if (focusedId == null) return;
      const row = visible.find((r) => r.id === focusedId);
      if (!row) return;
      const doAction = doActionRef.current;
      const toggleSelect = toggleSelectRef.current;
      if (cmd === "evidence") { setExpanded((x) => (x === row.id ? null : row.id)); e.preventDefault(); }
      else if (cmd === "accept") {
        // Y works in the Open queue only, like N and S. The row has no "Pick one" button any more:
        // a multi-candidate row is assigned from its opened evidence (E).
        if (statusView === "open" && row.single_candidate) {
          if (row.identity_in_reciter === false) showError(`${row.top_name || row.top_cwid} has no record in ReCiter's Identity table, so there is nothing to add this authorship to. Assign it to someone else instead.`);
          else doAction?.(row, "accept");
        } else if (statusView === "open") {
          // The same pick ✓ uses: one of the row's live candidates, chosen by a radio or a column.
          const cwid = pickedRef.current[row.id];
          const live = rankCandidates(parseCandidates(row.candidate_cwids_json)).some((c) => c.cwid === cwid);
          if (cwid && live) doAction?.(row, "assign", { cwid });
          else showError("Several people share this name: pick one on the row first, then press Y to assign it.");
        }
        e.preventDefault();
      }
      else if (cmd === "reject") { if (statusView === "open") doAction?.(row, "reject"); e.preventDefault(); }
      else if (cmd === "snooze") { if (statusView === "open") doAction?.(row, "snooze"); e.preventDefault(); }
      else if (cmd === "select") { toggleSelect?.(row); e.preventDefault(); }
      else if (cmd === "open") {
        const url = isExternalSource(row)
          ? (row.doi ? `https://doi.org/${row.doi}`
            : row.source === "openalex" ? openalexRecordUrl(row.external_id) : scopusRecordUrl(row.external_id))
          : `https://pubmed.ncbi.nlm.nih.gov/${row.pmid}/`;
        if (url) window.open(url, "_blank", "noreferrer");
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  // PR 6: the in-card empty state says how many rows of this queue the filters hide ("23
  // unassigned authorships fall outside the current source, filters, or search."). That needs the
  // queue's size with every filter and the search cleared: one extra read of the summary route,
  // made only while the list is empty, with the like-view's widest filters and the real queue.
  const listEmpty = !loading && !listError && rows.length === 0 && !bulkProgress && !reportView;
  const widenedSummaryBody = useMemo(
    () => JSON.stringify(buildSummaryBody({ ...filters, ...LIKE_WIDEN_PATCH, likeAuthor: "", statusView: filters.statusView })),
    [filters],
  );
  const [queueTotal, setQueueTotal] = useState<{ body: string; n: number } | null>(null);
  useEffect(() => {
    if (!listEmpty) return;
    let cancelled = false;
    const body = widenedSummaryBody, view = filters.statusView;
    fetch("/api/db/authorships/summary", { credentials: "same-origin", method: "POST", headers: apiHeaders, body })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: Summary) => {
        const n = view === "conflicts" ? d.conflicts : view === "duplicates" ? d.duplicates : d.total;
        if (!cancelled && typeof n === "number") setQueueTotal({ body, n });
      })
      .catch(() => { /* the empty state falls back to wording without a number */ });
    return () => { cancelled = true; };
  }, [listEmpty, widenedSummaryBody, filters.statusView]);
  const queueTotalNow = queueTotal && queueTotal.body === widenedSummaryBody ? queueTotal.n : null;
  // The empty state's "Reset filters": every filter back to its default but the queue the
  // curator is in, as in the prototype (clearAuthFilters keeps af.queue). One patch, one refetch.
  const resetFiltersKeepQueue = () => {
    likeFilterStash.current = null;
    patchFilters({ ...filterResetPatch(), statusView: filters.statusView });
    setSearchInput("");
    applyDatePreset(DEFAULT_DATE_PRESET);
  };

  // What is off its default, computed in ONE place (filterChips, pure and checked by
  // scripts/check-authorships-filter-body.mjs). The chip row shows every filter all the time
  // now; this list is what decides whether "Reset all" is offered.
  const chips = filterChips(filters, datePreset);
  // §2.1's header line trails the active date window ("…, past 2 years"). Derived from the
  // preset, not from dateFrom/dateTo, everywhere except "custom" — the preset is a module
  // constant on the first render and the dates are not, so this is the one form of the phrase
  // that cannot diverge between the prerendered HTML and hydration.
  const headerDatePhrase = datePhrase(datePreset, dateFrom, dateTo);
  // The MATCH CLASS entry currently in force. Compared by (lane, classification), never by
  // label — "All unassigned" and "All classes" are the same state, and only the first is ever
  // highlighted (matchClassLabel resolves that state to the default).
  const activeMatchClass = MATCH_CLASS_OPTIONS.find((o) => o.lane === lane && o.classification === classification);
  const hideCountsReady = summaryFor === summaryBody && !!summary?.hidden;
  // Identity affiliation reads `institutions`, which the server computes on EVERY summary call
  // whether or not the popover is open — unchanged by the on-demand Article facet, and it must
  // stay that way: this list is the one with a non-empty default, so it is on screen (as a chip
  // and as the button label) without anyone opening anything.
  const identityFacets = summary?.institutions || [];
  // Article affiliation is only real when the response in state (a) was fetched for exactly the
  // body now in force and (b) actually carried the facet. Anything else — the opt-in request
  // still in flight, or a response fetched without the flag — is "unknown", NOT zero. The
  // popover renders "Counting…" and em-dashes for that state; it must never print a 0 the
  // curator could read as "no NYP articles".
  const authorFacetsReady = summaryFor === summaryBody && Array.isArray(summary?.authorInstitutions);
  const authorFacets = authorFacetsReady ? (summary?.authorInstitutions || []) : [];
  // A value the curator has selected but which the current facet no longer counts (the server
  // drops n=0 buckets, and narrowing another filter can empty one) must still render its
  // checkbox — otherwise the only way to clear it is the chip row, and the popover silently
  // misreports what is in force.
  const withSelected = (facets: Array<{ key: string; n: number }>, chosen: string[]) => [
    ...facets,
    ...chosen.filter((k) => !facets.some((f) => f.key === k)).map((k) => ({ key: k, n: 0 })),
  ];
  const personTypeOptions = withSelected(
    (summary?.personTypes || []).map((pt) => ({ key: pt.type, n: pt.n })), selectedTypes,
  );
  const toggleInList = (list: string[], key: string) =>
    list.includes(key) ? list.filter((k) => k !== key) : [...list, key];

  // F4: near-certain bulk = visible single-candidate rows with IO >= 95 (and acceptable).
  // top_io_score can survive #938's no-suggestion rows (top_cwid null) even though there is no
  // candidate left to accept — exclude them explicitly rather than trust identity_in_reciter,
  // which is vacuously true when top_cwid is null.
  const nearCertainOnPage = rows.filter((r) => r.single_candidate && r.identity_in_reciter !== false && r.top_cwid && (r.top_io_score ?? 0) >= 95);
  // The statusView gate is NEW and load-bearing, and is kept OUT of the row predicate above so
  // that predicate stays a pure per-row test (check-authorships-no-suggestion.mjs lifts it out
  // of the source and runs it standalone). Until phase 3 this button only ever rendered inside a
  // `statusView === "open"` block; the bulk bar now renders in every queue so that "Showing N of
  // M" is always present, and a snoozed / dismissed / duplicate / conflict row must not become
  // bulk-acceptable just because it scores IO ≥ 95. Same gate as eligibleRows below.
  const nearCertain = statusView === "open" ? nearCertainOnPage : [];
  // Item 7: select-all targets the eligible (bulk-selectable) rows on this page — the same
  // set the per-row checkboxes allow (T4: multi-candidate rows included, for bulk-assign).
  // Accept safety is downstream: every accept-type consumer reads selectedAcceptRows, so
  // widening THIS set can never widen what "Accept selected" acts on.
  // The reportView gate is the same stance the statusView gate beside it takes, for the same
  // reason: a canned report is not a curation queue. Its rows are already-curated person_article
  // rows with no authorship_review id, so nothing here can act on them, and the feed's rows —
  // still loaded underneath — must not become bulk-selectable through a report the curator is
  // reading. "Accept near-certain" is gated at its render site instead of on its own line: that
  // line is pinned byte-for-byte by scripts/check-authorships-no-suggestion.mjs.
  const eligibleRows = statusView === "open" && reportView === null ? rows.filter((r) => isBulkSelectable(r, statusView)) : [];
  // PR 5: on Snoozed / Dismissed every row on the page can be selected, and Reopen is the only
  // bulk action there. Kept off eligibleRows, whose line above check-authorships-*.mjs pins.
  const selectableRows = isParkedQueue(statusView) && reportView === null ? rows : eligibleRows;
  const allEligibleSelected = selectableRows.length > 0 && selectableRows.every((r) => selected.has(r.id));
  const someEligibleSelected = selectableRows.some((r) => selected.has(r.id));
  // The bar's action cluster and its "N selected" label key off this.
  const hasSelection = selectedRows.length > 0;
  // The prototype's one checkbox: all selected (or a select-all-matching batch) clears the
  // selection, anything less selects every selectable row on the page.
  const toggleSelectAllEligible = useCallback(() => {
    if (allMatching) { setSelected(new Set()); setAllMatching(null); return; }
    setSelected((s) => {
      const next = new Set(s);
      const allSel = selectableRows.length > 0 && selectableRows.every((r) => next.has(r.id));
      if (allSel) selectableRows.forEach((r) => next.delete(r.id));
      else selectableRows.forEach((r) => next.add(r.id));
      return next;
    });
  }, [selectableRows, allMatching]);

  // ---- the filter chip row (Authorships PR 2) ----------------------------------------------
  // A snoozed or dismissed row is not in the open pile its like_count describes.
  const isParkedView = statusView === "snoozed" || statusView === "dismissed";
  const openChip = (key: string) => { setAffilQuery(""); setChipMenu(key); };
  // The Hide chip's ticked boxes, in list order. Server-side filters, never a client-side cut.
  const hideOn: string[] = [];
  if (hideNoSuggestion) hideOn.push("noSuggestion");
  if (hideNoIdentity) hideOn.push("noIdentity");
  // The chips a canned report cannot honour go while it is up (REPORT_HIDDEN_CHIP_IDS).
  const reportHides = (chipId: string) => !!reportView && isChipHiddenByReport(chipId);
  const closeChip = () => setChipMenu(null);
  // The prototype's "Reset all" shows once anything differs from the defaults, the source tab
  // and the search box included.
  const canReset = chips.length > 0 || !!search.trim() || !!searchInput.trim() || source !== FILTER_DEFAULTS.source;
  // The duplicates queue carries its own grey band (DuplicatesView), so the slate one would repeat it.
  const banner = reportView || statusView === "duplicates" ? null : drillBanner({ likeAuthor, count: loading || listError ? null : count, expected: likeExpected, statusView });
  // Queue counts the summary actually has: the queue on screen (its total) and the two review
  // queues, which the server counts over the open queue whatever is being browsed. The other
  // queues' totals would need a new summary field, so their rows show no number.
  const queueCount = (k: AuthorshipFilters["statusView"]): number | undefined =>
    k === "conflicts" ? summary?.conflicts : k === "duplicates" ? summary?.duplicates
      : k === statusView ? summary?.total : undefined;
  // Every known institution, the counted ones first (as the server orders them), then the rest
  // at 0 and greyed, as in the prototype. Until a facet has answered, counts read "—", never 0.
  const affilChipOptions = (facets: Array<{ key: string; n: number }>, chosen: string[], ready: boolean): ChipOption[] => {
    const counted = new Map(facets.map((f) => [f.key, f.n]));
    const keys = [
      ...facets.map((f) => f.key),
      ...Object.keys(INSTITUTION_LABELS).filter((k) => !counted.has(k)),
      ...chosen.filter((k) => !counted.has(k) && !INSTITUTION_LABELS[k]),
    ];
    const q = affilQuery.trim().toLowerCase();
    return keys
      .filter((k) => !q || instLabel(k).toLowerCase().includes(q))
      .map((k) => {
        const n = counted.get(k) ?? 0;
        return { value: k, label: instLabel(k), count: ready ? n.toLocaleString() : "—", dim: ready && n === 0 };
      });
  };

  return (
    <div style={{ fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif", color: "#0f172a" }}>
      {/* ================= header band (prototype markup ~722-775) ===========================
          Title, "What am I looking at?" and one muted count line on the left. On the right, in
          the prototype's order: the identity-conflicts and duplicate-records pills (each hidden
          at zero and hidden while you are in its own queue), Reports, Activity · N and the "?"
          shortcut legend. The cluster sits on the count line's baseline (flex-end). */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
            {/* .pm-page-title opts out of the global h1 rule (globals.css), whose !important
                weight/size/colour used to beat the prototype's serif 30px/600 title. */}
            <h1 className="pm-page-title">Authorships</h1>
            <button type="button" onClick={() => setAboutOpen((v) => !v)} aria-expanded={aboutOpen}
              style={{ font: "inherit", border: "none", background: "none", padding: 0, fontSize: 13, color: "var(--pm-slate)", cursor: "pointer" }}>
              What am I looking at?
            </button>
          </div>
          {/* One muted line, and the date phrase tracks the active date filter rather than
              naming a fixed window: with "All time" selected there is no phrase at all, and a
              custom window names its own bounds. summary is null until the first response, so
              the line holds its height with a non-breaking space instead of appearing late and
              pushing the control band down. */}
          <div style={{ fontSize: 14, color: "var(--pm-muted-foreground)" }}>
            {summary ? (
              <>
                <strong style={{ color: "var(--pm-foreground)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {summary.total.toLocaleString()}
                </strong>{" "}
                {SUMMARY_HEADLINE[statusView] || "authorships"}
                {headerDatePhrase ? `, ${headerDatePhrase}` : ""}
              </>
            ) : "\u00a0"}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Both pills open their queue and honour every OTHER filter, exactly like the list
              does (#988), so the number is the row count that queue will show. Hidden at zero (a
              "0 identity conflicts" pill is a permanent alarm for a condition that isn't there)
              and hidden inside its own queue, where the count line already says it. Each leaves
              a canned report on the way: statusView is one of the keys a report hides, so
              setting it from under a report would change the queue with nothing on screen
              moving. */}
          {(summary?.conflicts ?? 0) > 0 && statusView !== "conflicts" && (
            <Tip title="Two CWIDs assigned to one authorship — the same byline position on this paper is already accepted by a different WCM identity. Opens the Identity conflicts queue." placement="bottom" arrow>
              <button type="button" onClick={() => { selectReport(null); setStatusView("conflicts"); }} style={alertPill("red")}>
                {(summary?.conflicts ?? 0).toLocaleString()} identity conflict{summary?.conflicts === 1 ? "" : "s"}
              </button>
            </Tip>
          )}
          {(summary?.duplicates ?? 0) > 0 && statusView !== "duplicates" && (
            <Tip title="Same publication retrieved from PubMed and Scopus. Opens the Duplicate records queue." placement="bottom" arrow>
              <button type="button" onClick={() => { selectReport(null); setStatusView("duplicates"); }} style={alertPill("amber")}>
                {(summary?.duplicates ?? 0).toLocaleString()} duplicate record{summary?.duplicates === 1 ? "" : "s"}
              </button>
            </Tip>
          )}
          {/* Session-local conflict log — not in the prototype because it only exists once a
              curator has hit a 409 this session. Kept, as a plain outline button: the two pills
              beside it are server counts, this is a private history of this tab. */}
          {conflictLog.length > 0 && (
            <Tip title="Duplicate-conflict prompts raised in THIS browser session (lost on reload) — not a server queue." placement="bottom" arrow>
              <Button size="sm" onClick={(ev) => setHistoryAnchor(ev.currentTarget)}>
                Session conflicts · {conflictLog.length}
              </Button>
            </Tip>
          )}
          {/* Canned reports. Always visible: a navigation control, not an alarm. The label is a
              constant, so the summary landing late cannot reflow this band. */}
          <Button size="sm" onClick={(ev) => setReportAnchor(ev.currentTarget)}
            aria-haspopup="true" aria-expanded={!!reportAnchor}
            sx={reportView ? { bgcolor: "var(--pm-slate-tint)", borderColor: "var(--pm-slate-tint-border)", color: "var(--pm-slate)" } : undefined}>
            Reports<Chevron />
          </Button>
          {/* Not filter-scoped, and the server caps the feed at 15; the panel header says
              "All curators" so it is not read as "matching these filters". */}
          <Button size="sm" onClick={(ev) => setActivityAnchor(ev.currentTarget)}
            aria-haspopup="true" aria-expanded={!!activityAnchor}>
            Activity · {recentActivity.length}
          </Button>
          <Button ref={keysBtnRef} variant="ghost" size="sm" aria-label="Keyboard shortcuts" title="Keyboard shortcuts"
            aria-haspopup="true" aria-expanded={!!keysAnchor}
            onClick={(ev) => setKeysAnchor(keysAnchor ? null : ev.currentTarget)}
            sx={{ width: 32, px: 0, fontSize: 14, fontWeight: 600 }}>
            ?
          </Button>
        </div>
      </div>

      {aboutOpen && (
        <div style={{ background: "var(--pm-surface)", border: "1px solid var(--pm-border)", borderRadius: "var(--radius-card)", padding: "14px 18px", fontSize: 13.5, lineHeight: 1.6, color: "var(--pm-foreground)", maxWidth: 860, marginBottom: 16, textWrap: "pretty" } as CSSProperties}>
          Each row is an author on a PubMed or Scopus article whose affiliation matches an institution, but who
          isn&rsquo;t yet linked to a person in ReCiter. Accept to assign the authorship to the suggested identity,
          pick one when several people share the name, or reject if the suggestion is wrong. Snooze parks a row for
          90 days; Dismiss removes it without a decision. IO is the Identity-Only Score: how strongly the
          article&rsquo;s author record matches the person&rsquo;s identity. Match class says how production scored
          it: Suggested rows are already in a curator&rsquo;s queue, Buried rows scored under 30, Never retrieved
          rows were never scored.
        </div>
      )}

      {/* ================= the filter card (prototype markup ~814-874) ======================
          Row 1: the source segment on the left, search and sort on the right. Row 2: one chip
          per filter, always present, each showing its value and opening its own list; "Reset
          all" at the end once anything is off its default. Then the drill banner, then the bulk
          bar. While a canned report is up, every control the report cannot honour is hidden
          (not disabled — a greyed control still reads as "this exists and is off"); the values
          are kept and come straight back with the feed. */}
      <div style={{ background: "var(--pm-surface)", border: "1px solid var(--pm-border)", borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)", marginBottom: 16 }}>

        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "1px solid var(--pm-border)", flexWrap: "wrap" }}>
          {/* Source segment. Each tab carries its lane's count in this queue, muted and
              tabular; the count is left off until the summary lands, so nothing shows a false 0.
              Hidden under a report: `source` is authorship_review's producer lane and
              person_article has no counterpart. */}
          {!reportView && (
            <div style={{ display: "inline-flex", alignItems: "center", background: "var(--pm-surface-2)", border: "1px solid var(--pm-border)", borderRadius: 8, padding: 3 }}>
              {([["all", "All"], ["pubmed", "PubMed"], ["scopus", "Scopus"], ["openalex", "OpenAlex"]] as const).map(([key, label]) => {
                const n = !summary?.bySource ? undefined
                  : key === "all" ? Object.values(summary.bySource).reduce((a, b) => a + b, 0)
                    : summary.bySource[key] ?? 0;
                const what = key === "scopus" ? "WCM authorships found in Scopus but NOT in PubMed (no production score)"
                  : key === "openalex" ? "WCM conference abstracts and preprints found in OpenAlex but NOT in PubMed (no production score)"
                  : key === "pubmed" ? "Authorships from PubMed" : "All sources";
                return (
                  <Tip key={key} title={n != null ? `${what} — ${n.toLocaleString()} in this queue` : what} placement="top" arrow>
                    <button onClick={() => setSource(key)} style={segBtn(source === key)} aria-pressed={source === key}>
                      {label}
                      {n != null && <span style={segCount}>{n.toLocaleString()}</span>}
                    </button>
                  </Tip>
                );
              })}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", flexWrap: "wrap" }}>
            <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); }} style={{ width: 260, maxWidth: "100%" }}>
              {/* bound to searchInput, NOT search: the box debounces (300 ms) into the filter. */}
              <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} type="search"
                placeholder="Name, CWID, PMID, or affiliation"
                inputProps={{ "aria-label": "Filter by name, CWID, PMID, or affiliation" }}
                sx={{ width: "100%", height: 32, fontSize: 14, borderRadius: "8px", "& .MuiOutlinedInput-input": { py: 0, px: 1.25 } }} />
            </form>
            {/* The UI-system Select. The seven sorts the server supports, in the prototype's
                wording; never a chip and never reset. Hidden under a report, whose order is its
                own (changing it would refetch the report for an identical result). */}
            {!reportView && (
              <Select value={sort} onChange={(v) => setSort(v)}
                options={SORT_OPTIONS}
                onOpen={() => setSortOpen(true)} onClose={() => setSortOpen(false)}
                inputProps={{ "aria-label": "Sort" }}
                title={"Sort order — kept when any other control changes.\n“Match confidence” is the matcher's name/affiliation heuristic, not IO."}
                MenuProps={{ MenuListProps: { sx: SORT_MENU_SX } }}
                IconComponent={SortChevron}
                sx={{ width: 224, maxWidth: "100%", height: 32, fontSize: 13.5, borderRadius: "8px", "& .MuiSelect-select": { py: 0.5, pl: 1.5, pr: "30px !important" }, "& .MuiSelect-icon": { top: "calc(50% - 7px)", right: 10, color: "var(--pm-muted-foreground)" } }} />
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: "1px solid var(--pm-border)", flexWrap: "wrap" }}>
          {!reportHides("queue") && (
            <FilterChip label="Queue" text={singleChipText("Queue", STATUS_VIEW_LABEL[statusView])}
              active={statusView !== FILTER_DEFAULTS.statusView} single
              open={chipMenu === "queue"} onOpen={() => openChip("queue")} onClose={closeChip}
              options={QUEUE_OPTIONS.map((q) => ({ value: q.key, label: STATUS_VIEW_LABEL[q.key], sub: q.note, count: fmtCount(queueCount(q.key)) }))}
              isChecked={(v) => v === statusView}
              onPick={(v) => setStatusView(v as AuthorshipFilters["statusView"])} />
          )}
          {!reportHides("class") && (
            <FilterChip label="Match class" text={singleChipText("Match class", matchClassLabel(filters))}
              active={matchClassLabel(filters) !== MATCH_CLASS_DEFAULT} single
              open={chipMenu === "match"} onOpen={() => openChip("match")} onClose={closeChip}
              options={MATCH_CLASS_OPTIONS.map((o, i) => ({ value: String(i), label: o.label, sub: o.sub, title: o.hint, count: fmtCount(o.count(summary)) }))}
              isChecked={(v) => MATCH_CLASS_OPTIONS[Number(v)] === activeMatchClass}
              onPick={(v) => selectMatchClass(MATCH_CLASS_OPTIONS[Number(v)])} />
          )}
          <FilterChip label="Person type" text={chipText("Person type", selectedTypes)}
            active={selectedTypes.length > 0}
            open={chipMenu === "ptype"} onOpen={() => openChip("ptype")} onClose={closeChip}
            options={personTypeOptions.map((pt) => ({ value: pt.key, label: pt.key, count: fmtCount(pt.n) }))}
            empty={<div style={chipEmptyStyle}>{summary ? "No person types" : "Loading…"}</div>}
            isChecked={(v) => selectedTypes.includes(v)}
            onPick={(v) => setSelectedTypes((s) => toggleInList(s, v))}
            onClear={() => setSelectedTypes([])} />
          <FilterChip label="Identity affiliation"
            text={chipText("Identity affiliation", selectedInstitutions, { allLabel: "Any", labelOf: instLabel })}
            active={selectedInstitutions.length > 0}
            open={chipMenu === "inst"} onOpen={() => openChip("inst")} onClose={closeChip}
            search={{ value: affilQuery, onChange: setAffilQuery, placeholder: "Find an institution" }}
            options={affilChipOptions(identityFacets, selectedInstitutions, !!summary?.institutions)}
            empty={<div style={chipEmptyStyle}>No match</div>}
            isChecked={(v) => selectedInstitutions.includes(v)}
            onPick={(v) => setSelectedInstitutions((s) => toggleInList(s, v))}
            onClear={() => setSelectedInstitutions([])} />
          {/* The byline affiliation is an authorship_review column a report cannot honour. Its
              counts are fetched on demand when this list opens (see affilFacetKey); until they
              arrive they show "—", never 0. */}
          {!reportHides("authorAffil:any") && (
            <FilterChip label="Article affiliation"
              text={chipText("Article affiliation", selectedAuthorAffiliations, { allLabel: "Any", labelOf: instLabel })}
              active={selectedAuthorAffiliations.length > 0}
              open={chipMenu === "ainst"} onOpen={() => openChip("ainst")} onClose={closeChip}
              search={{ value: affilQuery, onChange: setAffilQuery, placeholder: "Find an institution" }}
              options={affilChipOptions(authorFacets, selectedAuthorAffiliations, authorFacetsReady)}
              empty={<div style={chipEmptyStyle}>No match</div>}
              isChecked={(v) => selectedAuthorAffiliations.includes(v)}
              onPick={(v) => setSelectedAuthorAffiliations((s) => toggleInList(s, v))}
              onClear={() => setSelectedAuthorAffiliations([])} />
          )}
          {/* Scopus's own facet (pub_type = subtypeDescription), so the chip exists only on the
              Scopus tab; the source effect empties the list on the way out. */}
          {!reportView && source === "scopus" && (
            <FilterChip label="Pub type" text={chipText("Pub type", selectedPubTypes)}
              active={selectedPubTypes.length > 0}
              open={chipMenu === "pubType"} onOpen={() => openChip("pubType")} onClose={closeChip}
              options={withSelected((summary?.pubTypes || []).map((pt) => ({ key: pt.type, n: pt.n })), selectedPubTypes)
                .map((pt) => ({ value: pt.key, label: pt.key, count: fmtCount(pt.n) }))}
              empty={<div style={chipEmptyStyle}>{summary ? "No publication types" : "Loading…"}</div>}
              isChecked={(v) => selectedPubTypes.includes(v)}
              onPick={(v) => setSelectedPubTypes((s) => toggleInList(s, v))}
              onClear={() => setSelectedPubTypes([])} />
          )}
          <FilterChip label="Date" text={singleChipText("Date", datePreset === "custom" ? "Custom" : DATE_PRESET_LABEL[datePreset] || datePreset)}
            active={datePreset !== DEFAULT_DATE_PRESET} single
            open={chipMenu === "date"} onOpen={() => openChip("date")} onClose={closeChip}
            options={DATE_PRESET_ORDER.map((p) => ({ value: p, label: DATE_PRESET_LABEL[p] }))}
            isChecked={(v) => v === datePreset}
            onPick={(v) => applyDatePreset(v)} />
          {/* Both Hide boxes are vacuous on a report (it INNER JOINs identity), so the chip goes. */}
          {!reportHides("hideNoSuggestion") && (
            <FilterChip label="Hide"
              text={chipText("Hide", hideOn, { labelOf: (v) => HIDE_LABEL[v] })}
              active={hideNoSuggestion || hideNoIdentity}
              open={chipMenu === "hide"} onOpen={() => openChip("hide")} onClose={closeChip}
              options={[
                { value: "noSuggestion", label: HIDE_LABEL.noSuggestion, sub: "No identity in ReCiter matches the byline name", count: hideCountsReady ? summary!.hidden!.noSuggestion.toLocaleString() : "—" },
                { value: "noIdentity", label: HIDE_LABEL.noIdentity, sub: "The suggested person has no ReCiter identity yet", count: hideCountsReady ? summary!.hidden!.noIdentity.toLocaleString() : "—" },
              ]}
              isChecked={(v) => (v === "noSuggestion" ? hideNoSuggestion : hideNoIdentity)}
              onPick={(v) => (v === "noSuggestion" ? setHideNoSuggestion((x) => !x) : setHideNoIdentity((x) => !x))}
              onClear={() => patchFilters({ hideNoSuggestion: false, hideNoIdentity: false })} />
          )}
          {datePreset === "custom" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--pm-muted-foreground)" }}>
              <span>From</span>
              <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} aria-label="From date"
                style={dateInputStyle} />
              <span>to</span>
              <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} aria-label="To date"
                style={dateInputStyle} />
            </div>
          )}
          {/* Resets every filter, including any a report hides; sort is left alone. */}
          {canReset && (
            <button type="button" onClick={resetAll} title="Restore every filter to its default (sort is left alone)"
              style={{ font: "inherit", marginLeft: "auto", border: 0, background: "none", padding: "0 4px", fontSize: 12.5, color: "var(--pm-slate)", cursor: "pointer" }}>
              Reset all
            </button>
          )}
        </div>

        {/* The drill banner (prototype markup ~938). A "Show N others like this" drill names the
            pile and offers the way back to the filters it replaced; the conflicts and duplicates
            queues name themselves only, because they keep the curator's filters (#988). */}
        {banner && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 16px", borderBottom: "1px solid var(--pm-border)", background: "var(--pm-slate-tint)", color: "var(--pm-slate)", fontSize: 12.5 }}>
            <span>{banner.label}</span>
            {banner.note && <span style={{ color: "var(--pm-muted-foreground)" }}>{banner.note}</span>}
            {banner.back && (
              <button type="button" onClick={clearLikeAuthor}
                style={{ font: "inherit", marginLeft: "auto", border: 0, background: "none", padding: 0, fontSize: 12.5, fontWeight: 600, color: "var(--pm-slate)", cursor: "pointer" }}>
                ← Back to previous filters
              </button>
            )}
          </div>
        )}

        {/* ---- selection / bulk bar (§2.5, mockup:286-315) ------------------------------------
            The actions appear only when rows are selected. What did NOT change: a selection can
            only exist on the open queue (isBulkSelectable gates on statusView), every accept-type
            button still reads selectedAcceptRows, and "Accept near-certain" is gated on the open
            queue explicitly now that the bar itself renders in every queue for "Showing N of M". */}
        {/* The whole bar goes while a canned report is up. Its actions have nothing to act on
            (a report row is an already-curated person_article row with no authorship_review id),
            and its "Showing N of M" describes the feed still loaded underneath — a true number
            about something the curator is not looking at, which is the worst kind. The report
            panel carries its own "N rows across M people" instead. */}
        {/* PR 6: the duplicates queue renders as PubMed / Scopus pairs (DuplicatesView), not
            authorship rows. The filter chips above stay: that queue keeps the curator's
            filters (Decision 2 / #988), so they must stay visible and changeable. */}
        {!reportView && statusView === "duplicates" && (
          <DuplicatesView rows={rows} loading={loading} listError={listError} actingId={actingId}
            onRetry={() => fetchData()} onAction={(r, action, extra) => doAction(r, action, extra)}
            conflicts={conflicts} onClearConflict={clearConflict}
            onBack={() => setStatusView("open")}
            empty={listEmpty ? emptyState({ statusView, queueTotal: queueTotalNow, filtersOn: canReset }) : null}
            onReset={resetFiltersKeepQueue}
            pager={count > rows.length ? { page, totalPages, count, setPage } : null} />
        )}
        {!reportView && statusView !== "duplicates" && (
        <>
        {/* The bar (prototype markup ~877-951): a warm surface-2 band. One checkbox selects the
            page or clears it, then the queue's actions: Accept N (primary), Assign to… with its
            popover, Reject N, Snooze, Dismiss on Open; Reopen N on Snoozed / Dismissed. Accept
            still acts only on selectedAcceptRows and says how many. */}
        <div data-bulk-bar style={{ display: "flex", alignItems: "center", gap: 12, rowGap: 8, flexWrap: "wrap", padding: "8px 16px", minHeight: 48, boxSizing: "border-box", borderBottom: "1px solid var(--pm-border)", background: "var(--pm-surface-2)" }}>
          {(statusView === "open" || isParkedView) && (
            <button type="button" role="checkbox" disabled={selectableRows.length === 0 && !allMatching}
              aria-checked={allEligibleSelected || !!allMatching ? "true" : someEligibleSelected ? "mixed" : "false"}
              onClick={toggleSelectAllEligible}
              title={statusView === "open"
                ? "Select every selectable row on this page. Accept acts on single-candidate rows; Assign, Reject, Snooze and Dismiss on every selected row."
                : "Select every row on this page, to reopen them together."}
              style={{ display: "flex", alignItems: "center", gap: 8, font: "inherit", fontSize: 13, border: 0, background: "none", padding: 0, color: "var(--pm-foreground)", cursor: selectableRows.length === 0 && !allMatching ? "default" : "pointer", opacity: selectableRows.length === 0 && !allMatching ? 0.5 : 1 }}>
              {(() => {
                const on = allEligibleSelected || !!allMatching, some = !on && someEligibleSelected;
                return (
                  <span style={{
                    width: 16, height: 16, boxSizing: "border-box", borderRadius: 4, display: "grid", placeItems: "center", flexShrink: 0,
                    color: "var(--pm-slate)", border: `1.5px solid ${on || some ? "var(--pm-slate)" : "var(--pm-muted-foreground)"}`,
                    background: on || some ? "var(--pm-slate-tint)" : "#fff",
                  }}>
                    {on && <IconCheck size={11} style={{ strokeWidth: 3 }} />}
                    {some && <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" aria-hidden="true"><path d="M6 12h12" /></svg>}
                  </span>
                );
              })()}
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{hasSelection ? `${selectedRows.length.toLocaleString()} selected` : "Select all"}</span>
            </button>
          )}

          {hasSelection && statusView === "open" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {/* Accept counts only the rows it will accept (single-candidate, with a ReCiter
                  identity); it hides once the selection is assign-only. */}
              {selectedAcceptRows.length > 0 && (
                <Button variant="primary" size="sm" disabled={!!bulkProgress}
                  title={selectedAcceptRows.length < selectedRows.length
                    ? `Accepts the ${selectedAcceptRows.length.toLocaleString()} single-candidate rows. Rows with several candidates or no ReCiter identity need Assign to….`
                    : undefined}
                  onClick={() => doBulkAccept(selectedAcceptRows)}>
                  Accept {selectedAcceptRows.length.toLocaleString()}
                </Button>
              )}
              <Button variant="secondary" size="sm" disabled={!!bulkProgress}
                aria-haspopup="dialog" aria-expanded={!!assignMenuAnchor}
                onClick={(e) => (assignMenuAnchor ? closeAssignPicker() : openAssignPicker(e.currentTarget))}>
                Assign to…<Chevron />
              </Button>
              <Button variant="secondary" size="sm" disabled={!!bulkProgress}
                onClick={() => setRejectConfirmOpen(true)}>
                Reject {selectedRows.length.toLocaleString()}
              </Button>
              {/* No confirm on Snooze or Dismiss: they write only a status, and Undo reverses the batch. */}
              <Button variant="secondary" size="sm" disabled={!!bulkProgress}
                onClick={() => doBulkSnooze(selectedRows)}>
                Snooze
              </Button>
              <Button variant="secondary" size="sm" disabled={!!bulkProgress}
                onClick={() => doBulkDismiss(selectedRows)}>
                Dismiss
              </Button>
              {/* Escape hatch from the page-scoped selection: offered only once this page is
                  fully selected and there is more behind it, with the count in the label. Hidden
                  whenever the selection holds multi-candidate rows — selectAllMatching REPLACES
                  the selection with the server's single-candidate-only set, which would drop them. */}
              {allEligibleSelected && selectedAcceptRows.length === selectedRows.length && !allMatching && count > eligibleRows.length && (
                <Button variant="ghost" size="sm" disabled={selectingAll} onClick={selectAllMatching}
                  sx={{ color: "var(--pm-slate)" }}>
                  {selectingAll ? "Selecting…" : `Select all ${count.toLocaleString()} matching`}
                </Button>
              )}
              {allMatching && (
                <span style={{ color: "var(--pm-slate)", fontWeight: 600, fontSize: 13 }}>
                  All {allMatching.length.toLocaleString()} matching rows selected
                </span>
              )}
            </div>
          )}

          {hasSelection && isParkedView && (
            <Button variant="secondary" size="sm" disabled={!!bulkProgress}
              onClick={() => doBulkReopen(selectedRows)}>
              Reopen {selectedRows.length.toLocaleString()}
            </Button>
          )}

          {bulkProgress && (
            <span style={{ color: "var(--pm-muted-foreground)", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
              Working: {bulkProgress.done.toLocaleString()} of {bulkProgress.total.toLocaleString()}…
            </span>
          )}

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            {!listError && !loading && (
            <span style={{ fontSize: 12.5, color: "var(--pm-muted-foreground)", fontVariantNumeric: "tabular-nums" }}>
              {count === 0 ? "Showing 0" : `Showing ${rows.length.toLocaleString()} of ${count.toLocaleString()}`}
            </span>
            )}
            {/* Stays up while rows are selected, as in the prototype; it acts on its own set
                (single-candidate rows on this page with IO ≥ 95), never on the selection. */}
            {statusView === "open" && (
              <Tip title="Acts on single-candidate rows with IO ≥ 95 on this page only, not on the selection" placement="top" arrow>
                <span>
                  <Button variant="secondary" size="sm" disabled={nearCertain.length === 0 || !!bulkProgress || loading} onClick={() => doBulkAccept(nearCertain)}>
                    Accept near-certain · IO ≥ 95
                    {/* While a list is loading, the rows behind this count are not on screen. */}
                    <span style={{ fontSize: 11.5, color: "var(--pm-muted-foreground)", fontVariantNumeric: "tabular-nums" }}>{loading ? "" : nearCertain.length}</span>
                  </Button>
                </span>
              </Tip>
            )}
          </div>
        </div>

        {/* ---- the table (prototype markup ~957-1234) ---------------------------------------
            The rows live in this panel under one column header, separated by hairlines. The
            feed's pagination (Decision 3: kept, the prototype has none) and the shortcuts line
            close the panel. */}
        <div data-arow-head style={{
          display: "grid", gridTemplateColumns: ROW_GRID, gap: 14, padding: "8px 16px 8px 19px",
          borderBottom: "1px solid var(--pm-border)", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
          textTransform: "uppercase", color: "var(--pm-muted-foreground)",
        }}>
          <span /><span title="Identity-Only Score">IO</span><span>Author → suggested identity</span><span>Article</span><span style={{ width: 104 }} />
        </div>
        <div>
        {loading && <div role="status" style={{ padding: "48px 24px", textAlign: "center", fontSize: 13.5, color: "var(--pm-muted-foreground)" }}>Loading authorships…</div>}
        {/* During a bulk run every selected row leaves the page at once and the refill waits for
            the whole batch, so an empty list here means "working", not "nothing matches" — the
            old message read as a dead page and invited the reload that abandons the run. */}
        {!loading && rows.length === 0 && bulkProgress && (
          <div style={{ padding: 24, textAlign: "center", color: "#4a5262", fontVariantNumeric: "tabular-nums" }}>
            Working through the selection: {bulkProgress.done.toLocaleString()} of {bulkProgress.total.toLocaleString()}.
            The queue refills when the batch finishes — keep this tab open.
          </div>
        )}
        {/* A failed list request is not an empty result: say so, in the card, with a Retry. */}
        {!loading && listError && (
          <div role="alert" style={{ padding: "40px 24px", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display-serif)", fontSize: 20, fontWeight: 600, color: "var(--pm-foreground)", marginBottom: 6 }}>
              Couldn&rsquo;t load authorships
            </div>
            <div style={{ fontSize: 13.5, color: "var(--pm-muted-foreground)", marginBottom: 14 }}>
              The server didn&rsquo;t answer. Your filters are kept; try again in a moment.
            </div>
            <button type="button" onClick={() => fetchData()} style={btn("ghost")}>Retry</button>
          </div>
        )}
        {listEmpty && <EmptyState {...emptyState({ statusView, queueTotal: queueTotalNow, filtersOn: canReset })} onReset={resetFiltersKeepQueue} />}
        {!loading && rows.map((r) => (
          <AuthorshipCard
            key={r.id}
            row={r}
            // The conflicts review queue hands the card "open": its rows ARE open rows. (The
            // duplicates queue never reaches here since PR 6; it renders DuplicatesView.)
            statusView={statusView === "conflicts" ? "open" : statusView}
            // …but the checkbox must NOT follow that substitution, and this is why it is a prop
            // rather than something the card recomputes from the statusView it was handed. Bulk
            // actions are open-queue only (isBulkSelectable returns false for every other view,
            // and toggleSelect gates on the REAL statusView), so a card told "open" inside the
            // duplicates or conflicts queue rendered an enabled checkbox that did nothing when
            // clicked. Computed here, from the real queue, so the page and the card cannot
            // disagree about what is selectable.
            // PR 5: on Snoozed / Dismissed every row is selectable, for bulk Reopen.
            selectable={isParkedQueue(statusView) || isBulkSelectable(r, statusView)}
            isExpanded={expanded === r.id}
            isSelected={selected.has(r.id)}
            isFocused={focusedId === r.id}
            acting={actingId === r.id}
            pickedCwid={picked[r.id]}
            assignPrefill={assignPrefill?.id === r.id ? assignPrefill.name : undefined}
            registerRef={(el) => { cardRefs.current[r.id] = el; }}
            onFocus={() => setFocusedId(r.id)}
            onToggleExpand={() => setExpanded((e) => (e === r.id ? null : r.id))}
            onToggleSelect={() => toggleSelect(r)}
            onPick={(cwid) => setPicked((p) => ({ ...p, [r.id]: cwid }))}
            onAction={(action, extra) => doAction(r, action, extra)}
            onMenu={(anchor) => setMenu({ anchor, row: r })}
            onAssignOther={() => focusAssignOther(r.id, r.wcm_author)}
            // Scopus/OpenAlex rows have no pmid; the server keys their siblings by external_id
            // (siblingKey), and the search box matches external_id, so narrow by that.
            onNarrowPmid={() => narrowToPmid(isExternalSource(r) ? r.external_id : r.pmid)}
            onFindOthers={() => findOthersLikeThis(r.wcm_author, (r.like_count ?? 0) + (isParkedView ? 0 : 1))}
            // §2.6 hover card: `undefined` means "not asked yet / still in flight", which the
            // card renders as a loading line. An answered cwid always has an entry.
            priorNamesByCwid={priorNames}
            onHoverIdentity={requestPriorNames}
            // Session conflict if this curator just hit it; otherwise rehydrate the one
            // persisted on the row, so a refresh (or a different curator) still sees why.
            conflict={conflicts[r.id] ?? (r.accept_conflict ? {
              kind: "dup" as const,
              id: r.id, action: "accept", message: r.accept_conflict, matches: storedDupMatches(r),
              wcm_author: r.wcm_author, top_name: r.top_name, ts: 0,
            } : undefined)}
            onClearConflict={() => clearConflict(r.id)}
            conflictQueue={statusView === "conflicts"}
          />
        ))}
        </div>
        <div data-arow-foot style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 14, rowGap: 8, padding: "8px 16px", fontSize: 11.5, color: "var(--pm-muted-foreground)" }}>
          {shortcutsLine(statusView === "open", isParkedView).map((s) => <span key={s}>{s}</span>)}
          {/* pagination — the feed's. A like view is the whole pile on one page (LIKE_PILE_CAP),
              so it has nothing to page. */}
          {!likeAuthor.trim() && !listError && !loading && count > 0 && (
            <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{count.toLocaleString()} authorships · page {page + 1} of {totalPages}</span>
              <button type="button" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} style={pagerBtn(page === 0)}>Previous</button>
              <button type="button" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} style={pagerBtn(page + 1 >= totalPages)}>Next</button>
            </span>
          )}
        </div>
        </>
        )}
      </div>

      {/* ---- Reports (prototype markup ~741-753) ------------------------------------------
          The two curator/model disagreement reports, each with a one-line note and its count,
          and one shared footnote. The way back to the feed is "Close report" on the report
          panel itself. The note says which filters a report honours, here where it is chosen,
          so nobody has to discover afterwards why a control they set had no effect. */}
      <Popover open={!!reportAnchor} anchorEl={reportAnchor} onClose={() => setReportAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ style: { ...popoverPaper, width: 320, padding: 6, display: "flex", flexDirection: "column" } }}>
        {REPORT_OPTIONS.map((r) => {
          const n = r.count(summary);
          return (
            <button key={r.key} type="button" className={optionRowClass} onClick={() => selectReport(r.key)}
              aria-current={reportView === r.key ? "true" : undefined}
              style={{ font: "inherit", display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px", border: 0, borderRadius: 6, textAlign: "left", cursor: "pointer", color: "var(--pm-foreground)", background: reportView === r.key ? "var(--pm-slate-tint)" : "none" }}>
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{REPORT_LABEL[r.key]}</span>
                <span style={{ fontSize: 12, color: "var(--pm-muted-foreground)" }}>{r.note}</span>
              </span>
              <span style={{ fontSize: 12, color: "var(--pm-muted-foreground)", fontVariantNumeric: "tabular-nums" }}>
                {n != null ? n.toLocaleString() : ""}
              </span>
            </button>
          );
        })}
        {/* Over the queue the date window filters authorship_review.entrez_date (when ReCiter
            RETRIEVED the article); over a report it filters the publication date. */}
        <div style={{ borderTop: "1px solid var(--pm-border)", marginTop: 4, padding: "8px 10px 4px", fontSize: 11.5, color: "var(--pm-muted-foreground)", lineHeight: 1.45 }}>
          {REPORT_FILTER_NOTE}. Here the date is the publication date, not the date ReCiter retrieved the article.
        </div>
      </Popover>

      {/* ---- keyboard legend (prototype markup ~765-775) -----------------------------------
          Transcribed from the keydown handler (utils/authorshipChips KEY_LEGEND), in the
          prototype's order, plus Enter, which this page also handles. */}
      <Popover open={!!keysAnchor} anchorEl={keysAnchor} onClose={() => setKeysAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ style: { ...popoverPaper, width: 300, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 } }}>
        <span style={{ fontSize: 13, fontWeight: 600, paddingBottom: 2, color: "var(--pm-foreground)" }}>Keyboard shortcuts</span>
        {KEY_LEGEND.map((k) => (
          <div key={k.key} style={{ display: "flex", gap: 10, alignItems: "baseline", fontSize: 12.5 }}>
            <span style={{ minWidth: 52, fontFamily: "var(--font-mono)", fontSize: 11.5, fontWeight: 600, color: "var(--pm-foreground)" }}>{k.key}</span>
            <span style={{ color: "var(--pm-muted-foreground)" }}>{k.label}</span>
          </div>
        ))}
        <span style={{ fontSize: 11.5, color: "var(--pm-muted-foreground)", lineHeight: 1.45, borderTop: "1px solid var(--pm-border)", paddingTop: 6, marginTop: 2 }}>
          Accept, reject and snooze work in the Open queue. Shortcuts pause while a list or dialog is open, or while you type.
        </span>
      </Popover>

      {/* The bulk "Assign to…" popover (prototype markup ~888-939), anchored under its button.
          Two steps in one place: the list of everyone the selection proposes (unionCandidates —
          strongest score first, then coverage) with a CWID-or-name box for anyone else, then the
          confirm step for the person chosen. Choosing never submits: it fires the ONE server
          lookup (B-8) and the confirm is built on what that returns, never on a typed string or
          a possibly-stale candidate label. The confirm previews every selected row and offers
          "Assign the N high-confidence only" beside "Assign all N". */}
      <Popover open={!!assignMenuAnchor} anchorEl={assignMenuAnchor} onClose={closeAssignPicker}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }} transformOrigin={{ vertical: "top", horizontal: "left" }}
        PaperProps={{
          role: "dialog", "aria-label": "Assign selected authorships",
          style: { ...popoverPaper, width: 470, maxWidth: "calc(100vw - 48px)", display: "flex", flexDirection: "column", fontSize: 13, color: "var(--pm-foreground)", boxShadow: "0 10px 28px rgba(34,30,28,0.14)" },
        } as any}>
        {!assignConfirm ? (
          <>
            <div style={{ padding: "10px 14px 6px", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--pm-muted-foreground)" }}>
                Assign {selectedRows.length.toLocaleString()} selected to
              </span>
              <span style={{ fontSize: 11.5, color: "var(--pm-muted-foreground)" }}>Most matches first, then confidence</span>
            </div>
            {assignCandidateUnion.length > 0 ? (
              <div style={{ maxHeight: 320, overflow: "auto", display: "flex", flexDirection: "column", padding: "0 6px 6px" }}>
                {orderAssignOptions(assignCandidateUnion, assignScoresOf).map((c) => {
                  const sum = assignOptionSummary(assignScoresOf(c.cwid), selectedRows.length, c.matches);
                  const role = [c.person_type, c.dept].filter(Boolean).join(" · ");
                  return (
                    <button key={c.cwid} type="button" className="pm-assign-opt" disabled={!!assignLookupCwid}
                      onClick={() => chooseAssignTarget(c.cwid)}
                      style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: "4px 12px", alignItems: "start", padding: "9px 10px", border: 0, borderRadius: 7, textAlign: "left", cursor: assignLookupCwid ? "default" : "pointer", font: "inherit", fontSize: 13, color: "var(--pm-foreground)" }}>
                      <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                        <span>
                          {c.name && <span style={{ fontWeight: 600 }}>{c.name} </span>}
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--pm-muted-foreground)" }}>{c.cwid}</span>
                          <span style={{ color: "var(--pm-muted-foreground)" }}> · matches {c.matches} of {selectedRows.length.toLocaleString()} selected</span>
                        </span>
                        {role && <span style={{ fontSize: 12, color: "var(--pm-muted-foreground)" }}>{role}</span>}
                        {sum.warn && <span style={{ fontSize: 12, color: "var(--pm-amber)", fontWeight: 500 }}>{sum.warn}</span>}
                      </span>
                      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        {sum.bands.length > 0 && (
                          <span style={{ display: "flex", gap: 4 }}>
                            {sum.bands.map((b) => <BandPill key={b.band} band={b.band}>{b.n} {b.band}</BandPill>)}
                          </span>
                        )}
                        <span style={{ fontSize: 11.5, color: "var(--pm-muted-foreground)", fontVariantNumeric: "tabular-nums" }}>{sum.ioText}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <span style={{ padding: "4px 14px 10px", color: "var(--pm-muted-foreground)" }}>
                None of the selected rows has a suggested identity. Use Someone else.
              </span>
            )}
            {assignLookupCwid && (
              <span role="status" style={{ padding: "0 14px 10px", fontSize: 12.5, color: "var(--pm-muted-foreground)" }}>
                Looking up {assignLookupCwid}…
              </span>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderTop: "1px solid var(--pm-border)", background: "var(--pm-surface-2)", borderRadius: assignErr ? 0 : "0 0 10px 10px" }}>
              <label htmlFor="bulk-assign-other" style={{ fontSize: 12.5, color: "var(--pm-muted-foreground)", whiteSpace: "nowrap" }}>Someone else:</label>
              <input id="bulk-assign-other" value={assignOtherCwid} placeholder="CWID or full name" autoComplete="off"
                onChange={(e) => { setAssignOtherCwid(e.target.value); setAssignErr(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); assignOtherGo(); } }}
                style={{ flex: 1, minWidth: 0, height: 30, boxSizing: "border-box", padding: "0 9px", border: "1px solid var(--pm-border-strong)", borderRadius: 6, font: "inherit", fontSize: 13, background: "#fff", color: "var(--pm-foreground)", outline: "none" }} />
              <Button variant="secondary" size="sm" disabled={!assignOtherCwid.trim() || !!assignLookupCwid}
                onClick={assignOtherGo} sx={{ height: 30 }}>
                Go
              </Button>
            </div>
            {assignErr && (
              <span role="alert" style={{ padding: "0 14px 10px", fontSize: 12.5, color: "var(--pm-red)", background: "var(--pm-surface-2)", borderRadius: "0 0 10px 10px" }}>
                {assignErr}
              </span>
            )}
          </>
        ) : (() => {
          const everyRow = [...assignConfirm.onCandidate, ...assignConfirm.offCandidate];
          const n = everyRow.length;
          const pv = assignPreview(everyRow, rowCandidateLites, assignConfirm.cwid);
          const external = everyRow.some((r) => isExternalSource(r));
          return (
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>
                Assign to {assignConfirm.name ? `${assignConfirm.name} ` : ""}
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 400, color: "var(--pm-muted-foreground)" }}>{assignConfirm.cwid}</span>?
              </span>
              {!assignConfirm.hasIdentity ? (
                <span style={{ fontSize: 12.5, color: "var(--pm-amber)", lineHeight: 1.45 }}>
                  {assignConfirm.cwid} has no ReCiter identity. Assigning records your decision on each row only;
                  nothing is added to a publication record, because there is no identity to add it to.
                </span>
              ) : !assignConfirm.name ? (
                <span style={{ fontSize: 12.5, color: "var(--pm-amber)", lineHeight: 1.45 }}>
                  No name on file anywhere for {assignConfirm.cwid}. Check the identifier.
                </span>
              ) : null}
              <div style={{ display: "flex", flexDirection: "column", border: "1px solid var(--pm-border)", borderRadius: 8, overflow: "auto", maxHeight: 300 }}>
                {pv.items.map((x, i) => (
                  <div key={x.row.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center", padding: "7px 10px", borderTop: i ? "1px solid var(--pm-border)" : 0, fontSize: 12.5, background: "#fff" }}>
                    <span style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <span style={{ fontWeight: 500 }}>{x.row.wcm_author || "—"}</span>
                      <span style={{ color: "var(--pm-muted-foreground)" }}> · {stripHtml(x.row.title || "")}</span>
                    </span>
                    {x.onCandidate && x.band
                      ? <BandPill band={x.band}>IO {Math.floor(x.io as number)} · {x.band}</BandPill>
                      : <BandPill band={null}>{x.onCandidate ? "No IO score" : "Not a candidate"}</BandPill>}
                  </div>
                ))}
              </div>
              <span style={{ fontSize: 12.5, color: "var(--pm-muted-foreground)", lineHeight: 1.45 }}>{pv.note}</span>
              <span style={{ fontSize: 11.5, color: "var(--pm-muted-foreground)", lineHeight: 1.45 }}>
                Each row also records “not mine” for its other candidates who have a ReCiter identity, as a
                single assign does; reopening a row undoes both.
                {external && " Scopus and OpenAlex rows carry no PMID, so their other candidates are left untouched."}
              </span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {pv.safe.length > 0 && pv.safe.length < n && (
                  <Button variant="primary" size="sm" onClick={() => doBulkAssign(true)}>
                    Assign the {pv.safe.length.toLocaleString()} high-confidence only
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => doBulkAssign(false)}>
                  Assign all {n.toLocaleString()}
                </Button>
                <button type="button" onClick={() => setAssignConfirm(null)}
                  style={{ border: 0, background: "none", padding: "0 6px", font: "inherit", fontSize: 12.5, color: "var(--pm-muted-foreground)", cursor: "pointer" }}>
                  Back
                </button>
              </div>
            </div>
          );
        })()}
      </Popover>

      {/* T-950: bulk-reject confirm — same overlay pattern as assignConfirm, but no lookup
          step in front of it: reject never targets a typed cwid, so the dialog only needs to
          say what each shape of selected row will do, in the per-row actions' own words
          ("not mine" / "Reject all" / the no-identity pill's own framing). */}
      {rejectConfirmOpen && selectedRows.length > 0 && (
        <div onClick={() => setRejectConfirmOpen(false)} style={{
          position: "fixed", inset: 0, background: "rgba(15,23,42,.35)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1400,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "#fff", borderRadius: 10, padding: 20, maxWidth: 460,
            boxShadow: "0 8px 32px rgba(15,23,42,.25)",
          }}>
            {(() => {
              const n = selectedRows.length;
              // scopus excluded for the same reason as noIdentityCount below: its reject is row-only
              // (no GoldStandard write), so the "records not mine for every candidate" sentence is
              // false for it. Scopus rows are counted by scopusCount, which has its own sentence.
              const multiCount = selectedRows.filter((r) => !r.single_candidate && !isExternalSource(r)).length;
              // scopus excluded: its reject is row-only (no GoldStandard write), so the amber sentence below would be false for it
              const noIdentityCount = selectedRows.filter((r) => r.single_candidate && r.identity_in_reciter === false && !isExternalSource(r)).length;
              const scopusCount = selectedRows.filter((r) => isExternalSource(r)).length;
              return (
                <>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
                    Reject {n} selected row{n === 1 ? "" : "s"}?
                  </div>
                  <div style={{ fontSize: 12.5, color: "#475569", marginBottom: 10, lineHeight: 1.45 }}>
                    Each row records “not mine” for its proposed person and leaves the queue.
                  </div>
                  {multiCount > 0 && (
                    <div style={{ fontSize: 12.5, color: "#475569", marginBottom: 10, lineHeight: 1.45 }}>
                      {multiCount} of them have several candidates — those record “not mine” for every
                      candidate, the same as the per-row “Reject all”.
                    </div>
                  )}
                  {noIdentityCount > 0 && (
                    <div style={{ fontSize: 12.5, color: "var(--pm-amber)", marginBottom: 10, lineHeight: 1.45 }}>
                      {noIdentityCount} propose someone with no ReCiter identity. The rejection is still
                      written against that identifier and applies to their profile once ReCiter has an
                      identity for them.
                    </div>
                  )}
                  {scopusCount > 0 && (
                    <div style={{ fontSize: 12.5, color: "#475569", marginBottom: 10, lineHeight: 1.45 }}>
                      {scopusCount} Scopus/OpenAlex row{scopusCount === 1 ? "" : "s"} close here only — nothing is
                      written to ReCiter (no PMID).
                    </div>
                  )}
                  <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 14, lineHeight: 1.45 }}>
                    Reopening a row undoes it.
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button style={btn("ghost")} onClick={() => setRejectConfirmOpen(false)}>Cancel</button>
                    <button style={btn("reject")} onClick={() => doBulkReject(selectedRows)}>
                      Reject {n}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* A canned report takes over the list area. The feed keeps fetching underneath — one
          cheap list request per filter change — so returning to it is instant and lands the
          curator back on the same page of the same queue, with no refetch and no scroll jump.
          It also keeps `rows`, `count` and the pagination honest the whole time, rather than
          leaving them describing a filter state that has since moved on. */}
      {reportView && (
        <CannedReportPanel
          view={reportView}
          response={reportData}
          loading={reportLoading}
          error={reportError}
          expanded={expandedPeople}
          onToggle={toggleReportPerson}
          onClose={() => selectReport(null)}
        />
      )}

      {/* the row's ⋯ menu (prototype markup ~1092-1099): evidence toggle, Assign to someone
          else…, Snooze, Dismiss, each with its shortcut. Reject (Reject all on a
          multi-candidate row) is the row's own ✕ now, and "Show N others like this" is the link
          under the identity, so neither is repeated here. "Assign to someone else…" is a
          SHORTCUT, not a new control (#937): it opens the row and focuses the typed-cwid input
          <AssignOther> already renders. */}
      <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ style: { ...popoverPaper, width: 210 } }}
        MenuListProps={{ dense: true, sx: { p: "6px", "& .MuiMenuItem-root": { fontSize: 13, minHeight: 0, p: "8px 10px", borderRadius: "6px", color: "var(--pm-foreground)", gap: 1 }, "& .MuiMenuItem-root:hover, & .MuiMenuItem-root.Mui-focusVisible": { bgcolor: "var(--pm-surface-2)" } } }}>
        {menu && (
          <MenuItem onClick={() => { const { id } = menu.row; setMenu(null); setExpanded((x) => (x === id ? null : id)); }}>
            {expanded === menu.row.id ? "Hide evidence" : "Show evidence"}<MenuKey k="E" />
          </MenuItem>
        )}
        {menu && (
          <MenuItem onClick={() => {
            const { id, wcm_author } = menu.row;
            setMenu(null);
            focusAssignOther(id, wcm_author);
          }}>
            Assign to someone else…
          </MenuItem>
        )}
        <MenuItem onClick={() => menu && doAction(menu.row, "snooze")}>Snooze 90 days<MenuKey k="S" /></MenuItem>
        <MenuItem onClick={() => menu && doAction(menu.row, "dismiss")}>Dismiss</MenuItem>
      </Menu>


      {/* recent duplicate-conflicts history — each entry's real prompt lives inline on its own
          card (see ConflictEntry); this is read-only look-back plus a jump-to-card shortcut for
          one the curator has scrolled past. ponytail: a Menu list, not a dedicated modal —
          swap in one if this needs richer layout than a plain list. */}
      <Menu anchorEl={historyAnchor} open={!!historyAnchor} onClose={() => setHistoryAnchor(null)}
        PaperProps={{ style: { maxWidth: 420, maxHeight: 420 } }}>
        {conflictLog.length === 0 && <MenuItem disabled>No conflicts this session</MenuItem>}
        {conflictLog.map((entry) => {
          const stillActive = !!conflicts[entry.id];
          return (
            <MenuItem key={`${entry.id}-${entry.ts}`} dense style={{ whiteSpace: "normal", display: "block", padding: "8px 14px" }}
              onClick={() => {
                setHistoryAnchor(null);
                cardRefs.current[entry.id]?.scrollIntoView({ block: "center" });
                setFocusedId(entry.id);
              }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, fontWeight: 600, color: "#0f172a" }}>
                <span>{entry.wcm_author || entry.top_name || "—"}</span>
                <span style={{ color: stillActive ? "var(--pm-amber)" : "#94a3b8", fontWeight: 500 }}>
                  {stillActive ? "unresolved" : "resolved/cleared"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{curatorConflictMessage(entry.message)}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                {new Date(entry.ts).toLocaleTimeString()}
              </div>
            </MenuItem>
          );
        })}
      </Menu>

      {/* server-backed "Recent activity" (prototype markup ~754-764) — the 15 most-recently-
          resolved authorships across the whole queue (global, cross-curator, cross-session; see
          authorshipRecentActivity). Read-only lookback with Undo: resolved rows have no view left
          to jump to, so entries are not clickable. */}
      <Popover open={!!activityAnchor} anchorEl={activityAnchor} onClose={() => setActivityAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ style: { ...popoverPaper, width: 400, maxHeight: 440, overflow: "auto", display: "flex", flexDirection: "column" } }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--pm-border)", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pm-foreground)" }}>Recent activity</span>
          <span style={{ fontSize: 12, color: "var(--pm-muted-foreground)" }}>All curators</span>
        </div>
        {recentActivity.length === 0 && (
          <div style={{ padding: "24px 14px", textAlign: "center", fontSize: 13, color: "var(--pm-muted-foreground)" }}>No recent activity</div>
        )}
        {recentActivity.map((entry) => {
          const verb = STATUS_LABEL[entry.status || ""] || entry.status || "Resolved";
          const label = entry.title
            || (isExternalSource(entry) && entry.external_id ? `${entry.source === "openalex" ? "OpenAlex" : "Scopus"} ${entry.external_id}` : entry.pmid ? `PMID ${entry.pmid}` : "Untitled");
          // subject of the authorship — resolution_cwid is the identity actually resolved onto
          // (set for accept/assign; reject/dismiss never set it, so top_cwid is always the right
          // fallback there). The name has to follow the same per-row choice: top_name is the
          // *top candidate's* name, so on an assign-to-a-non-top-candidate row it would sit
          // next to a different person's cwid — on the one panel a curator uses to catch their
          // own mistakes, with Undo one click away (#928). Fall back to top_name only when it
          // provably describes the same cwid; otherwise show no name rather than a wrong one.
          const subjectCwid = entry.resolution_cwid || entry.top_cwid;
          const subjectName = entry.resolution_cwid
            ? (entry.resolution_name || (entry.resolution_cwid === entry.top_cwid ? entry.top_name : undefined))
            : entry.top_name;
          return (
            <div key={entry.id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--pm-border)", display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ fontSize: 13, lineHeight: 1.4, color: "var(--pm-foreground)" }}>
                <strong style={{ fontWeight: 600, color: /Rejected|Dismissed/.test(verb) ? "var(--pm-red)" : "var(--pm-foreground)" }}>{verb}</strong> · {label}
              </div>
              {(subjectName || subjectCwid) && (
                <div style={{ fontSize: 12.5, color: "var(--pm-muted-foreground)" }}>
                  {subjectName || "—"}{" "}
                  {subjectCwid && (
                    <a href={`/curate/${subjectCwid}`} target="_blank" rel="noreferrer" style={{ color: "var(--pm-slate)", textDecoration: "none" }}>
                      {subjectCwid}
                    </a>
                  )}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--pm-muted-foreground)" }}>
                <span>{entry.reviewer || "—"} · {formatActivityDate(entry.resolved_at)}</span>
                <button type="button" onClick={() => undoRecentActivity(entry)}
                  style={{ font: "inherit", marginLeft: "auto", border: 0, background: "none", padding: 0, fontSize: 12, fontWeight: 600, color: "var(--pm-slate)", cursor: "pointer" }}>
                  Undo
                </button>
              </div>
            </div>
          );
        })}
      </Popover>
    </div>
  );
};

// ---- the single control row's palette and its recurring shapes -----------------------------
// Colour values transcribed from the mockup (HANDOFF §2.2-§2.5). Held together rather than
// inlined per element because the control row, the two dropdown popovers, the Filters popover
// and the chip row all draw from the same handful of tokens, and a border that drifts between
// them is exactly what makes a "one row" band read as three.
//
// `font: "inherit"` LEADS every shape helper below, and must keep leading. It is the `font`
// SHORTHAND, so it resets font-size along with family/weight/line-height — written after a
// `fontSize`, as most of these were, it silently threw the declared size away and the control
// rendered at the inherited 14px instead of the 12-13.5px §2.2-§2.5 specify. Ordered first, the
// shorthand supplies family and line-height and each object's own fontSize survives. React
// writes inline styles in object-key order, so the order here IS the cascade.
const CTRL = {
  border: "#ddd8d0",       // resting control border
  rule: "#eae6df",         // the hairline between bands
  track: "#f4f2ef",        // segment-control track
  ink: "#1b2432",
  muted: "#6b7484",
  soft: "#6f7889",
  accent: "var(--pm-slate)",       // active border / primary button
  accentBg: "var(--pm-slate-tint)",     // active row + open-popover button fill
  accentInk: "var(--pm-slate)",
  band: "#fbfaf8",         // chip row + the "i" strip
  chipBorder: "var(--pm-slate-tint-border)",
};

// §2.1's three header-band buttons (mockup:76-81). One shape, three palettes: red for identity
// conflicts, amber for duplicate records, plain for Activity and the session conflict log.
const alertPill = (kind: "red" | "amber" | "plain"): CSSProperties => ({
  font: "inherit",
  display: "inline-flex", alignItems: "center", gap: 7, height: 32, boxSizing: "border-box", borderRadius: 6, padding: "0 12px",
  fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap",
  border: `1px solid ${kind === "red" ? "var(--pm-red-tint-border)" : kind === "amber" ? "var(--pm-amber-tint-border)" : "var(--pm-border-strong)"}`,
  background: kind === "red" ? "var(--pm-red-tint)" : kind === "amber" ? "var(--pm-amber-tint)" : "#fff",
  color: kind === "red" ? "var(--pm-red)" : kind === "amber" ? "var(--pm-amber)" : "var(--pm-foreground)",
});

// The sort Select (UI system). Labels and order as in the prototype; values are the server's.
const SORT_OPTIONS = [
  { value: "io", label: "Highest Identity-Only Score" },
  { value: "date", label: "Newest" },
  { value: "date_asc", label: "Oldest" },
  { value: "precision", label: "Best match" },
  { value: "confidence", label: "Match confidence" },
  { value: "fg", label: "Authorship Score" },
  { value: "candidates", label: "Most candidates" },
];
// The prototype's sort list marks the current option with a check rather than a fill.
const SORT_MENU_SX = {
  py: 0.5,
  "& .MuiMenuItem-root": { fontSize: 13.5, minHeight: 0, py: 0.75, mx: 0.5, borderRadius: "6px", gap: 1.5 },
  "& .MuiMenuItem-root.Mui-selected, & .MuiMenuItem-root.Mui-selected:hover": { bgcolor: "var(--pm-surface-2)" },
  "& .MuiMenuItem-root.Mui-selected::after": { content: '"✓"', ml: "auto", color: "var(--pm-muted-foreground)" },
};
// The sort Select's chevron: the thin stroked one the chips use, not MUI's solid triangle. MUI
// hands it the className that positions it (MuiSelect-icon) and the open-state rotation.
const SortChevron = ({ className }: { className?: string }) => (
  <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
    style={{ position: "absolute", pointerEvents: "none" }}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const HIDE_LABEL: Record<string, string> = { noSuggestion: "No suggested identity", noIdentity: "No ReCiter identity" };
const chipEmptyStyle: CSSProperties = { fontSize: 13, color: "var(--pm-muted-foreground)", padding: "8px 10px" };
const dateInputStyle: CSSProperties = {
  font: "inherit", height: 32, boxSizing: "border-box", padding: "0 8px", border: "1px solid var(--pm-border-strong)",
  borderRadius: 6, fontSize: 12.5, background: "#fff", color: "var(--pm-foreground)",
};
const fmtCount = (n?: number | null): string => (n == null ? "" : n.toLocaleString());
const instLabel = (k: string): string => INSTITUTION_LABELS[k] || k;

// source segment (prototype markup ~815): 28px tabs, 13px/500 in ink whether active or not;
// the active one is white with a 1px shadow, not a border.
const segBtn = (active: boolean): CSSProperties => ({
  font: "inherit",
  display: "inline-flex", alignItems: "center", gap: 6,
  height: 28, border: "none", cursor: "pointer", borderRadius: 6, padding: "0 12px", fontSize: 13,
  fontWeight: 500, whiteSpace: "nowrap", color: "var(--pm-foreground)",
  background: active ? "#fff" : "transparent",
  boxShadow: active ? "0 1px 2px rgba(34,30,28,0.08)" : "none",
});
const segCount: CSSProperties = {
  fontSize: 11.5, color: "var(--pm-muted-foreground)", fontVariantNumeric: "tabular-nums",
};

// ---- the canned report panel ---------------------------------------------
// It replaces the card list rather than sitting beside it, and it is GROUPED BY PERSON rather
// than being a flat table: ~1,065 rows across 816 people means a flat list is mostly one-row
// groups, and the people carrying several rows — the ones actually worth a curator's time — are
// invisible in it. Groups are collapsed by default with their count on the header, because 816
// of them expanded is not a report, it is a wall.
const reportNoticeStyle: CSSProperties = { padding: 24, textAlign: "center", color: "#94a3b8" };
const reportGroupStyle: CSSProperties = {
  background: "#fff", border: `1px solid ${CTRL.border}`, borderRadius: 8, marginBottom: 8,
};

interface ReportGroup { cwid: string; person: string; groupCount: number; rows: ReportRow[] }
// Walk the server's order; never regroup into a map and never re-sort. The rows arrive already
// ordered (groupCount DESC, then the person's worst score, then cwid, and within a person by
// score — ascending for accepts, descending for rejects), so any client-side ordering could only
// disagree with it. A cwid appearing in two non-adjacent runs therefore renders as two groups:
// the honest rendering of what arrived, and a visible sign the server's ordering has changed.
const groupReportRows = (rows: ReportRow[]): ReportGroup[] => {
  const out: ReportGroup[] = [];
  for (const r of rows) {
    const current = out.length > 0 ? out[out.length - 1] : null;
    if (current && current.cwid === r.cwid) current.rows.push(r);
    else out.push({ cwid: r.cwid, person: r.person, groupCount: r.groupCount, rows: [r] });
  }
  return out;
};

// The four feedback evidence channels, surfaced per article in the expanded detail because they
// ARE the explanation: 75% of the low-scoring accepts have all four non-positive, which is the
// burial mechanism itself. Seeing that inline is what turns this from a list into an argument.
const FEEDBACK_CHANNELS: Array<{ key: "fbInstitution" | "fbJournal" | "fbOrganization" | "fbCoAuthor"; label: string }> = [
  { key: "fbInstitution", label: "Institution" },
  { key: "fbJournal", label: "Journal" },
  { key: "fbOrganization", label: "Organization" },
  { key: "fbCoAuthor", label: "Co-author" },
];

const ReportArticleRow = ({ row, view }: { row: ReportRow; view: ReportKey }) => {
  const channels = FEEDBACK_CHANNELS.map((c) => ({ ...c, value: row[c.key] }));
  // "All four non-positive" needs all four to be KNOWN and non-positive. A null channel is
  // "person_article never recorded this one", not a zero, and claiming the pattern off a missing
  // value would put the report's own headline explanation on evidence that isn't there.
  const allNonPositive = channels.every((c) => c.value != null && c.value <= 0);
  return (
    <div style={{ padding: "10px 14px 12px 36px", borderTop: `1px solid ${CTRL.rule}` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", fontSize: 12.5, color: "#94a3b8" }}>
        <Tip title="ReCiter's authorship likelihood score for this article on this person (0-100) — the model's half of the disagreement." placement="top" arrow>
          <span style={{ color: ioColor(row.score ?? undefined), fontWeight: 700, fontSize: 14, fontVariantNumeric: "tabular-nums", cursor: "help", minWidth: 34 }}>
            {fmtScore(row.score ?? undefined)}
          </span>
        </Tip>
        {row.pmid != null ? <PmidCite pmid={row.pmid} /> : <span>No PMID</span>}
        {row.pubDate && <span style={{ fontVariantNumeric: "tabular-nums" }}>{row.pubDate}</span>}
        {row.journal && <i><span dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(row.journal) }} /></i>}
      </div>
      <div style={{ fontSize: 13, color: "#334155", marginTop: 3, ...clampStyle(2) }} title={stripHtml(row.title || "")}>
        {row.title ? <span dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(row.title) }} /> : "—"}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
        {channels.map((c) => (
          <Chip key={c.key} kind={c.value == null ? "neutral" : c.value > 0 ? "ok" : "warn"} style={{ fontSize: 11 }}>
            {c.label} {fmtScore(c.value ?? undefined)}
          </Chip>
        ))}
        {allNonPositive && (
          <Tip placement="top" arrow
            title={view === "lowScoringAccepts"
              ? "Nothing in this person's feedback history pulls the paper up: institution, journal, organization and co-author evidence are all non-positive. 75% of the accepts in this report look like this — it is the burial mechanism, not a coincidence."
              : "Institution, journal, organization and co-author evidence are all non-positive, yet the model still scored this 90 or above — the identity signal carried it on its own."}>
            <span style={{ fontSize: 12, color: "var(--pm-amber)", cursor: "help" }}>All four non-positive</span>
          </Tip>
        )}
      </div>
    </div>
  );
};

const ReportPersonGroup = ({ group, view, open, onToggle }: {
  group: ReportGroup; view: ReportKey; open: boolean; onToggle: () => void;
}) => {
  const shown = group.rows.length;
  return (
    <div style={reportGroupStyle}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 9, padding: "10px 14px", flexWrap: "wrap" }}>
        <button type="button" onClick={onToggle} aria-expanded={open}
          style={{ font: "inherit", display: "inline-flex", alignItems: "center", gap: 7, border: "none", background: "none", padding: 0, cursor: "pointer", color: CTRL.ink, fontSize: 14, fontWeight: 600, textAlign: "left" }}>
          {open ? <IconChevD size={14} /> : <IconChevR size={14} />}
          {group.person || "—"}
        </button>
        {/* The curate link belongs to the PERSON, not to each article beneath: /curate/[id]
            takes a uid and nothing else today, so there is no way to deep-link the PMID a
            curator is looking at. Teaching that page to accept a pmid (scroll to it, or filter
            to it) is the natural follow-up — until then, one link per person is the honest
            affordance, and it is the only action this whole report offers, because the articles
            in it are already curated. Sibling of the toggle rather than nested inside it: an
            <a> inside a <button> is invalid, and both need to stay independently clickable. */}
        <a href={`/curate/${group.cwid}`} target="_blank" rel="noreferrer"
          title={`Open ${group.person || group.cwid}'s curate page`}
          style={{ color: "var(--pm-slate)", textDecoration: "none", fontSize: 13 }}>{group.cwid}</a>
        {/* The count stays visible while collapsed — it is the whole reason to group. groupCount
            is the person's own total in this report; when the row cap has cut into their tail,
            say how many actually arrived rather than let the header overpromise. */}
        <span style={{ marginLeft: "auto", fontSize: 13, color: CTRL.soft, fontVariantNumeric: "tabular-nums" }}>
          {group.groupCount.toLocaleString()} article{group.groupCount === 1 ? "" : "s"}
          {shown < group.groupCount ? ` · ${shown.toLocaleString()} shown` : ""}
        </span>
      </div>
      {open && (
        <div>
          {group.rows.map((r, i) => (
            <ReportArticleRow key={`${r.pmid ?? "nopmid"}-${i}`} row={r} view={view} />
          ))}
        </div>
      )}
    </div>
  );
};

const CannedReportPanel = ({ view, response, loading, error, expanded, onToggle, onClose }: {
  view: ReportKey;
  response: ReportResponse | null;
  loading: boolean;
  error: string;
  expanded: Set<string>;
  onToggle: (cwid: string) => void;
  onClose: () => void;
}) => (
  // The prototype's report card: a grey header band naming the report, with "Close report" as
  // the way back to the feed (the Reports menu now lists only the two reports).
  <div style={{ background: "var(--pm-surface)", border: "1px solid var(--pm-border)", borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 16px", borderBottom: "1px solid var(--pm-border)", background: "var(--pm-surface-2)", borderRadius: "var(--radius-card) var(--radius-card) 0 0" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 320px", minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pm-foreground)" }}>{REPORT_LABEL[view]}</span>
        <span style={{ fontSize: 12.5, color: "var(--pm-muted-foreground)" }}>
          {REPORT_OPTIONS.find((r) => r.key === view)?.note} · grouped by person
        </span>
      </div>
      <Button variant="ghost" size="sm" onClick={onClose}>Close report</Button>
    </div>
    <div style={{ padding: "12px 16px" }}>
      <CannedReportBody view={view} response={response} loading={loading} error={error} expanded={expanded} onToggle={onToggle} />
    </div>
  </div>
);

const CannedReportBody = ({ view, response, loading, error, expanded, onToggle }: {
  view: ReportKey;
  response: ReportResponse | null;
  loading: boolean;
  error: string;
  expanded: Set<string>;
  onToggle: (cwid: string) => void;
}) => {
  // Loading and empty are handled the way the card queue handles them (same padding, same
  // muted grey, same one-line copy), so switching between the two views does not feel like
  // arriving at a different page. A failed load says so here rather than in the error Snackbar:
  // it is a persistent state of the thing on screen, not a notice that should time out.
  if (loading) return <div style={reportNoticeStyle}>Loading…</div>;
  if (error) return <div style={{ ...reportNoticeStyle, color: "var(--pm-red)" }}>Couldn’t load this report — {error}</div>;
  if (!response) return null;
  const groups = groupReportRows(response.rows);
  if (groups.length === 0) return <div style={reportNoticeStyle}>No rows in this report match these filters.</div>;
  return (
    <div>
      {/* The report's own count line, replacing the bulk bar's "Showing N of M" — that one
          describes the feed, which is hidden while this is up. The number in the reports menu
          (summary.reports) is filter-scoped the same way, sharing the server's one filter
          helper, so the two agree by construction with exactly one exception: a capped response
          returns fewer rows than the population it was counted from. Hence `total` here is
          "rows on screen", and `capped` says when that is less than the menu's number. */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 10, fontSize: 13.5, color: CTRL.muted }}>
        <strong style={{ color: CTRL.ink, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {response.total.toLocaleString()}
        </strong>
        {response.total === 1 ? "row" : "rows"} across {response.people.toLocaleString()}{" "}
        {response.people === 1 ? "person" : "people"} · {REPORT_LABEL[view].toLowerCase()}
      </div>
      {/* Never truncate silently. A capped report is a different claim from a complete one, and
          a curator working down it needs to know the tail exists. */}
      {response.capped && (
        <div style={{ border: "1px solid var(--pm-amber-tint-border)", background: "var(--pm-amber-tint)", color: "var(--pm-amber)", borderRadius: 6, padding: "9px 12px", fontSize: 13, lineHeight: 1.5, marginBottom: 10 }}>
          This report hit the server’s row cap — the {response.total.toLocaleString()} rows below are
          the top of the list, not all of it. Narrow the date window, the person type or the
          institution to see the rest.
        </div>
      )}
      {groups.map((g, i) => (
        // Index in the key because a cwid can legitimately appear in two runs (see
        // groupReportRows); the two would otherwise collide on the same React key.
        <ReportPersonGroup key={`${g.cwid}-${i}`} group={g} view={view}
          open={expanded.has(g.cwid)} onToggle={() => onToggle(g.cwid)} />
      ))}
    </div>
  );
};

// ---- card ----------------------------------------------------------------
// ---- the table row (prototype markup ~957-1114) --------------------------------------------
// Column widths shared by the header row and every row: checkbox | IO | author → identity |
// article | actions (104px, set on the cell itself).
const ROW_GRID = "20px 40px minmax(0,1.05fr) minmax(0,1.6fr) auto";
const IO_TONES: Record<"slate" | "amber" | "red" | "muted", { bg: string; fg: string; bd: string }> = {
  slate: { bg: "var(--pm-slate-tint)", fg: "var(--pm-slate)", bd: "var(--pm-slate-tint-border)" },
  amber: { bg: "var(--pm-amber-tint)", fg: "var(--pm-amber)", bd: "var(--pm-amber-tint-border)" },
  red: { bg: "var(--pm-red-tint)", fg: "var(--pm-red)", bd: "var(--pm-red-tint-border)" },
  muted: { bg: "var(--pm-surface-2)", fg: "var(--pm-muted-foreground)", bd: "var(--pm-border)" },
};
// The bulk-assign popover's confidence pill ("2 High", "IO 98 · High", "Not a candidate"):
// the IO badge's tones, High slate, Medium amber, Low red, none muted.
const BandPill = ({ band, children }: { band: "High" | "Medium" | "Low" | null; children: ReactNode }) => {
  const t = IO_TONES[band === "High" ? "slate" : band === "Medium" ? "amber" : band === "Low" ? "red" : "muted"];
  return (
    <span style={{ height: 20, padding: "0 7px", display: "inline-flex", alignItems: "center", borderRadius: 999, fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap", background: t.bg, color: t.fg, border: `1px solid ${t.bd}` }}>
      {children}
    </span>
  );
};
// A shortcut key at the right end of a menu item.
const MenuKey = ({ k }: { k: string }) => (
  <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--pm-muted-foreground)" }}>{k}</span>
);
// Previous / Next in the table footer: the UI system's outline button at its xs size.
const pagerBtn = (disabled: boolean): CSSProperties => ({
  height: 26, padding: "0 10px", borderRadius: 6, border: "1px solid var(--pm-border-strong)", background: "#fff",
  font: "inherit", fontSize: 12.5, fontWeight: 500, color: "var(--pm-foreground)",
  cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1,
});
// The row's 30px icon buttons. Hover fills come from .pm-arow-* in globals.css.
const rowActBtn = (kind: "accept" | "reject" | "more", disabled?: boolean): CSSProperties => ({
  width: 30, height: 30, borderRadius: 6, display: "grid", placeItems: "center", padding: 0, flexShrink: 0,
  cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1,
  ...(kind === "accept" ? { border: "1px solid var(--pm-slate-tint-border)", background: "var(--pm-slate-tint)", color: "var(--pm-slate)" }
    : kind === "reject" ? { border: "1px solid var(--pm-red-tint-border)", background: "var(--pm-red-tint)", color: "var(--pm-red)" }
      : { border: "1px solid transparent", background: "none", color: "var(--pm-muted-foreground)" }),
});

interface CardProps {
  row: AuthorshipRow;
  statusView: "open" | "snoozed" | "dismissed";
  // isBulkSelectable(row, the REAL statusView) — see the call site. Never derived from the
  // `statusView` above, which the duplicates/conflicts queues deliberately substitute.
  selectable: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  isFocused: boolean;
  acting: boolean;
  pickedCwid?: string;
  assignPrefill?: string; // seeds AssignOther's box — set only for the row that asked
  registerRef: (el: HTMLElement | null) => void;
  onFocus: () => void;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
  onPick: (cwid: string) => void;
  onAction: (action: string, extra?: Record<string, any>) => void;
  onMenu: (anchor: HTMLElement) => void;
  onAssignOther: () => void;
  onNarrowPmid: () => void;
  onFindOthers: () => void;
  // §2.6 identity hover card. undefined = not fetched yet (or in flight); the parent owns the
  // per-cwid cache, so a card never re-requests what another card already asked for.
  // Keyed by cwid, not pre-narrowed to the row's top_cwid: a multi-candidate row needs a
  // dossier for each of its five candidates, not just the one the matcher ranked first.
  // undefined for a cwid = not fetched yet (or in flight).
  priorNamesByCwid: Record<string, PriorNames>;
  onHoverIdentity: (cwid?: string | null) => void;
  conflict?: ConflictEntry;
  onClearConflict: () => void;
  // PR 6: the row is shown in the Identity-conflicts queue — a red "!" badge, one sub-row per
  // identity with its own Keep, and no ✓ / ✕ / ⋯.
  conflictQueue?: boolean;
}

const AuthorshipCard = ({
  row: r, statusView, selectable, isExpanded, isSelected, isFocused, acting, pickedCwid, assignPrefill,
  registerRef, onFocus, onToggleExpand, onToggleSelect, onPick, onAction, onMenu, onAssignOther, onNarrowPmid,
  onFindOthers, priorNamesByCwid, onHoverIdentity,
  conflict, onClearConflict, conflictQueue = false,
}: CardProps) => {
  // Matches the server accept gate (`!row.single_candidate`) and the sibling gates below
  // (toggleSelect, nearCertain, eligibleRows) — the n_candidates>1 clause let a card keep
  // showing Accept on a row the server would 409 (stale n_candidates, single_candidate
  // already flipped), landing the curator on the generic "nothing was saved" toast.
  const isMulti = !r.single_candidate;
  const noIdentity = r.identity_in_reciter === false;
  const alreadyRejected = r.top_already_rejected === true;
  // #1012: ED retired the proposed cwid after the producer baked it. Kept beside the two flags
  // above because it is the same KIND of fact — "there is a person here, but this authorship
  // cannot be accepted onto them" — and it takes precedence over both in the branch below.
  const topRetired = r.top_retired_cwid === true;
  // #938 — ReCiterDB#177 nulls the producer's candidate columns (top_cwid included) on rows
  // the merged matcher no longer matches to anyone; gated on top_cwid itself, not on the
  // identity lookup above, which is vacuously true (`!r.top_cwid || …`) and so never fires here.
  const noSuggestion = !r.top_cwid;
  const isAbsent = r.top_io_score == null;
  const wcm = hasWcm(r.author_affiliation);
  const candidates = isMulti ? parseCandidates(r.candidate_cwids_json) : [];
  // "choose among 0 WCM homonyms" — a multi row the producer left empty; its expand is a lookup
  const nothingToPick = isMulti && candidates.length === 0;
  // top_name is the lead's label and carries no name_source of its own; the lead's own entry in
  // candidate_cwids_json does (a single-candidate row's JSON holds exactly that one entry).
  const topCand = isMulti ? undefined : parseCandidates(r.candidate_cwids_json)
    .find((c) => String(c.cwid || "").toLowerCase() === String(r.top_cwid || "").toLowerCase());
  // T4: `selectable` is the same predicate toggleSelect gates on — multi-candidate rows are now
  // checkbox-selectable too (open, non-scopus, bulk-assign only; see isBulkSelectable/
  // isMultiAssignEligible). It arrives as a prop, computed by the page from the real statusView.
  // T5: server-computed sibling count for "Show N others like this" (see like_count on
  // AuthorshipRow) — 0/undefined both mean "nobody else, hide the button".
  const likeCount = r.like_count ?? 0;
  // §2.6 identity hover card. Two things keep this from firing a request per mouse-over
  // jitter: the parent's per-cwid cache (one request per person, ever), and this hover-intent
  // delay, so a pointer travelling down the page over five names asks for none of them. The
  // timer is cleared on leave AND on unmount — a card removed by an accept mid-hover would
  // otherwise open a popup on a node that no longer exists.
  // One hover card at a time per row, so a cwid rather than a flag: the suggested identity's
  // name and each candidate radio on a multi row share it.
  const [hoverCwid, setHoverCwid] = useState<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelHover = () => { if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; } };
  useEffect(() => cancelHover, []);
  const openHover = (cwid?: string | null) => {
    cancelHover();
    if (!cwid) return;
    hoverTimer.current = setTimeout(() => { setHoverCwid(cwid); onHoverIdentity(cwid); }, 220);
  };
  const closeHover = () => { cancelHover(); setHoverCwid(null); };
  // The candidates in the order the row lists them; retired CWIDs left out (the opened row says
  // why). A pick that is no longer among them doesn't count.
  const ranked = isMulti ? rankCandidates(candidates) : [];
  const pick = ranked.find((c) => c.cwid === pickedCwid);
  const acceptedByCwids = new Set((r.accepted_by || []).map((a) => String(a.cwid || "").toLowerCase()));

  // One table row (prototype markup ~963-1114): checkbox | IO | author → identity | article |
  // actions, separated by hairlines. The focused row gets a 3px slate spine and the surface-2
  // fill. Hover still moves focus (onMouseEnter), so the keyboard acts on the row under the
  // pointer, as before.
  const rowStyle: CSSProperties = {
    borderBottom: "1px solid var(--pm-border)",
    borderLeft: `3px solid ${isFocused ? "var(--pm-slate)" : "transparent"}`,
    background: isFocused ? "var(--pm-surface-2)" : "transparent",
    cursor: "pointer",
    outline: "none",
    scrollMarginTop: "calc(var(--header-height, 52px) + 12px)", // see the expand-anchoring effect
  };
  const badge = conflictQueue ? { text: "!", tone: "red" as const, band: null } : ioBadge(r);
  const badgeTone = IO_TONES[badge.tone];
  const badgeTitle = conflictQueue ? "Identity conflict" : !r.top_cwid ? "No suggested identity"
    : isMulti ? `Best of ${r.n_candidates ?? candidates.length} candidates · Identity-Only Score ${fmtScore(r.top_io_score)}`
      : isAbsent ? (isExternalSource(r) ? `Not in PubMed, so there is no Identity-Only Score · match confidence ${confBand(r.top_confidence)}`
        : `Never retrieved by ReCiter, so there is no Identity-Only Score · match confidence ${confBand(r.top_confidence)}`)
        : `Identity-Only Score ${fmtScore(r.top_io_score)} · ${badge.band} confidence${statusView !== "dismissed" && r.top_fg_score != null ? ` · Authorship Score ${fmtScore(r.top_fg_score)}${r.top_fg_score < 30 ? " (below the 30 cut)" : ""}` : ""}`;
  // What Accept can do on this row, and why not when it can't. Every disabled state is the same
  // gate the old labelled buttons had; only the control changed.
  const acceptBlock: string | null = isMulti ? (nothingToPick ? "No candidate to accept — open the row to look up the directory" : pick ? null : "Pick a candidate first")
    : noSuggestion ? "No candidate to accept"
      : topRetired ? `${r.top_cwid} is a retired CWID${r.top_superseded_by ? ` — assign it to ${r.top_superseded_by} instead` : ""}`
        : noIdentity ? `${r.top_name || r.top_cwid} has no ReCiter identity, so there is nothing to add this authorship to — assign it to someone else`
          : alreadyRejected ? `${r.top_name || r.top_cwid} already rejected this article on their own curation page`
            : null;
  // noSuggestion: the server has nobody to reject (409), so Reject goes with Accept.
  const rejectBlock = noSuggestion ? "No candidate to reject" : null;
  const affiliation = r.author_affiliation ? splitAffiliation(r.author_affiliation, WCM_RE) : null;
  const dateText = formatRowDate(r.entrez_date);
  const venueFit = venueFitBand(r.top_venue_fit);
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return (
    <article ref={registerRef} tabIndex={0} onFocus={onFocus} onMouseEnter={onFocus}
      data-arow={r.id} data-focused={isFocused ? "true" : "false"} data-multi={isMulti ? "true" : "false"}
      data-expanded={isExpanded ? "true" : "false"}
      title={isExpanded ? "Click to close" : "Click to show evidence and look up someone else"}
      onClick={() => {
        // Selecting text (copying a title) shouldn't toggle the row.
        if (typeof window !== "undefined" && String(window.getSelection?.() || "")) return;
        onToggleExpand();
      }}
      style={rowStyle}>
      <div style={{ display: "grid", gridTemplateColumns: ROW_GRID, gap: 14, alignItems: "start", padding: "13px 16px", fontSize: 14, lineHeight: 1.45, color: "var(--pm-foreground)" }}>
        {/* selection checkbox — single-candidate open rows with a ReCiter identity, PLUS
            (T4) open, non-scopus multi-candidate rows, for bulk-assign only. See `selectable`. */}
        <div style={{ paddingTop: 6 }}>
          {selectable ? (
            <button type="button" role="checkbox" aria-checked={isSelected} aria-label={`select ${r.wcm_author || ""}`}
              onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
              style={{ border: 0, background: "none", padding: 0, cursor: "pointer", display: "block" }}>
              <span style={{
                width: 16, height: 16, boxSizing: "border-box", borderRadius: 4, display: "grid", placeItems: "center",
                color: "var(--pm-slate)", border: `1.5px solid ${isSelected ? "var(--pm-slate)" : "var(--pm-muted-foreground)"}`,
                background: isSelected ? "var(--pm-slate-tint)" : "#fff",
              }}>
                {isSelected && <IconCheck size={11} style={{ strokeWidth: 3 }} />}
              </span>
            </button>
          ) : null}
        </div>

        {/* IO badge + evidence toggle */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div data-io title={badgeTitle} style={{
            width: "100%", boxSizing: "border-box", height: 28, borderRadius: 6, display: "grid", placeItems: "center",
            fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums", cursor: "help",
            background: badgeTone.bg, color: badgeTone.fg, border: `1px solid ${badgeTone.bd}`,
          }}>{badge.text}</div>
          <button type="button" data-ev className="pm-arow-ev" onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
            aria-expanded={isExpanded} aria-label={isExpanded ? "Hide evidence (E)" : "Show evidence (E)"}
            title={isExpanded ? "Hide evidence (E)" : "Show evidence (E)"}
            style={{
              width: 24, height: 24, borderRadius: 6, display: "grid", placeItems: "center", padding: 0, cursor: "pointer",
              border: `1px solid ${isExpanded ? "var(--pm-slate-tint-border)" : "transparent"}`,
              background: isExpanded ? "var(--pm-slate-tint)" : "transparent",
              color: isExpanded ? "var(--pm-slate)" : "var(--pm-muted-foreground)",
            }}>
            <IconZoom size={14} />
          </button>
        </div>

        {/* author → suggested identity */}
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, color: "var(--pm-foreground)" }}>{r.wcm_author}</span>
            {r.author_position_label && <span style={{ fontSize: 12, color: "var(--pm-muted-foreground)" }}>{r.author_position_label} author</span>}
            {/* §2.6's co-author pill. pmid_sibling_count counts sibling authorship_review rows
                in the ACTIVE STATUS VIEW only, so a co-author already accepted onto their
                identity is not in it; the label says what it counts. */}
            {(r.pmid_sibling_count ?? 1) > 1 && (
              <Tip title="Other authorship rows for this paper still sitting in the queue you're viewing. Co-authors already assigned to an identity are NOT counted, so this is not the paper's full WCM author list. Click to narrow the queue to this PMID." placement="top" arrow>
                <button onClick={(e) => { e.stopPropagation(); onNarrowPmid(); }} style={{
                  font: "inherit", display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid var(--pm-border)", background: "#fff",
                  color: "var(--pm-muted-foreground)", borderRadius: 999, padding: "0 7px", height: 18, fontSize: 11, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap",
                }}>
                  <IconUsers size={11} /> +{(r.pmid_sibling_count as number) - 1} more in this queue
                </button>
              </Tip>
            )}
          </div>

          {conflictQueue ? (
            <ConflictKeepList row={r} acting={acting} onAction={onAction} />
          ) : isMulti ? (
            <>
              <span data-share style={{ fontSize: 12, color: "var(--pm-muted-foreground)" }}>
                {nothingToPick ? "No WCM candidate proposed · look up the directory" : shareLine(ranked.length || (r.n_candidates ?? candidates.length), !!pick || statusView !== "open")}
              </span>
              {/* The candidates as an inline radio group (prototype markup ~1015-1030): picking
                  one turns on ✓, which then assigns to them. Writes nothing by itself. Only the
                  Open queue can act, so the parked queues list them without radios. */}
              {ranked.length > 0 && (
                <div role="radiogroup" aria-label={`Who wrote this as ${r.wcm_author || "this author"}`} onClick={stop}
                  style={{ marginLeft: -6, display: "flex", flexDirection: "column", gap: 1 }}>
                  {ranked.map((c) => {
                    const on = c.cwid === pick?.cwid;
                    const live = statusView === "open";
                    const warn = c.already_rejected ? "Already rejected this paper on their own record"
                      : acceptedByCwids.has(c.cwid.toLowerCase()) ? "Already accepted this article" : "";
                    return (
                      <div key={c.cwid} role="radio" aria-checked={on} tabIndex={live ? 0 : -1} data-cand={c.cwid}
                        className={live ? "pm-arow-cand" : undefined}
                        title={[`${c.name || c.cwid} (${c.cwid})`, c.person_type, c.dept, c.io_score != null ? `IO ${Math.floor(c.io_score)}` : `${confBand(c.confidence)} match`, warn].filter(Boolean).join(" · ")}
                        onClick={() => { if (live) onPick(c.cwid); }}
                        onKeyDown={(e) => { if (live && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); e.stopPropagation(); onPick(c.cwid); } }}
                        onMouseEnter={() => openHover(c.cwid)} onMouseLeave={closeHover}
                        style={{ position: "relative", display: "grid", gridTemplateColumns: "13px minmax(0,1fr) auto", gap: 8, alignItems: "center",
                          padding: "4px 6px", borderRadius: 6, background: on ? "var(--pm-slate-tint)" : undefined, cursor: live ? "pointer" : "default", fontSize: 12.5 }}>
                        <span aria-hidden="true" style={{ width: 13, height: 13, borderRadius: "50%", boxSizing: "border-box", background: "#fff",
                          border: on ? "4px solid var(--pm-slate)" : "1.5px solid var(--pm-muted-foreground)", visibility: live ? "visible" : "hidden" }} />
                        <span style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          <span style={{ fontWeight: on ? 600 : 500, color: warn ? "var(--pm-red)" : on ? "var(--pm-slate)" : "var(--pm-foreground)" }}>{c.name || c.cwid}</span>
                          {c.dept && <span style={{ color: "var(--pm-muted-foreground)" }}> · {c.dept}</span>}
                          {warn && <span style={{ color: "var(--pm-red)" }}> · {c.already_rejected ? "already rejected" : "accepted this article"}</span>}
                        </span>
                        <span style={{ fontSize: 11.5, color: "var(--pm-muted-foreground)", fontVariantNumeric: "tabular-nums" }}>
                          {c.io_score != null ? Math.floor(c.io_score) : "—"}
                        </span>
                        {hoverCwid === c.cwid && (
                          <span style={{ position: "absolute", top: "100%", left: 21, width: 0, height: 0 }}>
                            <span style={{ position: "relative", display: "block" }}>
                              <IdentityHoverCard
                                subject={{ name: c.name, cwid: c.cwid, dept: c.dept, person_type: c.person_type, name_source: c.name_source, name_n: c.name_n }}
                                priorNames={priorNamesByCwid[c.cwid]} byline={r.wcm_author} pills={hoverPills(c, r.author_affiliation)} />
                            </span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : noSuggestion ? (
            <span style={{ fontSize: 12.5, color: "var(--pm-muted-foreground)", paddingLeft: 16 }}>→ No suggested identity · assign one below</span>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap", minWidth: 0 }}>
                <span style={{ color: "var(--pm-muted-foreground)", fontSize: 12 }}>→</span>
                {/* §2.6: the proposed identity's name carries the hover card. The wrapper is the
                    hover target AND the positioning context for the popup. */}
                <span onMouseEnter={() => openHover(r.top_cwid)} onMouseLeave={closeHover} style={{ position: "relative", display: "inline-block" }}>
                  <span data-idname style={{ fontWeight: 600, color: "var(--pm-slate)", borderBottom: "1px dotted var(--pm-slate-tint-border)", cursor: "help" }}>{r.top_name}</span>
                  {!!r.top_cwid && hoverCwid === r.top_cwid && (
                    <IdentityHoverCard
                      subject={{ name: r.top_name, cwid: r.top_cwid, dept: r.top_dept, person_type: r.top_person_type,
                                 division: r.top_division, institution: r.top_institution,
                                 name_source: topCand?.name_source, name_n: topCand?.name_n }}
                      priorNames={priorNamesByCwid[r.top_cwid]} byline={r.wcm_author}
                      pills={hoverPills({ io_score: r.top_io_score, given_match: r.top_given_match, affil_dept_match: r.top_affil_match }, r.author_affiliation)} />
                  )}
                </span>
                {r.top_cwid && (
                  <a href={`/curate/${r.top_cwid}`} target="_blank" rel="noreferrer" onClick={stop}
                    title={`Open ${r.top_name || r.top_cwid}'s curate profile`}
                    style={{ fontSize: 12, color: "var(--pm-slate)", textDecoration: "none" }}>{r.top_cwid}</a>
                )}
                {nameSourceBadge(topCand)}
              </div>
              {roleLine(r.top_person_type, r.top_dept, r.top_institution) && (
                <span data-role style={{ fontSize: 12, color: "var(--pm-muted-foreground)", paddingLeft: 16 }}>
                  {roleLine(r.top_person_type, r.top_dept, r.top_institution)}
                </span>
              )}
              {/* Why this row can't be accepted, in words, where the prototype puts its
                  "Not in ReCiter yet" line. #1012 (retired CWID) is checked first: a retired cwid
                  usually still HAS a ReCiter identity. The no-identity line keeps the app's
                  assign path (Decision 1): assigning records the decision on the row but does not
                  create an identity, so Accept can't stand in for it. */}
              {statusView === "open" && topRetired && (
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pm-red)", paddingLeft: 16 }}>
                  Retired CWID
                  {r.top_superseded_by && (
                    <> · <a href="#" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAssignOther(); }}
                      style={{ color: "var(--pm-slate)" }}>assign to {r.top_superseded_by}</a></>
                  )}
                </span>
              )}
              {statusView === "open" && !topRetired && noIdentity && (
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pm-amber)", paddingLeft: 16 }}
                  title="This person has no row in ReCiter's Identity table, so there is nothing to add this authorship to.">
                  Not in ReCiter yet · <a href="#" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAssignOther(); }}
                    style={{ color: "var(--pm-amber)" }}>assign to someone else</a>
                </span>
              )}
              {statusView === "open" && !topRetired && !noIdentity && alreadyRejected && (
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pm-red)", paddingLeft: 16 }}>
                  Already rejected by this person
                </span>
              )}
            </>
          )}

          {/* #990: another WCM identity already holds ACCEPTED at this row's exact byline slot. */}
          {!conflictQueue && (r.accepted_by?.length ?? 0) > 0 && (
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pm-amber)", paddingLeft: 16 }}>
              Already accepted by {r.accepted_by!.map((a) => `${a.name} (${a.cwid})`).join(", ")}
            </span>
          )}

          {/* T5: "Show N others like this" — only once the server-side like_count says there IS
              someone, on every open row. */}
          {statusView === "open" && !conflictQueue && likeCount > 0 && (
            <a href="#" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onFindOthers(); }}
              title={`Filter the queue to ${likeCount} other open row${likeCount === 1 ? "" : "s"} for "${r.wcm_author}" (matches middle-initial and similar byline variants)`}
              style={{ fontSize: 12, marginLeft: 16, width: "fit-content", color: "var(--pm-slate)", textDecoration: "none" }}>
              Show {likeCount} other{likeCount === 1 ? "" : "s"} like this
            </a>
          )}
        </div>

        {/* article */}
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <span data-title title={stripHtml(r.title)} style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, color: "var(--pm-foreground)", ...clampStyle(2) }}
            dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(r.title) }} />
          {/* journal · date · pub type. entrez_date is the NCBI index date on PubMed rows and the
              cover / publication date on the other lanes (#927), so its label stays in the tip. */}
          <span data-meta style={{ fontSize: 12.5, color: "var(--pm-muted-foreground)" }}>
            {r.journal && <em dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(r.journal) }} />}
            {dateText && (
              <Tip title={dateLabel(r.source).tip} placement="top" arrow>
                <span style={{ cursor: "help" }}>{r.journal ? " · " : ""}{dateLabel(r.source).label === "Indexed" ? "Indexed " : ""}{dateText}</span>
              </Tip>
            )}
            {r.pub_type && <>{(r.journal || dateText) ? " · " : ""}{r.pub_type}</>}
          </span>
          <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "var(--pm-muted-foreground)", minWidth: 0 }}>
            <span data-src style={{
              height: 18, padding: "0 6px", display: "inline-flex", alignItems: "center", borderRadius: 4, fontSize: 10.5, fontWeight: 600,
              letterSpacing: "0.02em", whiteSpace: "nowrap", flexShrink: 0,
              background: isExternalSource(r) ? "var(--pm-amber-tint)" : "var(--pm-slate-tint)",
              color: isExternalSource(r) ? "var(--pm-amber)" : "var(--pm-slate)",
            }}>{sourceBadgeText(r.source)}</span>
            <span title={r.author_affiliation || ""} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
              {affiliation ? (
                <>{affiliation.pre}{affiliation.hit && <strong style={{ fontWeight: 600, color: "var(--pm-slate)" }}>{affiliation.hit}</strong>}{affiliation.post}</>
              ) : "No affiliation on the byline"}
            </span>
          </div>
          {/* Scopus / OpenAlex byline — full author list from authors_json, one quiet line. */}
          {isExternalSource(r) && formatAuthorsJson(r.authors_json) && (
            <span style={{ fontSize: 12, color: "var(--pm-muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={formatAuthorsJson(r.authors_json)}>
              {formatAuthorsJson(r.authors_json)}
            </span>
          )}
          {/* exact-DOI duplicate precheck, and the producer's PubMed-twin heuristic (#951): two
              separate signals. The twin chip clears once a curator records a verdict. */}
          {(venueFit || r.dup_flag || (r.matched_pmid != null && !r.matched_pmid_verdict)) && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
              {/* venue fit (ReCiterDB v3.14): does the proposed person's department publish in
                  this venue's field. Quiet when it does, a caution when it rarely does. */}
              {venueFit === "good" && (
                <Tip title="This department often publishes in this venue's field" placement="top" arrow>
                  <span><Chip kind="ok">Venue fits department</Chip></span>
                </Tip>
              )}
              {venueFit === "poor" && (
                <Tip title="This department rarely publishes in this venue's field" placement="top" arrow>
                  <span><Chip kind="warn"><IconAlert size={12} /> Unusual venue for this department</Chip></span>
                </Tip>
              )}
              {r.dup_flag && (
                <Tip title={r.dup_reason || "Possible duplicate — already added as an external article"} placement="top" arrow>
                  <span><Chip kind="warn"><IconAlert size={12} /> Possible duplicate</Chip></span>
                </Tip>
              )}
              {r.matched_pmid != null && !r.matched_pmid_verdict && (
                <Tip title={`The producer found a PubMed record that may be the same paper as this ${externalSourceLabel(r)} row (a heuristic title+author search, not a confirmed match). Open this row to compare and record a verdict.`} placement="top" arrow>
                  <span><Chip kind="warn"><IconAlert size={12} /> PubMed twin? {
                    r.matched_pmid_source === "doi" ? "DOI match"
                      : r.matched_pmid_source === "scopus" ? "Scopus link"
                      : "title match"
                  }</Chip></span>
                </Tip>
              )}
            </div>
          )}
        </div>

        {/* actions: ✓ ✕ ⋯ in the open queue, Reopen in the parked ones */}
        {/* 104px in the Open queue; the parked note may run wider ("Snoozed until 2027 Jan 28"). */}
        <div data-actions style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, ...(statusView === "open" ? { width: 104 } : { minWidth: 104 }) }}>
          {conflictQueue ? null : statusView === "open" ? (
            <>
              <button type="button" className="pm-arow-accept" aria-label={isMulti ? (pick ? `Assign to ${pick.name || pick.cwid}` : "Assign") : "Accept"}
                title={acceptBlock || (isMulti && pick ? `Assign to ${pick.name || pick.cwid} (Y)` : "Accept (Y)")} disabled={acting || !!acceptBlock}
                onClick={(e) => { e.stopPropagation(); if (isMulti) { if (pick) onAction("assign", { cwid: pick.cwid }); } else onAction("accept"); }}
                style={rowActBtn("accept", acting || !!acceptBlock)}>
                <IconCheck size={14} style={{ strokeWidth: 2.5 }} />
              </button>
              <button type="button" className="pm-arow-reject" aria-label={isMulti ? "Reject all" : "Reject"}
                title={rejectBlock || (isMulti ? "Reject all candidates (N)" : "Reject (N)")} disabled={acting || !!rejectBlock}
                onClick={(e) => { e.stopPropagation(); onAction("reject"); }}
                style={rowActBtn("reject", acting || !!rejectBlock)}>
                <IconX size={14} style={{ strokeWidth: 2.5 }} />
              </button>
              <button type="button" className="pm-arow-more" aria-label="More actions" title="More actions" disabled={acting}
                onClick={(e) => { e.stopPropagation(); onMenu(e.currentTarget); }}
                style={rowActBtn("more", acting)}>
                <IconMore size={16} />
              </button>
            </>
          ) : (
            // Parked queues (prototype markup ~1107-1112): "Snoozed until 2027 Jan 28" or
            // "Dismissed" right-aligned above an extra-small outline Reopen.
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              {parkedNote(statusView, r.snooze_until) && (
                <span data-parked-note style={{ fontSize: 11.5, color: "var(--pm-muted-foreground)", whiteSpace: "nowrap" }}>
                  {parkedNote(statusView, r.snooze_until)}
                </span>
              )}
              <button type="button" disabled={acting} onClick={(e) => { e.stopPropagation(); onAction("reopen"); }}
                style={{
                  height: 24, padding: "0 9px", borderRadius: 6, border: "1px solid var(--pm-border-strong)", background: "#fff",
                  font: "inherit", fontSize: 12, fontWeight: 500, color: "var(--pm-foreground)", cursor: acting ? "default" : "pointer", opacity: acting ? 0.5 : 1,
                }}>Reopen</button>
            </div>
          )}
        </div>
      </div>

      {/* possible-duplicate conflict — anchored to THIS card (never a global toast that can
          drift over an unrelated one), stays up until the curator acts, names who it's for. */}
      {conflict && (
        <ConflictPrompt conflict={conflict} fallbackAuthor={r.wcm_author} onAction={onAction} onClear={onClearConflict}
          margin="0 16px 12px 104px" />
      )}

      {/* expanded evidence, the record footer and the "someone else" strip */}
      {isExpanded && (
        <ExpandedPanel row={r} candidates={candidates} pickedCwid={pick?.cwid} acting={acting} statusView={statusView}
          onPick={onPick} onAction={onAction} priorNamesByCwid={priorNamesByCwid} onHoverIdentity={onHoverIdentity}
          assignPrefill={assignPrefill} />
      )}
    </article>
  );
};

// The prompt a 409/422 action reply raises (possible duplicate, no ReCiter identity, off-candidate,
// multi-candidate): anchored to the row it is about, up until the curator acts. Shared by the
// authorship card and the duplicates view's pairs, so a confirmable failure is never silent there.
const ConflictPrompt = ({ conflict, fallbackAuthor, onAction, onClear, margin }: {
  conflict: ConflictEntry; fallbackAuthor?: string | null; margin: string;
  onAction: (action: string, extra?: Record<string, any>) => void; onClear: () => void;
}) => (
  <div onClick={(e) => e.stopPropagation()} style={{
    margin, padding: "10px 12px", borderRadius: 8,
    background: "var(--pm-amber-tint)", border: "1px solid var(--pm-amber-tint-border)", fontSize: 12.5, color: "var(--pm-amber)",
  }}>
    <div style={{ fontWeight: 700, marginBottom: 3 }}>
      {conflict.kind === "no_identity" ? "No ReCiter identity"
        : conflict.kind === "off_candidate" ? "Not a proposed candidate — this writes their record"
          : conflict.kind === "multi_candidate" ? "This row now has multiple candidates"
            : "Possible duplicate"}
      {" — "}{conflict.wcm_author || conflict.top_name || fallbackAuthor}
    </div>
    <div style={{ marginBottom: 6 }}>{conflict.kind === "dup" ? curatorConflictMessage(conflict.message) : conflict.message}</div>
    {conflict.matches.length > 0 && (
      <ul style={{ margin: "0 0 8px", paddingLeft: 18 }}>
        {conflict.matches.map((m, i) => (
          <li key={i} style={{ marginBottom: 2 }}>
            {m.title || m.detail || m.type || "conflicting record"}
            {(m.journal || m.pubYear) && (
              <span style={{ color: "var(--pm-amber)" }}> ({[m.journal, m.pubYear].filter(Boolean).join(", ")})</span>
            )}
            {m.matchedId && <span style={{ color: "var(--pm-amber)" }}> — {m.matchedId}</span>}
          </li>
        ))}
      </ul>
    )}
    <div style={{ display: "flex", gap: 8 }}>
      {/* multi_candidate has no retry — the row's own re-render (fetchData(true) after
          the 409) already replaced Accept with Pick-one, so there's nothing to confirm. */}
      {conflict.kind !== "multi_candidate" && (
        <button onClick={() => { onAction(conflict.action, conflict.extra); onClear(); }}
          style={{ ...btn("accept"), padding: "3px 10px", fontSize: 12 }}>
          {conflict.kind === "no_identity" ? "Assign anyway — record on this row only"
            : conflict.kind === "off_candidate" ? "Yes — add to their publication record"
              : "Force add anyway"}
        </button>
      )}
      <button onClick={onClear} style={{ ...btn("ghost"), padding: "3px 10px", fontSize: 12 }}>
        {conflict.kind === "multi_candidate" ? "Got it" : "Cancel"}
      </button>
    </div>
  </div>
);

// Identity-conflicts row (prototype markup ~1072-1080): a red "Claimed by two people · keep one"
// line, then one bordered sub-row per identity — the row's proposed identity and each WCM person
// who already accepted this byline slot — each with its own Keep. conflictKeep() decides what
// Keep sends, from the row actions that already exist; see its comment for why keeping the
// proposed identity leaves the other person's acceptance in place, which the note says.
const ConflictKeepList = ({ row: r, acting, onAction }: {
  row: AuthorshipRow; acting: boolean; onAction: (action: string, extra?: Record<string, any>) => void;
}) => {
  const cands = parseCandidates(r.candidate_cwids_json);
  const candCwids = [r.top_cwid, ...cands.map((c) => c.cwid)].filter(Boolean) as string[];
  const ids = conflictIdentities(r, cands);
  const accepted = ids.filter((i) => i.accepted);
  const proposed = ids.find((i) => !i.accepted);
  const keepTitle = (i: ConflictIdentityView) => {
    const k = conflictKeep(r, i.cwid, candCwids);
    if (!i.accepted) return `Add this authorship to ${i.name}'s record. ${accepted.map((a) => a.name).join(", ")} keep${accepted.length === 1 ? "s" : ""} it until it is removed from their own record.`;
    return k.action === "dismiss"
      ? `${i.name} keeps it. Closes this row without recording "not mine" for anyone, since ${i.name} is one of its candidates.`
      : `${i.name} keeps it. Records "not mine" for ${proposed?.name || "the proposed identity"} and closes this row.`;
  };
  return (
    <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span data-conflict-note style={{ fontSize: 12, fontWeight: 600, color: "var(--pm-red)", paddingLeft: 16 }}>
        Claimed by {ids.length === 2 ? "two" : ids.length} people · keep one
      </span>
      {ids.map((i) => {
        const k = conflictKeep(r, i.cwid, candCwids);
        return (
          <div key={i.cwid} data-conflict-id={i.cwid} style={{
            marginLeft: 16, display: "flex", gap: 8, alignItems: "center", padding: "6px 9px", borderRadius: 8,
            border: "1px solid var(--pm-border)", background: "#fff", fontSize: 12.5, minWidth: 0,
          }}>
            {/* name and cwid flow as one line of text, so a narrow column wraps them instead of
                overlapping them */}
            <span style={{ flex: "1 1 auto", minWidth: 0, lineHeight: 1.35 }}>
              <span style={{ fontWeight: 600 }}>{i.name}</span>{" "}
              <a href={`/curate/${i.cwid}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--pm-slate)", textDecoration: "none", whiteSpace: "nowrap" }}>{i.cwid}</a>
            </span>
            <span style={{ flex: "0 0 auto", fontSize: 11.5, color: "var(--pm-muted-foreground)", whiteSpace: "nowrap" }}>
              {i.io != null ? `IO ${Math.floor(i.io)}` : ""}{i.accepted ? `${i.io != null ? " · " : ""}accepted` : ""}
            </span>
            <button type="button" disabled={acting} title={keepTitle(i)}
              onClick={() => onAction(k.action, k.extra)}
              style={{
                height: 24, padding: "0 9px", borderRadius: 6, border: "1px solid var(--pm-border-strong)", background: "#fff", flexShrink: 0,
                font: "inherit", fontSize: 12, fontWeight: 500, color: "var(--pm-foreground)", cursor: acting ? "default" : "pointer", opacity: acting ? 0.5 : 1,
              }}>Keep</button>
          </div>
        );
      })}
    </div>
  );
};
type ConflictIdentityView = ReturnType<typeof conflictIdentities>[number];

// The expanded row (prototype markup ~1115-1185): the evidence (one candidate's table, or the
// comparison grid on a multi-candidate row), the grey record footer, then the "someone else"
// strip. The candidate-evidence request is made once here and shared by the table, the grid and
// the footer's Authors line.
const ExpandedPanel = ({ row: r, candidates, pickedCwid, acting, statusView, onPick, onAction,
  priorNamesByCwid, onHoverIdentity, assignPrefill }: {
  row: AuthorshipRow; candidates: Candidate[]; pickedCwid?: string; acting: boolean; statusView: "open" | "snoozed" | "dismissed";
  onPick: (cwid: string) => void; onAction: (action: string, extra?: Record<string, any>) => void;
  priorNamesByCwid: Record<string, PriorNames>; onHoverIdentity: (cwid?: string | null) => void; assignPrefill?: string;
}) => {
  const isMulti = !r.single_candidate;
  const noSuggestion = !r.top_cwid;
  const noIdentity = r.identity_in_reciter === false;
  const live = candidates.filter((c) => !c.retired_cwid);
  const ev = useCandidateEvidence(r.id, isMulti ? live.map((c) => c.cwid).sort().join(",") : r.top_cwid || "");
  return (
    <div onClick={(e) => e.stopPropagation()} data-expanded-panel
      style={{ margin: "0 16px 12px 104px", display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "var(--pm-foreground)", cursor: "default" }}>
      {isMulti ? (
        <MultiEvidence row={r} candidates={candidates} pickedCwid={pickedCwid} ev={ev}
          onPick={statusView === "open" ? onPick : undefined}
          priorNamesByCwid={priorNamesByCwid} onHoverIdentity={onHoverIdentity} />
      ) : noSuggestion ? (
        <span style={{ fontSize: 12.5, color: "var(--pm-muted-foreground)" }}>No suggested identity to compare against. Use the box below to look the author up in the directory.</span>
      ) : (
        <SingleEvidenceTable row={r} ev={ev} />
      )}
      {/* PubMed-twin adjudication (#951 Layer 2) — the producer's matched_pmid flag, rendered
          ahead of the footer so the comparison is the first thing a curator sees on a flagged
          row (assigning is still possible below regardless of what this panel finds). */}
      {r.matched_pmid != null && (
        <CounterpartPanel row={r} acting={acting} onAction={onAction} />
      )}
      <RecordFooter row={r} ev={ev} />
      {/* Both row kinds, not just multi (#925 shipped it inside MultiEvidence only): a
          single-candidate row is precisely where the producer was CONFIDENTLY wrong, so it's the
          case where the curator most often knows a name the row can't offer. Opening a row runs
          the directory lookup on the byline name straight away (UI refresh 4c: every expand);
          the box itself starts empty, as in the prototype. */}
      {(
        <AssignOther rowId={r.id} acting={acting} onAction={onAction} authorName={r.wcm_author}
          affiliation={r.author_affiliation} prefill={assignPrefill} autoSearch={!assignPrefill}
          // One note for the box and the radios. `listed` is candidates-minus-one, `typed` is all
          // of them: someone typed in is by definition not a listed candidate. F-2: a
          // single-candidate row records the same "not mine" for its one proposed candidate when
          // that candidate exists and has a ReCiter identity. Scopus has no pmid to reject.
          note={<HomonymNote
            listed={!isExternalSource(r) && isMulti ? Math.max(0, candidates.length - 1) : 0}
            typed={isExternalSource(r) ? 0
              : isMulti ? candidates.length
                : (noSuggestion || noIdentity ? 0 : 1)} />} />
      )}
    </div>
  );
};

// The grey key/value box under the evidence (prototype markup ~1179-1184): the byline with this
// row's author highlighted, the record id, production's Authorship Score against the 30 cut,
// and the match class.
const RecordFooter = ({ row: r, ev }: { row: AuthorshipRow; ev: ReturnType<typeof useCandidateEvidence> }) => {
  const external = isExternalSource(r);
  const fromJson = (() => {
    if (!external || !r.authors_json) return null;
    try {
      const list = JSON.parse(r.authors_json);
      return Array.isArray(list) ? list.map((a: any) => `${String(a?.given || "").trim()} ${String(a?.surname || "").trim()}`.trim()).filter(Boolean) as string[] : null;
    } catch { return null; }
  })();
  const authors = ev.status === "ok" && ev.data.authors?.length ? ev.data.authors : fromJson;
  const target = ev.status === "ok" && ev.data.authors?.length ? (ev.data.target ?? -1)
    : (fromJson || []).findIndex((n) => n.toLowerCase() === String(r.wcm_author || "").toLowerCase());
  const parts = authors?.length ? bylineParts(authors, target) : null;
  const cls = r.classification ? CLASS_META[r.classification] : undefined;
  const k: CSSProperties = { color: "var(--pm-muted-foreground)" };
  const hl: CSSProperties = { background: "var(--pm-slate-tint)", color: "var(--pm-slate)", padding: "0 3px", borderRadius: 3, fontWeight: 600 };
  return (
    <div data-record-footer style={{
      padding: "9px 12px", borderRadius: 8, background: "var(--pm-page)", border: "1px solid var(--pm-border)",
      display: "grid", gridTemplateColumns: "110px minmax(0,1fr)", gap: "5px 12px", fontSize: 12.5, lineHeight: 1.5,
    }}>
      <span style={k}>Authors</span>
      <span data-authors style={{ minWidth: 0, overflowWrap: "anywhere" }}>
        {parts ? (
          <>{parts.pre}{parts.tgt ? <strong style={hl}>{parts.tgt}</strong> : null}{parts.post}
            {authors!.length > 12 && <span style={k}> · {authors!.length} authors</span>}</>
        ) : ev.status === "loading" && !external ? (
          <span style={k}>Loading…</span>
        ) : (
          <><strong style={hl}>{r.wcm_author}</strong><span style={k}> · the full author list isn’t available</span></>
        )}
      </span>
      {external ? (
        <>
          <span style={k}>{r.source === "openalex" ? "OpenAlex" : "Scopus"}</span>
          <span style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", minWidth: 0 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{r.external_id || "—"}</span>
            {r.source === "openalex" ? <OpenAlexLinks row={r} /> : <ScopusLinks row={r} />}
          </span>
        </>
      ) : (
        <>
          <span style={k}>PMID</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{r.pmid != null ? <PmidCite pmid={r.pmid} bare /> : "—"}</span>
        </>
      )}
      <span style={k}>Authorship Score</span>
      <span data-fg>{fgLine(r.top_fg_score, r.source)}</span>
      {cls && (
        <>
          <span style={k}>Match class</span>
          <span><strong style={{ fontWeight: 600, color: r.classification === "buried" ? "var(--pm-red)" : r.classification === "absent" ? "var(--pm-amber)" : "var(--pm-muted-foreground)" }}>{cls.label}</strong> · {cls.hint}</span>
        </>
      )}
    </div>
  );
};

// 4d-3: the evidence table for the row's one candidate. A single row carries its candidate as
// top_* fields, not a candidate object, so build one from them. Scopus / OpenAlex rows and rows
// production never retrieved say so beside the tally, where the prototype puts its note.
const SingleEvidenceTable = ({ row: r, ev }: { row: AuthorshipRow; ev: ReturnType<typeof useCandidateEvidence> }) => {
  if (ev.status === "loading") return <div style={{ fontSize: 12.5, color: "var(--pm-muted-foreground)" }}>Loading evidence…</div>;
  if (ev.status === "error") return <div style={{ fontSize: 12.5, color: "var(--pm-amber)" }}>Couldn’t load the evidence table. Close and reopen the row to retry.</div>;
  const year = Number((r.entrez_date || "").slice(0, 4)) || null;
  const rows = buildCandidateEvidence(
    { byline: r.wcm_author, affiliation: r.author_affiliation, journal: r.journal, year, source: r.source, coauthors: ev.data.coauthors },
    { cwid: r.top_cwid, name: r.top_name, dept: r.top_dept, io_score: r.top_io_score, given_match: r.top_given_match,
      affil_dept_match: r.top_affil_match, already_rejected: r.top_already_rejected },
    ev.data.facts[r.top_cwid || ""],
  );
  const note = isExternalSource(r) ? `Not in PubMed, so production never scored it · match confidence ${confBand(r.top_confidence)}`
    : r.top_io_score == null ? `Never retrieved by ReCiter, so there is no Identity-Only Score · match confidence ${confBand(r.top_confidence)}` : "";
  return <EvidenceTable rows={rows} who={`${r.top_name || r.top_cwid} · ${r.top_cwid}`}
    note={note ? <span data-ev-note style={{ fontSize: 12, color: "var(--pm-amber)" }}>{note}</span> : undefined} />;
};

// What an assign does to the OTHER candidate(s) on the row, said before the click rather than
// discovered afterwards. Assigning to one of N — or, per F-2, assigning AWAY from a row's one
// proposed candidate — now records a rejection for the rest: a gold-standard write into other
// people's records, so it cannot be a silent side effect.
// Rendered for pubmed rows only (multi-candidate always, single-candidate when its one proposed
// candidate has an identity to displace), which is exactly where the server writes them —
// scopus has no pmid to reject.
// "with a ReCiter identity" is not hedging: the server skips candidates ReCiter has no Identity
// row for, because that write would SUCCEED (200) into an orphan GoldStandard row nothing reads
// — 39 of the 153 people in the resolved backlog are these.
// Rendered ONCE per card, after both assign controls, because the two buttons reject
// different sets and both notes used to stack: `listed` is what "Assign selected" rejects
// (the candidates minus the picked one), `typed` is what the AssignOther box rejects (all of
// them — someone typed in is by definition not a listed candidate). They differ by one, so
// one sentence names both rather than two amber paragraphs disagreeing about the number.
// Tucked behind an info button (owner request 2026-09-15): the amber paragraph was the tallest
// thing on every card and read the same each time. The full sentence is the tooltip.
const HomonymNote = ({ listed, typed }: { listed: number; typed: number }) => typed < 1 ? null : (
  <div style={{ display: "flex" }}>
    <Tip placement="left" arrow title={<>
      {listed < 1
        // single-candidate row: the two counts collapse (0 listed / 1 typed), so the combined
        // wording would name a choice the curator doesn't have.
        ? <>Assigning also records “not mine” for the other {typed} candidate{typed === 1 ? "" : "s"} on this row (those with a ReCiter identity).</>
        : <>Assigning also records “not mine” for the other candidates on this row — the {listed} listed here, or all {typed} if you assign someone you type in (those with a ReCiter identity).</>}
      {" "}Reopening the row undoes both.
    </>}>
      <button type="button" onClick={(e) => e.stopPropagation()} aria-label="What assigning also records"
        style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: "2px 4px", font: "inherit", fontSize: 11.5, color: "var(--pm-amber)", cursor: "help" }}>
        <IconInfo size={13} /> also records “not mine” for the others
      </button>
    </Tip>
  </div>
);

// The opened multi-candidate row: the comparison grid (4d-4), with the radios on the collapsed
// row as the other way to pick. The notes the row can't show in one line sit above it.
const MultiEvidence = ({ row: r, candidates: allCandidates, pickedCwid, ev, onPick, priorNamesByCwid, onHoverIdentity }: {
  row: AuthorshipRow; candidates: Candidate[]; pickedCwid?: string; ev: ReturnType<typeof useCandidateEvidence>;
  // undefined on the parked queues (Snoozed / Dismissed): only the Open queue can act.
  onPick?: (cwid: string) => void;
  priorNamesByCwid: Record<string, PriorNames>; onHoverIdentity: (cwid?: string | null) => void;
}) => {
  // #1012: a cwid ED has RETIRED is removed from the picker outright — unlike already_rejected,
  // which stays VISIBLE because it records a judgement a curator may still overrule. Never
  // silent: what was removed is named under the grid, with its replacement, which is very often
  // ALREADY one of the remaining candidates (112 of the 233 affected open rows on 2026-09-09).
  const retiredCandidates = allCandidates.filter((c) => c.retired_cwid);
  const candidates = rankCandidates(allCandidates);
  const anyDeptMatch = candidates.some((c) => c.affil_dept_match);
  // One hover at a time, so a single cwid rather than a per-candidate flag each.
  const [hoverCwid, setHoverCwid] = useState<string | null>(null);
  const candHoverTimer = useRef<any>(null);
  useEffect(() => () => clearTimeout(candHoverTimer.current), []);
  const openHover = (cwid: string) => {
    clearTimeout(candHoverTimer.current);
    candHoverTimer.current = setTimeout(() => { setHoverCwid(cwid); onHoverIdentity(cwid); }, 220);
  };
  const closeHover = () => { clearTimeout(candHoverTimer.current); setHoverCwid(null); };
  // #990: candidates who already hold ACCEPTED at this byline slot. Lowercased on both sides,
  // as the server compares cwids case-insensitively.
  const acceptedByCwids = new Set((r.accepted_by || []).map((a) => String(a.cwid || "").toLowerCase()));
  const rowInput = { byline: r.wcm_author, affiliation: r.author_affiliation, journal: r.journal,
    year: Number((r.entrez_date || "").slice(0, 4)) || null, source: r.source,
    coauthors: ev.status === "ok" ? ev.data.coauthors : null };
  const cols = ev.status === "ok" && candidates.length >= 1
    ? orderByEvidence(candidates, (c) => buildCandidateEvidence(rowInput, c, ev.data.facts[c.cwid])) : null;
  const pickedName = candidates.find((c) => c.cwid === pickedCwid)?.name || pickedCwid;
  // Name, hover card and warning badges: the grid's column header.
  const head = (c: Candidate) => {
    const rejected = c.already_rejected === true;
    const acceptedElsewhere = acceptedByCwids.has(String(c.cwid || "").toLowerCase());
    return (
      <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <span onMouseEnter={() => c.cwid && openHover(c.cwid)} onMouseLeave={closeHover}
          style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0, fontSize: 12.5, fontWeight: 600 }}>
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name || c.cwid}</span>
          {hoverCwid === c.cwid && (
            <IdentityHoverCard subject={{ name: c.name, cwid: c.cwid, dept: c.dept, person_type: c.person_type, name_source: c.name_source, name_n: c.name_n }}
              priorNames={c.cwid ? priorNamesByCwid[c.cwid] : undefined} byline={r.wcm_author} pills={hoverPills(c, r.author_affiliation)} />
          )}
        </span>
        {(rejected || acceptedElsewhere) && (
          <span style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {rejected && <Chip kind="warn">Already rejected</Chip>}
            {acceptedElsewhere && <Chip kind="warn">Accepted this article</Chip>}
          </span>
        )}
      </span>
    );
  };

  return (
    <>
      {!anyDeptMatch && candidates.length > 0 && (
        <span style={{ fontSize: 12, color: "var(--pm-amber)" }}>The affiliation names no department any candidate is in, so the candidates are ranked by Identity-Only Score.</span>
      )}
      {candidates.length === 0 ? (
        <span style={{ fontSize: 12.5, color: "var(--pm-muted-foreground)" }}>No candidate to compare. Use the box below to look the author up in the directory.</span>
      ) : ev.status === "loading" ? (
        <span style={{ fontSize: 12.5, color: "var(--pm-muted-foreground)" }}>Loading the comparison…</span>
      ) : ev.status === "error" || !cols ? (
        <span style={{ fontSize: 12.5, color: "var(--pm-amber)" }}>Couldn’t load the comparison. Pick from the list above, or close and reopen the row to retry.</span>
      ) : (
        <CompareGrid cols={cols} pickedCwid={pickedCwid} onPick={onPick} renderHead={head}
          hint={onPick ? compareHint(pickedCwid ? pickedName : null) : "Reopen it to pick who gets this authorship."} />
      )}
      {/* #1012: what the retired-cwid filter removed, and what replaced it. */}
      {retiredCandidates.length > 0 && (
        <div style={{ fontSize: 12, color: "var(--pm-amber)", lineHeight: 1.45 }}>
          {retiredCandidates.map((c) => {
            const alsoHere = c.superseded_by && candidates.some(
              (k) => k.cwid.toLowerCase() === String(c.superseded_by).toLowerCase());
            return (
              <div key={c.cwid}>
                <strong>{c.cwid}</strong>{c.name ? ` (${c.name})` : ""} is a retired CWID
                {c.superseded_by
                  ? <> — {alsoHere ? "the same person as " : "replaced by "}<strong>{c.superseded_by}</strong>
                      {alsoHere ? ", listed above" : ""}.</>
                  : <> with no replacement on record.</>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

// "Someone else: [cwid] [Assign]" — a person identifier the curator types, for someone the
// producer never offered. Two reasons it can't be offered: the candidate list is built from
// `identity`, so anyone outside that feed (Master's students, visiting researchers) can never
// appear no matter how obviously they wrote the paper; and even inside the feed the producer
// only proposes its top few, which on a single-candidate card is exactly one guess.
// The server keeps it deliberate — it 422s once, having looked the identifier up, and the
// prompt it raises NAMES the person before the curator confirms.
// ponytail: the "lookup route feeding the box" upgrade path landed — #948 built POST
// /api/db/authorships/lookup for the bulk dialog, so the box debounces into it and a resolved
// Assign/Enter writes in one click; unresolved (debouncing/errored) falls back to the plain call.
const AssignOther = ({ rowId, acting, onAction, prefill, autoSearch, authorName, affiliation, note }: {
  rowId: number; acting: boolean; onAction: (action: string, extra?: Record<string, any>) => void;
  prefill?: string; // a name to look up straight away (the ⋯ menu's "Assign to someone else…")
  autoSearch?: boolean; // the row was simply opened: look up the byline name, WCM first
  authorName?: string; // the byline name — "Look up <name>" searches it instead of retyping it
  affiliation?: string; // the byline's affiliation — ranks directory hits in that department first
  note?: ReactNode; // what assigning also records, beside the controls
}) => {
  const [otherCwid, setOtherCwid] = useState("");
  // What the debounced POST /api/db/authorships/lookup has found for the CURRENT otherCwid —
  // reset to idle on every keystroke (not just short ones) so a resolved answer can never be
  // submitted against a string the curator has since changed. requestSeq guards the fetch
  // itself: a later keystroke bumps it, and a response whose seq no longer matches is dropped
  // even if it lands after a newer one (out-of-order network replies).
  const [lookupState, setLookupState] = useState<TypedCwidLookupState>({ status: "idle" });
  // Directory NAME-search results, when the typed string is a name rather than an identifier
  // (or is an identifier nothing recognises). Null = no search has answered for this string;
  // [] = searched and nobody matched. Cleared on every keystroke alongside lookupState, for the
  // same reason: a stale list must never outlive the string that produced it.
  const [matches, setMatches] = useState<any[] | null>(null);
  // The name the hit list below answers, when it came from "Look up <byline>" or the search an
  // opened row runs by itself rather than from the box.
  const [searched, setSearched] = useState<string | null>(null);
  const requestSeq = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True only for the lookup the card seeded itself; any keystroke or "Lookup <name>" click
  // clears it, so the server's WCM-first / Cornell-fallback narrowing applies to the routine
  // search alone and a curator who types a name still gets both directories.
  const autoSeeded = useRef(false);
  useEffect(() => () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); }, []);

  const post = useCallback((payload: Record<string, string>) =>
    fetch("/api/db/authorships/lookup", {
      credentials: "same-origin", method: "POST", headers: apiHeaders,
      body: JSON.stringify(payload),
    }).then(async (r) => {
      if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
      return r.json();
    }), []);

  // One lookup cycle for `val`, guarded by `seq` so an out-of-order reply for a string the
  // curator has since changed is dropped. Identifier-shaped input asks the cwid question
  // first, because that is the cheap one and the common answer; only when ReCiter has never
  // heard of it AND no directory recognises it as an identifier do we spend a second
  // round-trip treating the same characters as a surname. Anything with a space can only ever
  // be a name.
  const runLookup = useCallback((val: string, seq: number) => {
    const isIdentifier = /^[A-Za-z0-9]{1,32}$/.test(val);
    setLookupState({ status: "loading" });
    const nameQuery = { q: val, affil: affiliation || "", auto: autoSeeded.current ? "1" : "" };
    (isIdentifier ? post({ cwid: val }) : post(nameQuery).then((d) => ({ searchOnly: d })))
      .then(async (d: any) => {
        if (requestSeq.current !== seq) return;
        if (d.searchOnly) { setLookupState({ status: "idle" }); setMatches(d.searchOnly.matches || []); return; }
        setLookupState({
          status: "resolved", cwid: String(d.cwid || val),
          name: d.name ?? null, hasIdentity: !!d.hasIdentity, directory: d.directory ?? null,
        });
        if (!d.hasIdentity && !d.directory) {
          const s = await post(nameQuery);
          if (requestSeq.current !== seq) return;
          setMatches(s.matches || []);
        }
      })
      .catch((e) => {
        if (requestSeq.current !== seq) return;
        setLookupState({ status: "error", message: String(e?.message || e) });
      });
  }, [post, affiliation]);

  // Picking a search result puts its identifier in the box and re-asks the cwid question about
  // it, rather than assigning straight off the row: the write must be authorised against what
  // the SERVER resolves the identifier to, never against a label the search happened to render.
  // Same trust boundary the bulk confirm dialog enforces. When the bridge says this Cornell
  // person already holds a WCM identity, the box takes THAT identifier — the one the write
  // will land on.
  // The hit list stays up with the picked row marked, as in the prototype's radio table; the
  // next keystroke clears both.
  const [pickedHit, setPickedHit] = useState<string | null>(null);
  const pick = useCallback((m: any) => {
    const id = m.wcmCwidHasIdentity && m.wcmCwid ? String(m.wcmCwid) : String(m.id);
    setOtherCwid(id);
    setPickedHit(`${m.source}:${m.id}`);
    requestSeq.current += 1;
    runLookup(id, requestSeq.current);
  }, [runLookup]);

  // A name is not submittable — it is a search term, and the server's assign route would 400 on
  // it. Picking a result turns it into an identifier, which is submittable. Keeping this in one
  // predicate means the button and Enter agree.
  // #1012: a retired cwid is the ONE preview outcome that is not submittable. Every other warn
  // here describes an unusual but legitimate write (a bridge, a mint, a local-only record); this
  // one the server refuses outright, so the button goes dead rather than sending into a 409.
  // Derived from the preview so the disabled button and the line explaining it can never
  // disagree — and the lookup is reset on every keystroke, so `blocked` can only ever describe
  // the string currently in the box.
  const typedPreview = typedCwidPreview(lookupState);

  // One path for a keystroke AND the "Assign to someone else…" prefill, so the seeded name gets
  // the same debounced lookup (and the same stale-answer invalidation) a typed one does.
  // NOT trimmed here (it used to be): a name needs an interior space, and trimming the
  // controlled value on every keystroke made one impossible to type. Trimming happens where
  // it matters instead — at lookup and at submit.
  const setValue = useCallback((val: string, auto = false) => {
    autoSeeded.current = auto;
    setOtherCwid(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    requestSeq.current += 1; // invalidate any in-flight/pending lookup for the old value
    setLookupState({ status: "idle" }); // EVERY keystroke — a resolved answer never outlives its string
    setMatches(null);
    setPickedHit(null);
    const q = val.trim();
    setSearched(q.length < 3 ? null : q);
    if (q.length < 3) return;
    const seq = requestSeq.current;
    debounceTimer.current = setTimeout(() => runLookup(q, seq), 350);
  }, [runLookup]);

  const submittable = /^[A-Za-z0-9]{1,32}$/.test(otherCwid.trim()) && !typedPreview?.blocked;

  const submitOther = useCallback(() => {
    if (!submittable || acting) return;
    const typedId = otherCwid.trim();
    // Resolved AND for this exact string (lookupState is reset on every keystroke, so a
    // "resolved" status can only describe otherCwid as it stands right now) → one-click write,
    // reusing the same {cwid,name,hasIdentity} shape and the same assignConfirmFlags the
    // bulk-assign confirm dialog sends. offCandidate is always true: a typed cwid is by
    // definition not one of this row's proposed candidates (assignGate.ts:25 only consults
    // confirmOffCandidate when the server's own offCandidate check is also true, so sending it
    // unconditionally is harmless on the rows where the typed cwid happens to already be
    // on-candidate). Anything else (idle/loading/error) — today's unconfirmed call, unchanged;
    // the existing 422 → banner path (doAction's catch) still handles it.
    // A resolved assignee with no ReCiter identity whom a directory names takes this same
    // one-click path: the server mints the identity and writes with no confirm since
    // 2026-09-20 (assignGate's mint_and_write), so there is no 422 left to route them to.
    if (lookupState.status === "resolved") {
      onAction("assign", { cwid: lookupState.cwid, ...assignConfirmFlags(true, lookupState.hasIdentity) });
    } else {
      onAction("assign", { cwid: typedId });
    }
  }, [otherCwid, acting, lookupState, onAction, submittable]);

  // The search an opened row runs by itself (and the ⋯ menu's "Assign to someone else…"): a
  // directory NAME search for the byline that leaves the box empty, as the prototype's strip
  // opens. `auto` lets the server apply its WCM-first / Cornell-fallback narrowing to the
  // routine search alone. "Look up <byline>" instead puts the name in the box (setValue).
  const [autoPending, setAutoPending] = useState(false);
  const search = useCallback((term: string, auto: boolean) => {
    const q = term.trim();
    if (!q) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    requestSeq.current += 1;
    const seq = requestSeq.current;
    setOtherCwid("");
    setLookupState({ status: "idle" });
    setMatches(null);
    setPickedHit(null);
    setSearched(q);
    setAutoPending(true);
    post({ q, affil: affiliation || "", auto: auto ? "1" : "" })
      .then((d: any) => { if (requestSeq.current === seq) setMatches(d.matches || []); })
      .catch(() => { if (requestSeq.current === seq) setMatches([]); })
      .finally(() => { if (requestSeq.current === seq) setAutoPending(false); });
  }, [post, affiliation]);
  useEffect(() => {
    if (prefill) search(prefill, false);
    else if (autoSearch && authorName) search(authorName, true);
  }, [prefill, autoSearch, authorName, search]);
  const cancel = () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    requestSeq.current += 1;
    setOtherCwid(""); setLookupState({ status: "idle" }); setMatches(null); setPickedHit(null); setSearched(null); setAutoPending(false);
  };
  const dirHead: CSSProperties = { fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--pm-muted-foreground)" };

  // every handler stops propagation: the row is click-to-expand, so an unguarded click or
  // Enter inside this input would collapse it out from under the curator mid-type.
  return (
    <div data-assign-other onClick={(e) => e.stopPropagation()} style={{
      padding: "10px 12px", borderRadius: 8, background: "var(--pm-surface-2)", border: "1px solid var(--pm-border)",
      display: "flex", flexDirection: "column", gap: 8, minWidth: 0, cursor: "default",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {authorName && (
          <Button size="sm" disabled={acting} onClick={() => { setAutoPending(false); setValue(authorName); }} sx={{ height: 30 }}>
            Look up {authorName}
          </Button>
        )}
        <label htmlFor={`otherCwid-${rowId}`} style={{ fontSize: 12.5, color: "var(--pm-muted-foreground)" }}>
          Someone else:
        </label>
        <input id={`otherCwid-${rowId}`} value={otherCwid} placeholder="Name or CWID"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.stopPropagation(); cancel(); return; }
            if (e.key !== "Enter" || !otherCwid.trim() || acting) return;
            e.preventDefault(); e.stopPropagation();
            submitOther();
          }}
          style={{
            width: 220, height: 30, boxSizing: "border-box", padding: "0 9px", border: "1px solid var(--pm-border-strong)",
            borderRadius: 6, fontSize: 13, fontFamily: "inherit", background: "#fff", color: "var(--pm-foreground)",
          }} />
        {/* never disabled on lookupState — a slow/errored lookup must not block the button,
            it only changes which onAction call submitOther makes. */}
        <Button variant="primary" size="sm" disabled={acting || !submittable} onClick={() => submitOther()} sx={{ height: 30 }}>
          Assign
        </Button>
        {(otherCwid || matches !== null || searched) && (
          <button type="button" onClick={cancel}
            style={{ border: 0, background: "none", padding: "0 4px", fontSize: 12.5, color: "var(--pm-muted-foreground)", cursor: "pointer", fontFamily: "inherit" }}>
            Cancel
          </button>
        )}
        {typedPreview && (
          <span style={{ fontSize: 12, color: typedPreview.tone === "warn" ? "var(--pm-amber)" : "var(--pm-muted-foreground)" }}>
            {typedPreview.text}
          </span>
        )}
        <span style={{ marginLeft: "auto" }}>{note}</span>
      </div>
      {searched && matches === null && (autoPending || lookupState.status === "loading") && (
        <span style={{ fontSize: 12.5, color: "var(--pm-muted-foreground)" }}>Looking up {searched} in the directory…</span>
      )}
      {matches !== null && matches.length === 0 && (
        <span style={{ fontSize: 12.5, color: "var(--pm-muted-foreground)" }}>No directory match{searched ? ` for ${searched}` : ""}. Type a CWID or another name.</span>
      )}
      {matches !== null && matches.length > 0 && (
        <>
          {/* Wide content scrolls inside its own box rather than widening the row. */}
          <div style={{ overflowX: "auto" }}>
            <div role="radiogroup" aria-label="Directory matches" style={{ minWidth: 640, border: "1px solid var(--pm-border)", borderRadius: 8, background: "#fff", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: DIR_GRID, gap: 12, alignItems: "start", padding: "8px 12px 6px" }}>
                <span /><span style={dirHead}>Name · ID</span><span style={dirHead}>Org</span><span style={dirHead}>Title</span>
                <span style={dirHead}>Department(s)</span><span style={{ ...dirHead, textAlign: "right" }}>ReCiter</span>
              </div>
              {matches.map((m) => {
                // #1012: a cwid ED has RETIRED is SHOWN but not pickable — the opposite of the
                // candidate picker, which hides it. A curator typed this name and has to be told
                // what became of the person. Its click/Enter handlers are removed, not styled
                // away, so keyboard and mouse are blocked by the same fact. The assign route
                // refuses it independently; this only saves the round-trip.
                const on = pickedHit === `${m.source}:${m.id}`;
                const status = m.retiredCwid ? "cannot assign"
                  : m.hasIdentity ? "in ReCiter"
                    : m.wcmCwidHasIdentity ? `same person as ${m.wcmCwid}`
                      : "will create identity";
                return (
                  <div key={`${m.source}:${m.id}`} data-dir-hit={m.id}
                    {...((m.retiredCwid ? { "aria-disabled": true } : {
                      tabIndex: 0, role: "radio", "aria-checked": on,
                      onClick: (e) => { e.stopPropagation(); pick(m); },
                      onKeyDown: (e) => {
                        if (e.key !== "Enter" && e.key !== " ") return;
                        e.preventDefault(); e.stopPropagation(); pick(m);
                      },
                    }) as HTMLAttributes<HTMLDivElement>)}
                    className={m.retiredCwid ? undefined : "pm-dir-hit"}
                    style={{ display: "grid", gridTemplateColumns: DIR_GRID, gap: 12, alignItems: "start", padding: "8px 12px",
                      borderTop: "1px solid var(--pm-border)", fontSize: 12.5, lineHeight: 1.45,
                      background: on ? "var(--pm-slate-tint)" : undefined, cursor: m.retiredCwid ? "not-allowed" : "pointer",
                      color: m.retiredCwid ? "var(--pm-muted-foreground)" : undefined }}>
                    <span aria-hidden="true" style={{ marginTop: 3, width: 13, height: 13, borderRadius: "50%", boxSizing: "border-box", background: "#fff",
                      border: on ? "4px solid var(--pm-slate)" : "1.5px solid var(--pm-muted-foreground)", visibility: m.retiredCwid ? "hidden" : "visible" }} />
                    <span style={{ display: "flex", flexDirection: "column", minWidth: 0, overflowWrap: "anywhere" }}>
                      <span style={{ fontWeight: 600, textDecoration: m.retiredCwid ? "line-through" : undefined }}>{m.name}</span>
                      {/* the assembled legal name, only when it says something displayName does not */}
                      {m.fullName && <span style={{ color: "var(--pm-muted-foreground)" }}>{m.fullName}</span>}
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: m.retiredCwid ? "var(--pm-muted-foreground)" : "var(--pm-slate)" }}>{m.id}</span>
                      {/* #1020: the same human's identifier in the other directory. Picking still assigns to m.id. */}
                      {m.alsoId && <span style={{ fontSize: 11.5, color: "var(--pm-muted-foreground)" }}>also {m.alsoId}</span>}
                      {m.retiredCwid && (
                        <span style={{ color: "var(--pm-amber)", fontWeight: 600 }}>
                          Retired CWID{m.supersededBy ? <> — use <strong>{m.supersededBy}</strong></> : " — no replacement on record"}
                        </span>
                      )}
                    </span>
                    {/* ONE org column, and `weillCornellEduPrimaryOrg` wins it: ou=people carries
                        NewYork-Presbyterian people, so "found in WCM ED" is not "works at WCM".
                        The directory that answered, the institution a mint would write and the
                        full person-type list stay on the title attribute. */}
                    <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}
                      title={[
                        `found in ${m.source === "wcm" ? "WCM ED" : "Cornell directory"}`,
                        m.primaryInstitution ? `mints as ${m.primaryInstitution}` : null,
                        m.personTypes?.length ? m.personTypes.join(", ") : null,
                      ].filter(Boolean).join(" · ")}>
                      <span style={{ fontWeight: 600 }}>{m.primaryOrg || (m.source === "wcm" ? "WCM" : "Cornell")}</span>
                      {m.personTypes?.length > 0 && (
                        <span style={{ fontSize: 11.5, color: "var(--pm-muted-foreground)", overflowWrap: "anywhere" }}>
                          {m.personTypes[0]}{m.personTypes.length > 1 ? ` +${m.personTypes.length - 1}` : ""}
                        </span>
                      )}
                      {m.active === false && <span style={{ fontSize: 11.5, color: "var(--pm-muted-foreground)" }}>expired</span>}
                    </span>
                    <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{m.title || "—"}</span>
                    <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, overflowWrap: "anywhere" }}>
                      <span>{m.depts?.length ? m.depts.join(" · ") : (m.dept || "—")}</span>
                      {m.deptMatch && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--pm-slate)" }}>Named in byline</span>}
                    </span>
                    {/* What picking this row will do: land on an existing identity, redirect to the
                        same person's WCM identifier, or create one. Blank "since" is a real answer —
                        the directory may not serve that attribute to this bind. */}
                    <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1, textAlign: "right" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
                        color: m.retiredCwid ? "var(--pm-muted-foreground)" : m.hasIdentity || m.wcmCwidHasIdentity ? "var(--pm-slate)" : "var(--pm-amber)" }}>{status}</span>
                      {m.created && <span style={{ fontSize: 11, color: "var(--pm-muted-foreground)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>since {m.created}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <span style={{ fontSize: 12, color: "var(--pm-muted-foreground)" }}>
            {matches.length} match{matches.length === 1 ? "" : "es"}{searched ? ` for ${searched}` : ""} · department named in the byline first, then people already in ReCiter, then active
          </span>
        </>
      )}
    </div>
  );
};

const DIR_GRID = "16px minmax(0,1.2fr) minmax(0,0.75fr) minmax(0,1.4fr) minmax(0,1.3fr) 136px";

const counterpartBox: CSSProperties = {
  border: "1px solid #dde3ea", borderRadius: 8, padding: "10px 12px", marginBottom: 10, background: "#fafbfc",
};

// green/amber/grey field-comparison tint — "equal", "differ", "missing" (either side blank,
// which is a different fact from "differ" and shown differently so a curator never reads a
// blank-vs-blank pair as a confirmed mismatch).
type CompareState = "equal" | "differ" | "missing";
const compareState = (a: unknown, b: unknown, equal: boolean): CompareState => (!a || !b ? "missing" : equal ? "equal" : "differ");
const compareCellStyle = (state: CompareState): CSSProperties => ({
  padding: "4px 8px", borderRadius: 4,
  background: state === "equal" ? "var(--pm-slate-tint)" : state === "differ" ? "var(--pm-amber-tint)" : "transparent",
  color: state === "equal" ? "var(--pm-slate)" : state === "differ" ? "var(--pm-amber)" : "#94a3b8",
});
const emDash = <span style={{ color: "#94a3b8" }}>—</span>;

// Three writes, all on the standard onAction→doAction path (see doAction's undo suppression):
//  - accept/{samePmid:true}  — "same work, and this person wrote it": a real gold-standard
//    `known` write for matched_pmid, NOT an ExternalArticle. Server reads the PMID off the row.
//  - dismiss/{reason:"dup_of_matched_pmid"} — "same work, but that is all I am saying": closes
//    the scopus row as a duplicate and asserts nothing about who authored it. Composed
//    server-side (case "dismiss" in authorships.controller.ts).
//  - verdict/{verdict:"distinct"} — "different works". Only ever writes 'distinct'.
// The first two are deliberately separate buttons: deduplicating a row and attributing a
// publication to a person are different claims, and the panel is reachable without the curator
// having formed the second one. Accept only renders for a single_candidate row, because the
// server's MULTI_CANDIDATE guard turns multis away before it ever reaches the same-work branch.
const CounterpartActions = ({ row: r, acting, onAction }: {
  row: AuthorshipRow; acting: boolean; onAction: (action: string, extra?: Record<string, any>) => void;
}) => {
  // Same three preconditions the server enforces, so the button is never a dead end: a
  // multi-candidate row 409s (use "Pick one"), and a row whose proposed identity has no ReCiter
  // Identity record 422s — which is why the card's own right rail already withholds Accept for it
  // (identity_in_reciter===false renders the "No ReCiter identity" pill instead). Missing that
  // check here would put an Accept back on exactly the rows the rest of the UI hides it from.
  const canAcceptSame = !!r.single_candidate && r.matched_pmid != null && r.identity_in_reciter !== false;
  return (
  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
    {canAcceptSame && (
      <button style={btn("accept", acting)} disabled={acting}
        title={`Accept PMID ${r.matched_pmid} for ${r.top_name || r.top_cwid} — the same gold-standard write an Accept on the PubMed row makes`}
        onClick={(e) => { e.stopPropagation(); onAction("accept", { samePmid: true }); }}>
        {`Same paper — accept PMID ${r.matched_pmid}`}
      </button>
    )}
    <button style={btn(canAcceptSame ? "soft" : "accept", acting)} disabled={acting}
      onClick={(e) => { e.stopPropagation(); onAction("dismiss", { reason: "dup_of_matched_pmid" }); }}>
      Same paper — dismiss
    </button>
    <button style={btn("soft", acting)} disabled={acting}
      onClick={(e) => { e.stopPropagation(); onAction("verdict", { verdict: "distinct" }); }}>
      Different papers
    </button>
  </div>
  );
};

// The in-card empty state (prototype markup ~1222-1229): serif title, a muted line, and an
// outline "Reset filters" when a filter is on.
const EmptyState = ({ title, body, canReset, onReset }: { title: string; body: string; canReset: boolean; onReset: () => void }) => (
  <div data-empty style={{ padding: "64px 24px", textAlign: "center", display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
    <div style={{ fontFamily: "var(--font-display-serif)", fontSize: 22, fontWeight: 600, color: "var(--pm-foreground)" }}>{title}</div>
    <div style={{ fontSize: 13.5, color: "var(--pm-muted-foreground)", maxWidth: 460, textWrap: "pretty" } as CSSProperties}>{body}</div>
    {canReset && <div style={{ marginTop: 8 }}><Button variant="secondary" onClick={onReset}>Reset filters</Button></div>}
  </div>
);

const DuplicatesView = ({ rows, loading, listError, actingId, onRetry, onAction, onBack, empty, onReset, pager, conflicts, onClearConflict }: {
  rows: AuthorshipRow[]; loading: boolean; listError: boolean; actingId: number | null;
  // A 409/422 reply that asks the curator to confirm (doAction stores it here instead of
  // toasting it) must show on the pair, or the click would fail with no word at all.
  conflicts: Record<number, ConflictEntry>; onClearConflict: (id: number) => void;
  onRetry: () => void; onAction: (r: AuthorshipRow, action: string, extra?: Record<string, any>) => void; onBack: () => void;
  empty: { title: string; body: string; canReset: boolean } | null; onReset: () => void;
  pager: { page: number; totalPages: number; count: number; setPage: (f: (p: number) => number) => void } | null;
}) => (
  <div data-dups-view>
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 16px", borderBottom: "1px solid var(--pm-border)", background: "var(--pm-surface-2)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 320px", minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pm-foreground)" }}>Duplicate records</span>
        <span style={{ fontSize: 12.5, color: "var(--pm-muted-foreground)" }}>The same paper came in from both PubMed and Scopus. Keep one record so the authorship is counted once.</span>
      </div>
      <Button variant="ghost" size="sm" onClick={onBack}>Back to open queue</Button>
    </div>
    {loading && <div role="status" style={{ padding: "48px 24px", textAlign: "center", fontSize: 13.5, color: "var(--pm-muted-foreground)" }}>Loading duplicate records…</div>}
    {!loading && listError && (
      <div role="alert" style={{ padding: "40px 24px", textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-display-serif)", fontSize: 20, fontWeight: 600, color: "var(--pm-foreground)", marginBottom: 6 }}>Couldn&rsquo;t load authorships</div>
        <div style={{ fontSize: 13.5, color: "var(--pm-muted-foreground)", marginBottom: 14 }}>The server didn&rsquo;t answer. Your filters are kept; try again in a moment.</div>
        <Button variant="secondary" onClick={onRetry}>Retry</Button>
      </div>
    )}
    {!loading && !listError && rows.map((r) => (
      <DupPair key={r.id} row={r} acting={actingId === r.id} onAction={(action, extra) => onAction(r, action, extra)}
        conflict={conflicts[r.id]} onClearConflict={() => onClearConflict(r.id)} />
    ))}
    {!loading && empty && <EmptyState {...empty} onReset={onReset} />}
    {!loading && !listError && pager && (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, padding: "8px 16px", fontSize: 11.5, color: "var(--pm-muted-foreground)" }}>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{pager.count.toLocaleString()} pairs · page {pager.page + 1} of {pager.totalPages}</span>
        <button type="button" disabled={pager.page === 0} onClick={() => pager.setPage((p) => Math.max(0, p - 1))} style={pagerBtn(pager.page === 0)}>Previous</button>
        <button type="button" disabled={pager.page + 1 >= pager.totalPages} onClick={() => pager.setPage((p) => p + 1)} style={pagerBtn(pager.page + 1 >= pager.totalPages)}>Next</button>
      </div>
    )}
  </div>
);

// ---- Duplicate records (UI refresh PR 6, prototype markup ~1237-1268) ----------------------
// The duplicates queue as pairs instead of authorship rows: a grey band with the queue's title
// and "Back to open queue", then one pair per row — the title and "Suggested identity", two
// buttons, and the two records side by side. Every button is one of the writes the row already
// had (CounterpartActions / the dup-conflict banner); nothing new reaches the server.
//  - PubMed-twin rows (matched_pmid, no verdict yet): "Not duplicates" = verdict distinct,
//    "Keep PubMed record" = dismiss as dup_of_matched_pmid, and, where the server allows it, the
//    "same paper, and theirs" accept of the PMID.
//  - Rows parked by a dup-check 409 on Accept (accept_conflict): "Not duplicates" re-sends the
//    accept (or the assign to the proposed identity) with force, "Keep the existing record"
//    dismisses the row.
const dupRecBox: CSSProperties = {
  padding: "10px 12px", borderRadius: 8, border: "1px solid var(--pm-border)", background: "var(--pm-page)",
  display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, minWidth: 0,
};
const dupSrcBadge: CSSProperties = { height: 20, padding: "0 6px", display: "inline-flex", alignItems: "center", borderRadius: 4, background: "var(--pm-slate-tint)", color: "var(--pm-slate)", fontSize: 11, fontWeight: 600, letterSpacing: "0.03em", flexShrink: 0 };
const dupIdText: CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--pm-muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const DupRecord = ({ src, id, author, line }: { src: string; id: string; author?: string; line?: string }) => (
  <div style={dupRecBox}>
    <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
      <span style={dupSrcBadge}>{src}</span>
      <span style={dupIdText}>{id}</span>
    </div>
    {author && <span style={{ fontWeight: 600 }}>{author}</span>}
    {line && <span style={{ color: "var(--pm-muted-foreground)", lineHeight: 1.45 }}>{line}</span>}
  </div>
);

// The "Existing record" side of a pair parked by a dup-check 409 on Accept: what the check matched
// (accept_conflict_matches), not its message, which names an API flag and nothing a curator can
// act on. Rows parked before the column existed, and not backfilled yet, get a plain sentence.
const PARKED_MATCHES_SHOWN = 3;
const ParkedConflictRecord = ({ row: r }: { row: AuthorshipRow }) => {
  const stored = parseStoredConflict(r.accept_conflict_matches);
  const who = stored?.name || (stored?.uid && stored.uid === r.top_cwid ? r.top_name : stored?.uid) || r.top_name || r.top_cwid;
  if (!stored) {
    return (
      <div style={dupRecBox} data-parked-conflict="none">
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={dupSrcBadge}>Existing record</span>
        </div>
        <span style={{ color: "var(--pm-muted-foreground)", lineHeight: 1.45 }}>
          The duplicate check flagged a possible match already in {who ? `${who}'s` : "this person's"} record or PubMed
          candidates, but which one was not saved. Compare on their{" "}
          {r.top_cwid
            ? <a href={`/curate/${r.top_cwid}`} target="_blank" rel="noreferrer" style={{ color: "var(--pm-slate)" }}>curation page</a>
            : "curation page"} before deciding.
        </span>
      </div>
    );
  }
  const shown = stored.matches.slice(0, PARKED_MATCHES_SHOWN);
  const more = stored.matches.length - shown.length;
  return (
    <div style={{ ...dupRecBox, gap: 10 }} data-parked-conflict={stored.matches.length}>
      {shown.map((m, i) => {
        const idText = matchIdText(m);
        const doiText = m.doi && m.idLabel !== "DOI" ? `DOI ${m.doi}` : "";
        return (
          <div key={i} data-parked-match style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, ...(i ? { paddingTop: 10, borderTop: "1px solid var(--pm-border)" } : {}) }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
              <span style={dupSrcBadge}>{m.source}</span>
              {idText && (
                m.idLabel === "PMID"
                  ? <a href={`https://pubmed.ncbi.nlm.nih.gov/${m.id}/`} target="_blank" rel="noreferrer" style={{ ...dupIdText, color: "var(--pm-slate)", textDecoration: "none" }}>{idText}</a>
                  : <span style={dupIdText}>{idText}</span>
              )}
            </div>
            {doiText && <span style={{ ...dupIdText, fontSize: 11.5 }}>{doiText}</span>}
            {m.title
              ? <span style={{ fontWeight: 600, lineHeight: 1.4 }} dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(m.title) }} />
              : <span style={{ color: "var(--pm-muted-foreground)" }}>Title not recorded</span>}
            {(m.journal || m.pubYear) && (
              <span style={{ color: "var(--pm-muted-foreground)" }}>
                {m.journal && <em dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(m.journal) }} />}
                {m.journal && m.pubYear ? " · " : ""}{m.pubYear}
              </span>
            )}
            <span style={{ color: "var(--pm-muted-foreground)", fontSize: 12 }}>{matchWhereText(m, who)}</span>
          </div>
        );
      })}
      {more > 0 && <span style={{ color: "var(--pm-muted-foreground)", fontSize: 12 }}>and {more} more possible match{more === 1 ? "" : "es"}</span>}
    </div>
  );
};

// The PubMed side of a twin pair comes from the read-only counterpart route, fetched per pair.
const useCounterpart = (id: number, enabled: boolean) => {
  const [state, setState] = useState<{ status: "loading" | "error" | "loaded"; data?: CounterpartResponse }>({ status: "loading" });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState({ status: "loading" });
    fetch("/api/db/authorships/counterpart", { credentials: "same-origin", method: "POST", headers: apiHeaders, body: JSON.stringify({ id }) })
      .then(async (resp) => { if (!resp.ok) throw new Error(`HTTP ${resp.status}`); return resp.json(); })
      .then((d: CounterpartResponse) => { if (!cancelled) setState({ status: "loaded", data: d }); })
      .catch(() => { if (!cancelled) setState({ status: "error" }); });
    return () => { cancelled = true; };
  }, [id, enabled]);
  return state;
};

const DupPair = ({ row: r, acting, onAction, conflict, onClearConflict }: {
  row: AuthorshipRow; acting: boolean; onAction: (action: string, extra?: Record<string, any>) => void;
  conflict?: ConflictEntry; onClearConflict: () => void;
}) => {
  const twin = r.matched_pmid != null && !r.matched_pmid_verdict;
  const cp = useCounterpart(r.id, twin);
  const srcLabel = externalSourceLabel(r);
  const dateText = formatRowDate(r.entrez_date);
  const canAcceptSame = twin && !!r.single_candidate && r.identity_in_reciter !== false;
  const surname = (r.wcm_author || "").trim().split(/\s+/).pop()?.toLowerCase() || "";
  const pm = cp.data?.pubmed;
  const pmAuthor = pm?.authors.find((a) => (a.lastName || "").toLowerCase() === surname);
  const extId = r.external_id ? String(r.external_id) : "";
  return (
    <div data-dup-pair={r.id} style={{ padding: "14px 16px", borderBottom: "1px solid var(--pm-border)", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 360px", minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.4 }} dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(r.title) }} />
          <span style={{ fontSize: 12.5, color: "var(--pm-muted-foreground)" }}>
            {r.journal && <em dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(r.journal) }} />}
            {dateText && <>{r.journal ? " · " : ""}{dateText}</>}
            {r.top_cwid && (
              <>{(r.journal || dateText) ? " · " : ""}Suggested identity{" "}
                <a href={`/curate/${r.top_cwid}`} target="_blank" rel="noreferrer" style={{ color: "var(--pm-slate)", textDecoration: "none" }}>{r.top_name || r.top_cwid}</a>
              </>
            )}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {twin ? (
            <>
              {canAcceptSame && (
                <Button variant="ghost" size="sm" disabled={acting}
                  title={`Same paper, and ${r.top_name || r.top_cwid} wrote it: accept PMID ${r.matched_pmid} for them (the same write an Accept on the PubMed row makes)`}
                  onClick={() => onAction("accept", { samePmid: true })}>
                  Accept PMID {r.matched_pmid}
                </Button>
              )}
              <Button variant="secondary" size="sm" disabled={acting}
                title="Different papers. The row goes back to the open queue and won't be flagged again."
                onClick={() => onAction("verdict", { verdict: "distinct" })}>Not duplicates</Button>
              <Button variant="primary" size="sm" disabled={acting}
                title={`Same paper. Closes this ${srcLabel} row as a duplicate of PMID ${r.matched_pmid}; says nothing about who wrote it.`}
                onClick={() => onAction("dismiss", { reason: "dup_of_matched_pmid" })}>Keep PubMed record</Button>
            </>
          ) : (
            <>
              {r.top_cwid && r.identity_in_reciter !== false && (
                <Button variant="secondary" size="sm" disabled={acting}
                  title={`Not the same paper: add this ${srcLabel} record for ${r.top_name || r.top_cwid} anyway`}
                  onClick={() => (r.single_candidate ? onAction("accept", { force: "true" }) : onAction("assign", { cwid: r.top_cwid, force: "true" }))}>
                  Not duplicates
                </Button>
              )}
              <Button variant="primary" size="sm" disabled={acting}
                title={`Same paper: close this ${srcLabel} row and keep the record already there`}
                onClick={() => onAction("dismiss")}>Keep the existing record</Button>
            </>
          )}
        </div>
      </div>
      <div className="pm-dup-recs" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        {twin ? (
          cp.status === "loaded" && pm ? (
            <DupRecord src="PubMed" id={`PMID ${pm.pmid}`}
              author={pmAuthor ? `${pmAuthor.lastName} ${pmAuthor.initials || ""}`.trim() : undefined}
              line={[pm.journal, pm.year, cp.data?.inRecordFor.length ? `in the record of ${cp.data.inRecordFor.join(", ")}` : ""].filter(Boolean).join(" · ") || undefined} />
          ) : (
            <DupRecord src="PubMed" id={`PMID ${r.matched_pmid}`}
              line={cp.status === "loading" ? "Loading the PubMed record…" : "The PubMed record could not be fetched."} />
          )
        ) : (
          <ParkedConflictRecord row={r} />
        )}
        <DupRecord src={srcLabel} id={extId} author={r.wcm_author || undefined} line={r.author_affiliation || undefined} />
      </div>
      {conflict && <ConflictPrompt conflict={conflict} fallbackAuthor={r.wcm_author} onAction={onAction} onClear={onClearConflict} margin="0" />}
    </div>
  );
};

// PubMed-twin adjudication panel (#951 Layer 2) — mounted in the isExpanded block for any row
// carrying a producer-flagged matched_pmid. Fetches POST /api/db/authorships/counterpart on
// first expand (nothing here is pre-fetched before the card opens, same as SingleEvidence/
// MultiEvidence beside it). The PubMed fetch inside that route can itself fail (retrieval tool
// down/slow) — that degrades to fetchError with an HTTP 200, handled below; only a failure of
// OUR OWN /api/db/authorships/counterpart call (network error, non-200) is the local "error"
// state, and even then the two action buttons still render — they act on the Scopus row alone.
const CounterpartPanel = ({ row: r, acting, onAction }: {
  row: AuthorshipRow; acting: boolean; onAction: (action: string, extra?: Record<string, any>) => void;
}) => {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "loaded"; data: CounterpartResponse }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetch("/api/db/authorships/counterpart", {
      credentials: "same-origin", method: "POST", headers: apiHeaders,
      body: JSON.stringify({ id: r.id }),
    })
      .then(async (resp) => {
        if (!resp.ok) throw new Error((await resp.text()) || `HTTP ${resp.status}`);
        return resp.json();
      })
      .then((d: CounterpartResponse) => { if (!cancelled) setState({ status: "loaded", data: d }); })
      .catch((e) => { if (!cancelled) setState({ status: "error", message: String(e?.message || e) }); });
    return () => { cancelled = true; }; // card can collapse/re-expand or the row can resolve mid-fetch
  }, [r.id]);

  const pmid = r.matched_pmid as number; // only mounted when r.matched_pmid != null

  if (state.status === "loading") {
    return <div style={{ ...counterpartBox, color: "#94a3b8" }}>Loading PubMed record {pmid}…</div>;
  }
  if (state.status === "error") {
    return (
      <div style={counterpartBox}>
        <div style={{ display: "flex", gap: 7, fontSize: 12.5, color: "var(--pm-amber)", marginBottom: 10 }}>
          <IconAlert size={15} style={{ marginTop: 1 }} />
          <span>PubMed record {pmid} could not be fetched ({state.message}).</span>
        </div>
        <CounterpartActions row={r} acting={acting} onAction={onAction} />
      </div>
    );
  }

  const { scopus, pubmed, fetchError, inRecordFor, pubmedLaneRow, compare } = state.data;
  const titleState = compareState(scopus.title, pubmed?.title, compare.titleEqual);
  const journalState = compareState(scopus.journal, pubmed?.journal, compare.journalEqual);
  const yearState = compareState(scopus.year, pubmed?.year, compare.yearEqual);
  const doiState: CompareState = compare.doiEqual == null ? "missing" : compare.doiEqual ? "equal" : "differ";
  const scopusAuthorLine = scopus.authors.map((a) => `${a.given} ${a.surname}`.trim()).filter(Boolean).join(", ");
  const pubmedAuthorLine = (pubmed?.authors || []).map((a) => `${a.foreName} ${a.lastName}`.trim()).filter(Boolean).join(", ");

  return (
    <div style={counterpartBox}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
        Possible PubMed twin — PMID {pmid}
      </div>

      {/* fetchError NEVER means an empty column — the Scopus side and the actions still render;
          this is a heads-up that the right-hand column below is blank because of a fetch
          failure, not because PubMed genuinely has no data for those fields. */}
      {fetchError && (
        <div style={{ display: "flex", gap: 7, fontSize: 12.5, marginBottom: 10, color: "var(--pm-amber)", background: "var(--pm-amber-tint)", borderRadius: 7, padding: "8px 10px" }}>
          <IconAlert size={15} style={{ marginTop: 1 }} />
          <span>PubMed record {pmid} could not be fetched ({fetchError}).</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 1fr", gap: "5px 12px", fontSize: 12.5, alignItems: "start" }}>
        <div />
        <div style={{ fontWeight: 700, color: "#475569" }}>{externalSourceLabel(r)} record</div>
        <div style={{ fontWeight: 700, color: "#475569" }}>PubMed record</div>

        <div style={{ color: "#94a3b8" }}>Title</div>
        <div style={compareCellStyle(titleState)}>{scopus.title || emDash}</div>
        <div style={compareCellStyle(titleState)}>{pubmed?.title || emDash}</div>

        <div style={{ color: "#94a3b8" }}>Journal</div>
        <div style={compareCellStyle(journalState)}>{scopus.journal || emDash}</div>
        <div style={compareCellStyle(journalState)}>{pubmed?.journal || emDash}</div>

        <div style={{ color: "#94a3b8" }}>Year</div>
        <div style={compareCellStyle(yearState)}>{scopus.year || emDash}</div>
        <div style={compareCellStyle(yearState)}>{pubmed?.year || emDash}</div>

        <div style={{ color: "#94a3b8" }}>DOI</div>
        <div style={compareCellStyle(doiState)}>{scopus.doi || emDash}</div>
        <div style={compareCellStyle(doiState)}>{pubmed?.doi || emDash}</div>

        <div style={{ color: "#94a3b8" }}>Authors</div>
        <div style={{ padding: "4px 8px" }}>{scopusAuthorLine || emDash}</div>
        <div style={{ padding: "4px 8px" }}>{pubmedAuthorLine || emDash}</div>
      </div>
      <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 3 }}>
        {compare.sharedSurnames} of {compare.scopusAuthorCount} {externalSourceLabel(r)} surname{compare.scopusAuthorCount === 1 ? "" : "s"} shared with PubMed
      </div>

      {/* the TWIN's pmid, not this row's — a scopus row has none of its own, so the card's
          meta line shows nothing here and this stays the only place to reach it. */}
      <div style={{ marginTop: 10 }}><PmidCite pmid={pmid} /></div>

      <div style={{ fontSize: 12.5 }}>
        {inRecordFor.length > 0
          ? `Already in the record of: ${inRecordFor.join(", ")}`
          : "Not in any candidate's record"}
      </div>
      <div style={{ fontSize: 12.5, marginTop: 2, color: "#64748b" }}>
        {pubmedLaneRow ? (
          `Also proposed in the PubMed lane (row #${pubmedLaneRow.id}, ${pubmedLaneRow.status})`
        ) : r.top_cwid ? (
          <>
            PubMed record {pmid} was never proposed for a WCM person — add it from{" "}
            <a href={`/curate/${r.top_cwid}`} target="_blank" rel="noreferrer"
              onClick={(e) => e.stopPropagation()} style={{ color: "var(--pm-slate)" }}>
              /curate/{r.top_cwid}
            </a>{" "}
            if it belongs to them
          </>
        ) : (
          `PubMed record ${pmid} was never proposed for a WCM person, and this row has no proposed identity to add it from.`
        )}
      </div>

      <CounterpartActions row={r} acting={acting} onAction={onAction} />
    </div>
  );
};

export default AuthorshipsTabs;
