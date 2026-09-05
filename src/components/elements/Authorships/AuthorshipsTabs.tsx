import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Popover from "@mui/material/Popover";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Checkbox from "@mui/material/Checkbox";
import { reciterConfig } from "../../../../config/local";
import { sanitizeInlineHtml, stripHtml } from "../../../utils/htmlText";
import {
  isAcceptEligible, isBulkSelectable,
  unionCandidates, partitionForAssign, assignConfirmFlags, bucketAssignFailures,
  bucketRejectFailures,
  typedCwidPreview,
} from "../../../lib/bulkAssign";
import type { CandidateLite, TypedCwidLookupState } from "../../../lib/bulkAssign";

// ---- types ---------------------------------------------------------------
interface AuthorshipRow {
  id: number;
  pmid: number;
  author_key: string;
  // Scopus lane (source='scopus'): not-in-PubMed docs from the AF-ID sweep. pmid is null,
  // top_fg_score/top_io_score are null (production never scored a non-PubMed doc), and the
  // record is keyed by external_id (numeric Scopus id). PubMed rows leave these undefined.
  source?: "pubmed" | "scopus";
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
  source?: "pubmed" | "scopus";
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
  names: Array<{ first: string; last: string; n: number }>;
  accepted: number;
  more?: number;
}

interface Candidate {
  cwid: string;
  name?: string;
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
}

interface Summary {
  total: number; single_candidate: number; classes: Record<string, number>;
  fullname?: number;                                 // single-candidate AND full given-name match
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
  // ABSENT unless the request carried `includeAuthorInstitutions: true` — its 12 byline LIKEs
  // cost 563 ms of a 896 ms endpoint on production, so they are opt-in (see fetchSummary).
  // Absent means "not computed": render a loading state, never a zero. Present-and-[] is a
  // different, legitimate answer ("computed, no bucket matched") and the server never conflates
  // the two.
  authorInstitutions?: Array<{ key: string; n: number }>;
}

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
};

const CLASS_META: Record<string, { label: string; color: string; hint: string }> = {
  buried: { label: "Buried", color: "#b42318", hint: "Production buried it (Authorship Score < 30)" },
  absent: { label: "Never retrieved", color: "#8a5a00", hint: "Production never scored this person" },
  suggested: { label: "Suggested", color: "#475467", hint: "Already in a curator's pending queue (Authorship Score ≥ 30)" },
  assigned: { label: "Assigned", color: "#067647", hint: "Accepted by a WCM person" },
};

const ACTION_LABEL: Record<string, string> = {
  accept: "Accepted", reject: "Rejected", snooze: "Snoozed for 90 days", dismiss: "Dismissed", assign: "Assigned",
};

// row STATUS -> display verb for the "Recent activity" panel. Distinct from ACTION_LABEL above
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
  lane: "fullname" | "single" | "all";
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
  source: "all" | "pubmed" | "scopus";
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
  selectedAuthorAffiliations: [],                        // article affiliation = any
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

// Two filter values are "the same" when a write of one over the other is a no-op. Arrays are
// compared by content because several call sites re-set an already-empty list (the
// source-leaves-scopus reset, "Clear selection"); with one shared object a fresh [] would
// otherwise look like a change and cost a refetch plus the curator's selection.
const sameFilterValue = (a: any, b: any): boolean => {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => v === b[i]);
  return Object.is(a, b);
};

// MATCH CLASS (HANDOFF §2.3) is the union of today's two chip strips — the lane strip
// (fullname / single / all) and the classification strip — as ONE single-select list in the
// mockup's order (mockup:488-496). Picking a lane value resets classification to its all-value
// and vice versa, which is why 7 entries cover 3 lane values + 4 classification values.
const LANE_LABEL: Record<AuthorshipFilters["lane"], string> = {
  all: "All unassigned", fullname: "Unique and full given-name match", single: "High-precision",
};
const MATCH_CLASS_DEFAULT = LANE_LABEL.all;
// `hint` is the tooltip the deleted strips carried (they are the only place these explanations
// lived); `count` is the right-aligned number the popover shows (§2.3), read off the same
// summary facets the strips used — no new server field.
type MatchClassOption = {
  label: string;
  lane: AuthorshipFilters["lane"];
  classification: AuthorshipFilters["classification"];
  hint: string;
  count: (s: Summary | null) => number | undefined;
};
const MATCH_CLASS_OPTIONS: MatchClassOption[] = [
  { label: LANE_LABEL.all, lane: "all", classification: "all", hint: "Every unassigned authorship", count: (s) => s?.total },
  {
    label: LANE_LABEL.fullname, lane: "fullname", classification: "all",
    hint: "Exactly one WCM identity matches AND the given name matches in full (not just the initial). Curators have accepted 4,723 of these and rejected none; the initial-only rows next door were rejected 373 times.",
    count: (s) => s?.fullname,
  },
  {
    label: LANE_LABEL.single, lane: "single", classification: "all",
    hint: "Only authorships where exactly one WCM identity matches the name",
    count: (s) => s?.single_candidate,
  },
  { label: CLASS_META.suggested.label, lane: "all", classification: "suggested", hint: CLASS_META.suggested.hint, count: (s) => s?.classes?.suggested },
  { label: CLASS_META.buried.label, lane: "all", classification: "buried", hint: CLASS_META.buried.hint, count: (s) => s?.classes?.buried },
  { label: CLASS_META.absent.label, lane: "all", classification: "absent", hint: CLASS_META.absent.hint, count: (s) => s?.classes?.absent },
  // SIX options, not the mockup's seven. Its 7th, "All classes", is the classification strip's
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
// including its two quirks: the source segment is never a chip, and the search box IS one.
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
  // Article affiliation (mockup:619). Unlike the identity list its default is EMPTY, so there
  // is no "any" chip to render — every selected value is off-default by definition.
  f.selectedAuthorAffiliations.forEach((v) => out.push({
    id: `authorAffil:${v}`, label: `Article affil: ${INSTITUTION_LABELS[v] || v}`,
    patch: { selectedAuthorAffiliations: f.selectedAuthorAffiliations.filter((x) => x !== v) },
  }));
  if (datePreset !== DEFAULT_DATE_PRESET)
    out.push({ id: "date", label: `Date: ${DATE_PRESET_LABEL[datePreset] || datePreset}`, patch: {}, preset: DEFAULT_DATE_PRESET });
  if (f.hideNoSuggestion) out.push({ id: "hideNoSuggestion", label: "Hiding no suggested identity", patch: { hideNoSuggestion: false } });
  if (f.hideNoIdentity) out.push({ id: "hideNoIdentity", label: "Hiding no ReCiter identity", patch: { hideNoIdentity: false } });
  if (f.search.trim()) out.push({ id: "search", label: `“${f.search.trim()}”`, patch: { search: "" } });
  // likeAuthor ("Show N others like this") has no counterpart in the mockup, which never saw
  // the filter. It used to render its own dismissible "Like: …" pill beside the search box;
  // phase 3 folds it in here, because the row's whole promise (§2.2 point 2) is that the
  // filters in effect are listed in ONE place — a filter with a private pill elsewhere breaks
  // that, and the Filters badge, being chips.length, would undercount it.
  if (f.likeAuthor.trim()) out.push({ id: "like", label: `Like: ${f.likeAuthor.trim()}`, patch: { likeAuthor: "" } });
  return out;
};

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
const IconPin = (p: IconProps) => <Icon {...p}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></Icon>;
const IconInfo = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></Icon>;
const IconAlert = (p: IconProps) => <Icon {...p}><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" /><path d="M12 9v4M12 17h.01" /></Icon>;
const IconMore = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></Icon>;
const IconUsers = (p: IconProps) => <Icon {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></Icon>;
const IconCopy = (p: IconProps) => <Icon {...p}><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></Icon>;
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

// Wrap the WCM institution token in <mark>. Returns React nodes (one match).
const highlightAffiliation = (text?: string): ReactNode => {
  if (!text) return null;
  const m = text.match(WCM_RE);
  if (!m || m.index === undefined) return text;
  const before = text.slice(0, m.index);
  const matched = text.slice(m.index, m.index + m[0].length);
  const after = text.slice(m.index + m[0].length);
  return (
    <>
      {before}
      <mark style={{ background: "#f0fdf4", color: "#15803d", padding: "0 3px", borderRadius: 3, fontWeight: 600 }}>{matched}</mark>
      {after}
    </>
  );
};

// IO color band (F2): >=90 green, 50-89 amber, <50 muted grey
const ioColor = (v?: number) => (v == null ? "#94a3b8" : v >= 90 ? "#15803d" : v >= 50 ? "#b45309" : "#94a3b8");
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
const rowCandidateLites = (row: AuthorshipRow): CandidateLite[] =>
  row.single_candidate
    ? (row.top_cwid ? [{ cwid: row.top_cwid, name: row.top_name }] : [])
    : parseCandidates(row.candidate_cwids_json).map((c) => ({ cwid: c.cwid, name: c.name }));

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
const dateLabel = (source?: string) => (source === "scopus"
  ? { label: "Cover date", tip: "Scopus cover date (prism:coverDate) — the issue date Scopus carries for this document. This lane is not in PubMed, so there is no Entrez date." }
  : { label: "Indexed", tip: "Date NCBI indexed this record (Entrez date), not the publication date — for a record indexed late the two can differ by years. authorship_review has no publication-date column." });

// inline IO/FG explanation (F8)
const ioFgNote = (r: AuthorshipRow): string => {
  if (r.top_io_score == null) {
    const wcm = hasWcm(r.author_affiliation);
    return wcm
      ? `Never retrieved — no IO/Authorship Score. The affiliation names Weill Cornell${r.top_dept ? ` and the department (${r.top_dept})` : " and the surname is unique"}; production never scored this person.`
      : `Never retrieved — no IO/Authorship Score. The surname is unique among WCM identities (${r.top_cohort_size ?? 1} homonym); production never scored this person.`;
  }
  const io = fmtScore(r.top_io_score);
  const fg = fmtScore(r.top_fg_score);
  if (hasWcm(r.author_affiliation)) {
    return `IO ${io} — unique match; Authorship Score fell to ${fg} even though the affiliation names Weill Cornell — production under-scored a clear WCM authorship.`;
  }
  return `IO ${io} — name uniquely matches ${r.top_cwid || "this identity"} (${r.top_cohort_size ?? 1} WCM homonym); Authorship Score fell to ${fg} because the affiliation names an external institution, not WCM. Identity carries it.`;
};

// scopus lane note — no PubMed record, so no production/IO score; ranked by matcher confidence.
const scopusNote = (r: AuthorshipRow): string => {
  const cohort = r.top_cohort_size ?? 1;
  const who = hasWcm(r.author_affiliation)
    ? "The affiliation names Weill Cornell"
    : `The surname matches ${cohort} WCM identit${cohort === 1 ? "y" : "ies"}`;
  return `Not in PubMed — found via the Scopus AF-ID sweep, so production never scored it (no IO/Authorship Score exists). ${who}; ranked by identity-match confidence (${confBand(r.top_confidence)}). Accepting adds it as an ExternalArticle (no PMID → not gold standard).`;
};

const btn = (variant: "accept" | "reject" | "soft" | "ghost", disabled?: boolean): CSSProperties => {
  const base: CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 7, padding: "6px 12px",
    font: "inherit", fontSize: 13, fontWeight: 600, cursor: disabled ? "default" : "pointer",
    border: "1px solid transparent", whiteSpace: "nowrap", opacity: disabled ? 0.5 : 1,
  };
  if (variant === "accept") return { ...base, background: "#16a34a", color: "#fff" };
  if (variant === "reject") return { ...base, background: "#fff", color: "#b91c1c", borderColor: "#fecaca" };
  if (variant === "soft") return { ...base, background: "#f0fdf4", color: "#15803d", borderColor: "#bbf7d0" };
  return { ...base, background: "#fff", color: "#475569", borderColor: "#dde3ea" };
};
const iconBtn = (disabled?: boolean): CSSProperties => ({
  background: "transparent", border: "none", color: "#94a3b8", padding: 6, borderRadius: 6,
  cursor: disabled ? "default" : "pointer", display: "inline-flex", opacity: disabled ? 0.5 : 1,
});

// signal chips (F7)
const Chip = ({ kind, children, style }: { kind: "ok" | "warn" | "neutral"; children: ReactNode; style?: CSSProperties }) => {
  const styles: Record<string, CSSProperties> = {
    ok: { background: "#f0fdf4", color: "#15803d", borderColor: "transparent" },
    warn: { background: "#fffbeb", color: "#b45309", borderColor: "transparent" },
    neutral: { background: "#fff", color: "#475569", borderColor: "#dde3ea" },
  };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, padding: "2px 9px",
      borderRadius: 6, border: "1px solid #dde3ea", ...styles[kind], ...style,
    }}>{children}</span>
  );
};

const outLinkStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600,
  color: "#2563eb", textDecoration: "none",
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
const PmidCite = ({ pmid }: { pmid: number }) => {
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
        style={{ color: "#2563eb", textDecoration: "none", fontVariantNumeric: "tabular-nums" }}>
        PMID {pmid}
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
          color: copied ? "#146c39" : "#6f7889", flex: "none" }}>
        {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
      </button>
    </span>
  );
};

// ---- Scopus lane bits ----------------------------------------------------
const scopusRecordUrl = (externalId?: string) =>
  externalId ? `https://www.scopus.com/record/display.uri?eid=2-s2.0-${externalId}&origin=inward` : undefined;

const scopusBadgeStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em",
  padding: "2px 7px", borderRadius: 5, background: "#eef2ff", color: "#4338ca", textTransform: "uppercase",
};
const notInPubmedPillStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "2px 8px",
  borderRadius: 20, background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa", whiteSpace: "nowrap",
};
// replaces the Accept button when the proposed identity has no ReCiter Identity record
const noIdentityPillStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "5px 10px",
  borderRadius: 20, background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0", whiteSpace: "nowrap",
  cursor: "help",
};
// replaces the Accept button when the proposed identity already rejected this exact pmid
const alreadyRejectedPillStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "5px 10px",
  borderRadius: 20, background: "#fef2f2", color: "#b42318", border: "1px solid #fecaca", whiteSpace: "nowrap",
  cursor: "help",
};

// Scopus evidence lead: no PMID — Scopus record + DOI links (mirrors PmidLink's slot).
const ScopusLinks = ({ row: r }: { row: AuthorshipRow }) => {
  const scopusUrl = scopusRecordUrl(r.external_id);
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 9, flexWrap: "wrap" }}>
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

// §2.6's 296px identity hover card (mockup:337-369). Name + CWID, then whatever of
// department / division / affiliation the row actually carries, then the byline names this
// person has already published under.
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
const IdentityHoverCard = ({ row: r, priorNames }: { row: AuthorshipRow; priorNames?: PriorNames }) => {
  const hasDetail = !!(r.top_dept || r.top_division || r.top_institution);
  return (
    <span onClick={(e) => e.stopPropagation()}
      style={{ position: "absolute", top: "100%", left: 0, zIndex: 60, width: 296, paddingTop: 8, display: "block", cursor: "default" }}>
      <span style={{
        display: "flex", flexDirection: "column", gap: 10, background: "#fff", border: `1px solid ${CTRL.border}`,
        borderRadius: 8, boxShadow: "0 14px 34px rgba(27,36,50,0.18)", padding: "13px 15px",
        fontWeight: 400, letterSpacing: 0, color: CTRL.ink }}>
        <span style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{r.top_name || r.top_cwid}</span>
          <span style={{ fontSize: 13, color: CTRL.accent }}>{r.top_cwid}</span>
        </span>
        {hasDetail && (
          <span style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 13, color: "#4a5262", lineHeight: 1.45 }}>
            {r.top_dept && <span>{r.top_dept}</span>}
            {r.top_division && <span style={{ color: "#6f7889" }}>{r.top_division}</span>}
            {r.top_institution && <span style={{ color: "#6f7889" }}>{r.top_institution}</span>}
          </span>
        )}
        <span style={{ display: "flex", flexDirection: "column", gap: 4, borderTop: `1px solid ${CTRL.rule}`, paddingTop: 9 }}>
          {!priorNames ? (
            <span style={{ fontSize: 13, color: "#6f7889" }}>Loading…</span>
          ) : priorNames.accepted === 0 ? (
            <span style={{ fontSize: 13, color: "#6f7889" }}>No accepted papers yet</span>
          ) : priorNames.names.length === 0 ? (
            <span style={{ fontSize: 13, color: "#6f7889" }}>
              {priorNames.accepted.toLocaleString()} accepted paper{priorNames.accepted === 1 ? "" : "s"}, none with a byline name recorded
            </span>
          ) : (
            <>
              <span style={{ fontSize: 11, letterSpacing: ".1em", color: "#6b7484" }}>NAMES ON ACCEPTED PAPERS</span>
              {priorNames.names.map((p, i) => (
                <span key={`${p.last}|${p.first}|${i}`}
                  style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
                  <span style={{ color: CTRL.ink }}>{`${p.first} ${p.last}`.trim()}</span>
                  <span style={{ color: "#6f7889", fontVariantNumeric: "tabular-nums" }}>{p.n.toLocaleString()}</span>
                </span>
              ))}
              {!!priorNames.more && (
                <span style={{ fontSize: 12, color: "#8b93a2" }}>+{priorNames.more.toLocaleString()} more form{priorNames.more === 1 ? "" : "s"}</span>
              )}
            </>
          )}
        </span>
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
  // One anchor per popover level (HANDOFF §2.2/§2.3). MUI positions a Popover from the element
  // it is handed, so the two affiliation lists share ONE anchor only because they share one
  // popover; a nested level would need its own.
  const [typeAnchor, setTypeAnchor] = useState<HTMLElement | null>(null);
  const [affilAnchor, setAffilAnchor] = useState<HTMLElement | null>(null);
  const [filtersAnchor, setFiltersAnchor] = useState<HTMLElement | null>(null);
  const [keysAnchor, setKeysAnchor] = useState<HTMLElement | null>(null);
  // §2.5: the bulk bar's round "i" — toggles today's always-on two-line caveat into a strip
  // under the bar instead of it holding a permanent row.
  const [rulesOpen, setRulesOpen] = useState(false);
  // §2.1: the explanatory paragraph is always-on today; it becomes collapsed-by-default behind
  // the "What am I looking at?" link (mockup:576 — aboutOpen starts false). `false` on both the
  // server render and the client's first paint, so nothing here can diverge at hydration.
  const [aboutOpen, setAboutOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

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
  // default sort = IO desc, matching the page's own lede ("IO ... leads"). top_confidence
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
  const [errorMsg, setErrorMsg] = useState<string>("");
  // selection (bulk) — T4: single-candidate accept-eligible rows AND (now) open, non-scopus
  // multi-candidate rows (see isBulkSelectable) — the latter for bulk-ASSIGN only.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // multi-candidate: chosen cwid per row id
  const [picked, setPicked] = useState<Record<number, string>>({});
  // T4/B-8: "Assign selected (N) to…" — anchor opens the candidate-union picker; choosing a
  // target (typed or from the union) fires ONE server lookup (authorshipLookupCwid) rather than
  // submitting anything, so assignLookupCwid holds the in-flight typed/picked string while that
  // resolves, and assignConfirm holds what the lookup returned (canonical cwid, name,
  // hasIdentity) plus the on/off-candidate split (partitionForAssign) until the curator
  // confirms. All null/empty when the picker/lookup/confirm step is closed.
  const [assignMenuAnchor, setAssignMenuAnchor] = useState<HTMLElement | null>(null);
  const [assignOtherCwid, setAssignOtherCwid] = useState("");
  const [assignLookupCwid, setAssignLookupCwid] = useState<string | null>(null);
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
  const undoRef = useRef<{ rows: AuthorshipRow[]; label: string } | null>(null);
  // "is any overlay this component owns currently up?" — read by the same stable keydown
  // listener, which must not act on the row behind an open popover/menu/dialog.
  const overlayOpenRef = useRef(false);
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
  useEffect(() => { undoRef.current = undo; }, [undo]);
  // Every overlay this component owns, in one expression: the four control popovers, the three
  // MUI menus (row overflow, bulk-assign picker, the two history panels), and the three
  // hand-rolled full-screen layers (lookup spinner, assign confirm, reject confirm). The
  // keyboard handler bails while any of them is up.
  const overlayOpen = !!typeAnchor || !!affilAnchor || !!filtersAnchor || !!keysAnchor
    || !!menu || !!assignMenuAnchor || !!historyAnchor || !!activityAnchor
    || !!assignLookupCwid || !!assignConfirm || rejectConfirmOpen;
  useEffect(() => { overlayOpenRef.current = overlayOpen; }, [overlayOpen]);

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
  const fetchData = useCallback((silent = false) => {
    const myId = ++seqRef.current;
    if (!silent) setLoading(true);
    fetch("/api/db/authorships", {
      credentials: "same-origin", method: "POST", headers: apiHeaders,
      body: JSON.stringify({ ...filterBody(), limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (myId !== seqRef.current) return; // superseded by a newer request — drop this response
        // never show a row whose removal is still in flight (race protection, same as topUp)
        setRows((d.rows || []).filter((row: AuthorshipRow) => !pendingRemoved.current.has(row.id)));
        setCount(d.count || 0);
      })
      .catch((e) => console.error("[authorships]", e))
      .finally(() => { if (!silent) setLoading(false); });
  }, [filterBody, page]);

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
    fetch("/api/db/authorships", {
      credentials: "same-origin", method: "POST", headers: apiHeaders,
      body: JSON.stringify({ ...filterBody(), limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (myId !== seqRef.current) return; // a newer fetch/topUp started — don't merge stale rows
        const fetched: AuthorshipRow[] = (d.rows || []).filter(
          (row: AuthorshipRow) => !pendingRemoved.current.has(row.id),
        );
        setCount(d.count || 0);
        if (fetched.length === 0 && page > 0) { setPage((p) => Math.max(0, p - 1)); return; }
        setRows((current) => {
          const visibleIds = new Set(current.map((r) => r.id));
          const additions = fetched.filter((r) => !visibleIds.has(r.id));
          return [...current, ...additions].slice(0, PAGE_SIZE);
        });
      })
      .catch((e) => console.error("[authorships]", e));
  }, [filterBody, page]);

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
  // Its 12 byline_ SUMs are 12 leading-wildcard LIKEs over author_affiliation and measured
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
    if (affilAnchor) setAffilFacetKey(baseSummaryBody);
  }, [affilAnchor, baseSummaryBody]);
  const summaryBody = useMemo(
    () => JSON.stringify(affilFacetKey === baseSummaryBody
      ? { ...buildSummaryBody(filters), includeAuthorInstitutions: true }
      : buildSummaryBody(filters)),
    [filters, affilFacetKey, baseSummaryBody],
  );

  // `summaryFor` records the exact body that produced `summary`, so the popover can tell
  // "these counts describe what you are looking at" from "a response for some other state is
  // still in flight" — see authorFacetsReady. seqRef is not optional now that two summary
  // requests have very different latencies (a byline-facet call is ~900 ms, a plain one
  // ~400 ms): without it, opening the popover and immediately changing a filter lets the older,
  // slower response land last and repaint stale counts as fresh ones.
  const fetchSummary = useCallback(() => {
    const myId = ++summarySeqRef.current;
    const body = summaryBody;
    fetch("/api/db/authorships/summary", {
      credentials: "same-origin", method: "POST", headers: apiHeaders, body,
    })
      .then((r) => r.json())
      .then((d) => {
        if (myId !== summarySeqRef.current) return;   // a newer summary fetch started
        setSummary(d);
        setSummaryFor(body);
      })
      .catch(() => {
        if (myId !== summarySeqRef.current) return;
        setSummary(null);
        setSummaryFor("");
      });
  }, [summaryBody]);

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
        [cwid]: { names: d?.names?.[cwid] || [], accepted: d?.accepted?.[cwid] ?? 0, more: d?.more?.[cwid] },
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
      .catch((e) => setErrorMsg(`Couldn't undo "${entry.title || entry.wcm_author || entry.id}" — ${String(e?.message || e)}`));
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
  useEffect(() => {
    if (page !== 0) { pendingPageReset.current = true; setPage(0); }
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
        if (action !== "reopen" && action !== "verdict") setUndo({ rows: [row], label: ACTION_LABEL[action] || "Done" });
        topUp();      // refill so the next pending authorship slides into the freed slot
        fetchSummary();
        fetchRecentActivity();
      })
      .catch((e) => {
        // scopus Accept/Assign duplicate (409 WARNING) → offer a Force add instead of a dead error
        const scopusDup = e?.status === 409 && row.source === "scopus" && (action === "accept" || action === "assign");
        // Both 422s are the same shape — "allowed, but say you meant it" — and each names the
        // confirmation flag it wants back. The consequences are opposite, so the prompts they
        // raise differ (see ConflictEntry.kind and the banner below); the plumbing doesn't.
        // MULTI_CANDIDATE checked ahead of scopusDup: both are plain 409s, and a scopus row can
        // hit the multi-candidate gate too (it's checked before the isScopus branch server-side).
        const kind: ConflictEntry["kind"] | null =
          e?.status === 422 && e?.code === "NO_RECITER_IDENTITY" ? "no_identity"
            : e?.status === 422 && e?.code === "OFF_CANDIDATE" ? "off_candidate"
              : e?.status === 409 && e?.code === "MULTI_CANDIDATE" ? "multi_candidate"
                : scopusDup ? "dup" : null;
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
        else if (e?.local) setErrorMsg(`Couldn't ${action} "${row.wcm_author}" — ${String(e?.message || e)}`);
        else setErrorMsg(`Couldn't ${action} "${row.wcm_author}" — ${String(e?.message || e)}. The row is back in the list — nothing was saved.`);
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
        if (ok.length > 0) setUndo({ rows: ok, label: `Accepted ${ok.length}` });
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
          setErrorMsg(`${failures.length} of ${batch.length} accepts skipped: ${parts.join("; ")} — refreshing`);
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
        if (ok.length > 0) setUndo({ rows: ok, label: `Rejected ${ok.length}` });
        if (failures.length) {
          const { noProposal, writeFailed, other } = bucketRejectFailures(
            failures.map((f) => (f.reason as any) || {}));
          const parts: string[] = [];
          if (noProposal) parts.push(`${noProposal} had nothing to reject`);
          if (writeFailed) parts.push(`${writeFailed} failed to write`);
          if (other) parts.push(`${other} failed`);
          setErrorMsg(`Rejected ${ok.length} of ${batch.length} selected: ${parts.join("; ")} — refreshing`);
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
  const doBulkSnooze = useCallback((batch: AuthorshipRow[]) => {
    if (batch.length === 0) return;
    setMenu(null);
    setBulkProgress(batch.length > BULK_CHUNK ? { done: 0, total: batch.length } : null);
    const runChunks = async () => {
      const results: PromiseSettledResult<boolean>[] = [];
      for (let i = 0; i < batch.length; i += BULK_CHUNK) {
        const chunk = batch.slice(i, i + BULK_CHUNK);
        results.push(...await Promise.allSettled(chunk.map((row) => doActionAsync(row, "snooze"))));
        if (batch.length > BULK_CHUNK) setBulkProgress({ done: results.length, total: batch.length });
      }
      return results;
    };
    runChunks()
      .then((results) => {
        const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
        const ok = batch.filter((_, i) => results[i].status === "fulfilled");
        if (ok.length > 0) setUndo({ rows: ok, label: `Snoozed ${ok.length}` });
        if (failures.length) {
          setErrorMsg(`Snoozed ${ok.length} of ${batch.length} selected; ${failures.length} failed — refreshing`);
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

  // T4: union of everything the current selection proposes, for the "Assign selected (N) to…"
  // picker — "Name (cwid) — matches k of N selected", ranked k desc. Recomputed on every
  // render off selectedRows; bulk-assign is a same-page/handful-of-rows tool (unlike
  // select-all-matching's thousands), so this is cheap.
  const assignCandidateUnion = unionCandidates(selectedRows.map(rowCandidateLites));

  const openAssignPicker = useCallback((anchor: HTMLElement) => {
    setAssignOtherCwid("");
    setAssignMenuAnchor(anchor);
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
    setAssignMenuAnchor(null);
    const typed = rawCwid.trim();
    if (!typed) return;
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
        const cwid = String(d.cwid || typed);
        const { onCandidate, offCandidate } = partitionForAssign(selectedRows, rowCandidateLites, cwid);
        setAssignConfirm({ cwid, name: d.name ?? null, hasIdentity: !!d.hasIdentity, onCandidate, offCandidate });
      })
      .catch((e) => setErrorMsg(`Couldn't look up "${typed}" — ${String(e?.message || e)}`))
      .finally(() => setAssignLookupCwid(null));
  }, [selectedRows]);

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
  const doBulkAssign = useCallback(() => {
    const confirm = assignConfirm;
    if (!confirm) return;
    const { cwid, hasIdentity, onCandidate, offCandidate } = confirm;
    setAssignConfirm(null);
    setMenu(null);
    const offIds = new Set(offCandidate.map((r) => r.id));
    const batch = [...onCandidate, ...offCandidate];
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
        if (ok.length > 0) setUndo({ rows: ok, label: `Assigned ${ok.length}` });
        const parts: string[] = [];
        if (failures.length) {
          const { offCandidate: offC, noIdentity, conflict409, other } = bucketAssignFailures(
            failures.map((f) => (f.reason as any) || {}));
          if (offC) parts.push(`${offC} off-candidate`);
          if (noIdentity) parts.push(`${noIdentity} with no ReCiter identity`);
          if (conflict409) parts.push(`${conflict409} conflict${conflict409 > 1 ? "s" : ""}`);
          if (other) parts.push(`${other} failed`);
        }
        if (parts.length) setErrorMsg(`Assigned ${ok.length} of ${batch.length} selected to ${cwid}: ${parts.join("; ")}`);
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
        if (d.capped) setErrorMsg(`Selected the first ${d.cap.toLocaleString()} matching rows — narrow the filters to reach the rest.`);
      })
      .catch((e) => setErrorMsg(`Couldn't select all matching — ${String(e?.message || e)}`))
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
      if (results.some((r) => r.status === "rejected")) setErrorMsg("Undo failed for one or more rows");
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
  const narrowToPmid = useCallback((pmid: number) => {
    // One patch, so lane/classification/search land in a single filter-object update (one
    // refetch, one selection clear) instead of three.
    patchFilters({ lane: "all", classification: "all", search: String(pmid) });
    setSearchInput(String(pmid));
  }, [patchFilters]);

  // Shared by the "Assign to someone else…" overflow item and the no-identity pill/button
  // (T3): expands the card and focuses the AssignOther typed-cwid input it renders. Card
  // expansion mounts <AssignOther> on the next render, so focus has to wait for that DOM to
  // exist — zero-delay setTimeout, a paint wait rather than a debounce.
  const focusAssignOther = useCallback((id: number) => {
    setExpanded(id);
    setTimeout(() => document.getElementById(`otherCwid-${id}`)?.focus(), 0);
  }, []);

  // T5: "Show N others like this" — sets the STRUCTURED likeAuthor filter (variant-tolerant
  // normalized-key match server-side, see buildWhere's likeAuthor block), not the free-text
  // search box: T4's version pasted wcm_author into the text box, whose LIKE substring match
  // misses a middle-initial variant like "Bernard J. Park" starting from "Bernard Park" — the
  // driving case for this rework. The text box (`search`/`searchInput`) is left untouched, so
  // it keeps working as its own independent filter. Page reset to 0 is already handled by the
  // pendingPageReset effect above, which watches filterBody (likeAuthor is now part of it).
  const findOthersLikeThis = useCallback((wcmAuthor?: string) => {
    if (!wcmAuthor) return;
    setLikeAuthor(wcmAuthor);
  }, [setLikeAuthor]);

  // T4: single-candidate rows keep the pre-existing accept-eligible gate (no-ReCiter-identity,
  // already-rejected, no proposed identity at all (#938) stay unselectable). Multi-candidate
  // rows are now ALSO selectable — open, non-scopus (see isMultiAssignEligible) — but only for
  // bulk-assign: isBulkSelectable never lets a multi row satisfy isAcceptEligible, which is
  // what every accept-type bulk consumer below (eligibleRows, "Accept selected") filters on.
  const toggleSelect = useCallback((row: AuthorshipRow) => {
    if (!isBulkSelectable(row, statusView)) return;
    setSelected((s) => {
      const next = new Set(s);
      next.has(row.id) ? next.delete(row.id) : next.add(row.id);
      return next;
    });
  }, [statusView]);

  useEffect(() => { doActionRef.current = doAction; }, [doAction]);
  useEffect(() => { toggleSelectRef.current = toggleSelect; }, [toggleSelect]);
  useEffect(() => { doUndoRef.current = doUndo; }, [doUndo]);

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
    patchFilters(filterResetPatch());
    setSearchInput("");
    applyDatePreset(DEFAULT_DATE_PRESET);
  }, [patchFilters, applyDatePreset]);

  // Apply the default "recent" window (Last 2 years) on mount — client-only so the statically
  // prerendered initial render (empty dates) hydrates cleanly. datesReady then releases the first
  // list fetch, so curators land on the windowed view instead of flashing the full backlog.
  useEffect(() => { applyDatePreset(DEFAULT_DATE_PRESET); setDatesReady(true); }, [applyDatePreset]);

  // F13: keyboard nav — J/K move, Y accept (single), N reject, S snooze, X select, U undo,
  // Enter open PubMed. Registered ONCE: it reads the latest rows/focus/view/handlers from refs, so
  // an optimistic action or a rolling-queue refill never swaps the listener (and the post-action
  // focus-advance still sees current state through those same refs).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea") return;
      // …and not while a popover, menu or confirm dialog is up. The tag test above is not enough:
      // MUI moves focus INTO the popover's paper (a div, not an input), so with the Filters or
      // Affiliation list open every keystroke still fell through to the row behind it — j/k moved
      // an invisible focus ring and y/n/s ACTED on a row the curator could not see. Every overlay
      // this component owns is folded into one boolean (see overlayOpen) so a new one cannot be
      // added and forgotten here.
      if (overlayOpenRef.current) return;
      const visible = rowsRef.current;
      if (visible.length === 0) return;
      const focusedId = focusedIdRef.current;
      const statusView = statusViewRef.current;
      const idx = focusedId == null ? -1 : visible.findIndex((r) => r.id === focusedId);
      const focus = (i: number) => {
        const r = visible[Math.max(0, Math.min(visible.length - 1, i))];
        if (r) { setFocusedId(r.id); cardRefs.current[r.id]?.scrollIntoView({ block: "nearest" }); }
      };
      const k = e.key.toLowerCase();
      if (k === "j") { focus(idx + 1); e.preventDefault(); return; }
      if (k === "k") { focus(idx < 0 ? 0 : idx - 1); e.preventDefault(); return; }
      if (k === "u") { if (undoRef.current) doUndoRef.current?.(); e.preventDefault(); return; }
      if (focusedId == null) return;
      const row = visible.find((r) => r.id === focusedId);
      if (!row) return;
      const doAction = doActionRef.current;
      const toggleSelect = toggleSelectRef.current;
      if (k === "y") {
        if (row.single_candidate && statusView === "open") {
          if (row.identity_in_reciter === false) setErrorMsg(`${row.top_name || row.top_cwid} has no record in ReCiter's Identity table, so there is nothing to add this authorship to — dismiss it instead`);
          else doAction?.(row, "accept");
        } else setErrorMsg("Use Pick one ▾ to assign a multi-candidate authorship");
        e.preventDefault();
      }
      else if (k === "n") { if (statusView === "open") doAction?.(row, "reject"); e.preventDefault(); }
      else if (k === "s") { if (statusView === "open") doAction?.(row, "snooze"); e.preventDefault(); }
      else if (k === "x") { toggleSelect?.(row); e.preventDefault(); }
      else if (e.key === "Enter") {
        const url = row.source === "scopus"
          ? (row.doi ? `https://doi.org/${row.doi}` : scopusRecordUrl(row.external_id))
          : `https://pubmed.ncbi.nlm.nih.gov/${row.pmid}/`;
        if (url) window.open(url, "_blank", "noreferrer");
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  // Active filters, computed in ONE place (HANDOFF §2.4). `filterCount` is the number the
  // Filters button's blue badge shows in phase 3 — it is chips.length by definition (mockup:666),
  // so it can never drift from what the chip row lists. Both come from the pure filterChips()
  // above; nothing here decides what counts as "active".
  const chips = filterChips(filters, datePreset);
  const filterCount = chips.length;
  // §2.1's header line trails the active date window ("…, past 2 years"). Derived from the
  // preset, not from dateFrom/dateTo, everywhere except "custom" — the preset is a module
  // constant on the first render and the dates are not, so this is the one form of the phrase
  // that cannot diverge between the prerendered HTML and hydration.
  const headerDatePhrase = datePhrase(datePreset, dateFrom, dateTo);
  // Removing one chip removes ONLY that filter. Two of them reach past the filter object:
  // the search chip must also empty the text box that debounces into it, and the date chip goes
  // through applyDatePreset because the preset recomputes dateFrom/dateTo.
  const removeChip = (chip: FilterChip) => {
    if (Object.keys(chip.patch).length > 0) patchFilters(chip.patch);
    if (chip.preset) applyDatePreset(chip.preset);
    if (chip.id === "search") setSearchInput("");
  };
  // The MATCH CLASS entry currently in force. Compared by (lane, classification), never by
  // label — "All unassigned" and "All classes" are the same state, and only the first is ever
  // highlighted (matchClassLabel resolves that state to the default).
  const activeMatchClass = MATCH_CLASS_OPTIONS.find((o) => o.lane === lane && o.classification === classification);
  // §2.2's affiliation button, transcribed from the mockup (mockup:636, :692-694): the identity
  // list AT ITS DEFAULT contributes nothing, so "Affiliation" with no badge is the resting
  // state; one value across both lists names that value; more than one shows the count badge.
  const affilNames = [
    ...(selectedInstitutions.length === 1 && selectedInstitutions[0] === FILTER_DEFAULTS.selectedInstitutions[0]
      ? [] : selectedInstitutions),
    ...selectedAuthorAffiliations,
  ].map((k) => INSTITUTION_LABELS[k] || k);
  const affilCount = affilNames.length;
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
  const identityOptions = withSelected(identityFacets, selectedInstitutions);
  const authorOptions = withSelected(authorFacets, selectedAuthorAffiliations);
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
  const eligibleRows = statusView === "open" ? rows.filter((r) => isBulkSelectable(r, statusView)) : [];
  const allEligibleSelected = eligibleRows.length > 0 && eligibleRows.every((r) => selected.has(r.id));
  const someEligibleSelected = eligibleRows.some((r) => selected.has(r.id));
  // §2.5: the bar's action cluster and its "N selected" label key off this; "Accept
  // near-certain" is its complement (shown only when nothing is selected).
  const hasSelection = selectedRows.length > 0;
  // One "Clear", whichever way the selection was made: a select-all-matching batch lives in
  // allMatching, a page selection in `selected`, and dropping only one of the two leaves the
  // other still driving every bulk button.
  const clearSelection = useCallback(() => { setSelected(new Set()); setAllMatching(null); }, []);
  const toggleSelectAllEligible = useCallback(() => {
    setSelected((s) => {
      const next = new Set(s);
      const allSel = eligibleRows.length > 0 && eligibleRows.every((r) => next.has(r.id));
      if (allSel) eligibleRows.forEach((r) => next.delete(r.id));
      else eligibleRows.forEach((r) => next.add(r.id));
      return next;
    });
  }, [eligibleRows]);

  return (
    <div style={{ fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif", color: "#0f172a" }}>
      {/* ================= header band (HANDOFF §2.1, mockup:64-83) =========================
          Title and one muted count line on the left, the two alert pills and Activity on the
          right. Three always-on things collapse into it: the explanatory paragraph (now behind
          "What am I looking at?"), the Recent-activity row (now a button beside the title), and
          the multi-figure count strip — whose per-class numbers did not disappear, they are the
          right-hand column of the Filters popover's MATCH CLASS list, which is also the only
          place they were ever clickable. */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            {/* §2.1 asks for 30px/600, which an inline style cannot deliver here: globals.css
                pins `h1 { font-size:28px !important; font-weight:500 !important; color:#1a2133
                !important }` app-wide, and an !important rule beats a non-important inline one.
                The title therefore keeps the app's house heading — 28px/500, and it already
                carries the -0.02em tracking the canvas asks for. What IS overridable is the
                global's `padding-bottom:10px`, which is dead space now that the count line sits
                directly beneath. */}
            <h1 style={{ margin: 0, paddingBottom: 0 }}>Authorships</h1>
            <button type="button" onClick={() => setAboutOpen((v) => !v)} aria-expanded={aboutOpen}
              style={{ font: "inherit", border: "none", background: "none", padding: 0, fontSize: 13, color: CTRL.accent, cursor: "pointer" }}>
              What am I looking at?
            </button>
          </div>
          {/* One muted line, and the date phrase tracks the active date filter rather than
              naming a fixed window: with "All time" selected there is no phrase at all, and a
              custom window names its own bounds. summary is null until the first response, so
              the line holds its height with a non-breaking space instead of appearing late and
              pushing the control band down. */}
          <div style={{ fontSize: 13.5, color: CTRL.muted }}>
            {summary ? (
              <>
                <strong style={{ color: CTRL.ink, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {summary.total.toLocaleString()}
                </strong>{" "}
                {SUMMARY_HEADLINE[statusView] || "authorships"}
                {headerDatePhrase ? `, ${headerDatePhrase}` : ""}
              </>
            ) : " "}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none", flexWrap: "wrap" }}>
          {/* Both pills force statusView to the queue the pill opens (conflicts also forces
              identityConflicts on) and honour every OTHER filter in the current body exactly
              like the list does (#988), so the number shown is the row count that queue will
              show once the pill is clicked — not an unfiltered queue-wide count. Hidden at
              zero: a "0 identity conflicts" pill is a permanent alarm for a condition that
              isn't there. */}
          {(summary?.conflicts ?? 0) > 0 && (
            <Tip title="Two CWIDs assigned to one authorship — the same byline position on this paper is already accepted by a different WCM identity. Opens the Identity conflicts queue." placement="bottom" arrow>
              <button type="button" onClick={() => setStatusView("conflicts")} style={alertPill("red")}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#b1483c", display: "block", flex: "none" }} />
                {(summary?.conflicts ?? 0).toLocaleString()} identity conflict{summary?.conflicts === 1 ? "" : "s"}
              </button>
            </Tip>
          )}
          {(summary?.duplicates ?? 0) > 0 && (
            <Tip title="Same publication retrieved from PubMed and Scopus. Opens the Duplicate records queue." placement="bottom" arrow>
              <button type="button" onClick={() => setStatusView("duplicates")} style={alertPill("amber")}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#c07f11", display: "block", flex: "none" }} />
                {(summary?.duplicates ?? 0).toLocaleString()} duplicate record{summary?.duplicates === 1 ? "" : "s"}
              </button>
            </Tip>
          )}
          {/* Session-local conflict log — not in the mockup because it only exists once a
              curator has hit a 409 this session. Kept, and deliberately NOT styled as a third
              coloured alert: the two pills beside it are server counts, this is a private
              history of what just happened in this tab. */}
          {conflictLog.length > 0 && (
            <Tip title="Duplicate-conflict prompts raised in THIS browser session (lost on reload) — not a server queue." placement="bottom" arrow>
              <button type="button" onClick={(ev) => setHistoryAnchor(ev.currentTarget)} style={alertPill("plain")}>
                <IconAlert size={13} /> Session conflicts ({conflictLog.length})
              </button>
            </Tip>
          )}
          {/* The count is NOT filter-scoped and the server caps the feed at 15 — placing it
              beside two filter-scoped pills would otherwise imply a scoping it does not have,
              so the tooltip says so outright and the label carries no noun that suggests
              "matching these filters". */}
          <Tip title="The most recently resolved authorships across the whole queue and every curator — not scoped to the filters below. The server returns at most 15." placement="bottom" arrow>
            <button type="button" onClick={(ev) => setActivityAnchor(ev.currentTarget)} style={alertPill("plain")}>
              <IconClock size={13} /> Activity ({recentActivity.length})
            </button>
          </Tip>
        </div>
      </div>

      {/* §2.1's copy, verbatim from the canvas (mockup:87) — collapsed by default. */}
      {aboutOpen && (
        <div style={{ border: `1px solid ${CTRL.border}`, borderLeft: `3px solid ${CTRL.accent}`, background: "#fff", borderRadius: 6, padding: "14px 16px", fontSize: 13.5, lineHeight: 1.6, color: "#4a5262", maxWidth: 720, marginBottom: 14 }}>
          WCM-affiliated authorships not yet assigned to an identity. Each card is one decision: is this author the
          proposed WCM person? <strong style={{ color: CTRL.ink, fontWeight: 600 }}>IO</strong> (identity-only, the trusted
          signal) leads; <strong style={{ color: CTRL.ink, fontWeight: 600 }}>AS</strong> (ReCiter authorship score,
          production model) is shown small beneath it as the diagnosis. Expand a card for the affiliation and evidence.
        </div>
      )}

      {/* ================= the single control row (HANDOFF §2.2, mockup:110-272) =================
          Five always-on rows collapse into this one. Source, person type and affiliation stay in
          the open on the left; search, sort, Filters and the keyboard legend sit right. Queue,
          match class, date and the two hides moved into the Filters popover (§2.3); whatever is
          in force is listed as a removable chip directly beneath (§2.4). The card wrapper holds
          the control row, the chip row and the bulk bar together so they read as one band. */}
      <div style={{ background: "#fff", border: `1px solid ${CTRL.border}`, borderRadius: 8, marginBottom: 18 }}>

        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 12px 10px 14px", borderBottom: `1px solid ${CTRL.rule}`, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>

            {/* 1. source segment (mockup:112-116). Selecting a source behaves exactly as it did.
                   The per-lane counts moved off the labels and into the tooltips each segment
                   already had: at 13.5px they cost ~190px of a row whose whole purpose is to fit
                   on one line (measured — with them the row needs a 1,220px content width, without
                   them ~1,030px, and the common 1440px laptop with the sidebar expanded gives
                   1,140px). §2.2 names the labels as bare `All` / `PubMed` / `Scopus`. */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 2, background: CTRL.track, borderRadius: 7, padding: 3 }}>
              {([["all", "All"], ["pubmed", "PubMed"], ["scopus", "Scopus"]] as const).map(([key, label]) => {
                const n = key === "all"
                  ? (summary?.bySource ? Object.values(summary.bySource).reduce((a, b) => a + b, 0) : undefined)
                  : summary?.bySource?.[key];
                const what = key === "scopus" ? "WCM authorships found in Scopus but NOT in PubMed (no production score)"
                  : key === "pubmed" ? "Authorships from PubMed" : "Both sources";
                return (
                  <Tip key={key} title={n != null ? `${what} — ${n.toLocaleString()} in this queue` : what} placement="top" arrow>
                    <button onClick={() => setSource(key)} style={segBtn(source === key)}>{label}</button>
                  </Tip>
                );
              })}
            </div>

            {/* 2. person type (mockup:117-140) */}
            <button type="button" onClick={(e) => setTypeAnchor(e.currentTarget)}
              style={dropBtn(selectedTypes.length > 0, !!typeAnchor)}>
              {selectedTypes.length === 0 ? "All person types"
                : selectedTypes.length === 1 ? selectedTypes[0]
                  : `Person type · ${selectedTypes.length}`}
              <span style={caretStyle}>▾</span>
            </button>

            {/* 3. affiliation — two independent lists, ANDed (mockup:141-183). Replaces #982's
                   `match: either/person/byline` select: the identity list IS the person basis
                   and the article list IS the byline basis, so the basis is no longer a choice. */}
            <button type="button" onClick={(e) => setAffilAnchor(e.currentTarget)}
              style={dropBtn(affilCount > 0, !!affilAnchor)}>
              {affilCount === 1 ? affilNames[0] : "Affiliation"}
              {affilCount > 1 && <span style={countBadgeStyle}>{affilCount}</span>}
              <span style={caretStyle}>▾</span>
            </button>
          </div>

          {/* right group (mockup:186-198) */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", flexWrap: "wrap" }}>
            <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); }}>
              {/* bound to searchInput, NOT search: the box debounces (300 ms) into the filter, so
                  binding it to the filter would fight the debounce on every keystroke. */}
              <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Name, CWID, or PMID" aria-label="Filter by name, CWID, or PMID"
                style={{ font: "inherit", width: 196, border: `1px solid ${CTRL.border}`, borderRadius: 6, padding: "7px 11px", fontSize: 13.5, color: CTRL.ink, background: "#fff" }} />
            </form>
            {/* §2.2 uses the mockup's wording where it maps onto a sort the server actually
                supports (SORTS in authorships.controller.ts: precision/confidence/io/fg/date).
                Its "Oldest" and "Most candidates" have no server order and are NOT invented here;
                the three sorts it omits are kept rather than dropped. Default stays `io` — the
                mockup's DEFAULTS never mentions sort, sort is never a chip and never reset, and
                IO leading is what the page's own lede promises. */}
            {/* A <select> is as wide as its widest option, so a long label here is what pushes
                the whole right group onto a second line. The nuance the old "Match confidence
                (name/affiliation, not IO)" label carried moves into the title instead of costing
                ~150px of the row this step exists to fit on one line. */}
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort"
              title={"Sort order — kept when any other control changes.\n“Match confidence” is the matcher's name/affiliation heuristic, not IO."}
              style={{ font: "inherit", border: `1px solid ${CTRL.border}`, borderRadius: 6, padding: "7px 9px", fontSize: 13.5, background: "#fff", color: CTRL.ink, cursor: "pointer" }}>
              <option value="io">Highest IO</option>
              <option value="date">Newest</option>
              <option value="date_asc">Oldest</option>
              <option value="precision">Best match</option>
              <option value="confidence">Match confidence</option>
              <option value="fg">Authorship Score</option>
              <option value="candidates">Most candidates</option>
            </select>
            <button type="button" onClick={(e) => setFiltersAnchor(e.currentTarget)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7, font: "inherit", fontSize: 13.5,
                border: `1px solid ${filtersAnchor || filterCount ? CTRL.accent : CTRL.border}`,
                background: filtersAnchor ? CTRL.accentBg : "#fff", color: CTRL.ink,
                borderRadius: 6, padding: "7px 12px", cursor: "pointer",
              }}>
              Filters
              {/* the badge is chips.length by definition (mockup:666), so it can never drift
                  from what the chip row below actually lists */}
              {filterCount > 0 && <span style={countBadgeStyle}>{filterCount}</span>}
            </button>
            <button type="button" onClick={(e) => setKeysAnchor(e.currentTarget)} title="Keyboard shortcuts"
              aria-label="Keyboard shortcuts"
              style={{ font: "inherit", width: 32, height: 32, border: `1px solid ${CTRL.border}`, background: keysAnchor ? CTRL.accentBg : "#fff", borderRadius: 6, fontSize: 13.5, color: CTRL.muted, cursor: "pointer" }}>
              ?
            </button>
          </div>
        </div>

        {/* scopus pub-type facet — a facet OF the source segment, so it stays beside it rather
            than moving into the Filters popover. It is mounted only under Scopus and the
            source effect empties the list on the way out, which is what keeps buildFilterBody's
            `source === "scopus" ? … : []` ternary from ever hiding a live-looking selection. */}
        {source === "scopus" && (summary?.pubTypes?.length ?? 0) > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", borderBottom: `1px solid ${CTRL.rule}`, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: CTRL.soft, letterSpacing: ".06em" }}>PUBLICATION TYPE</span>
            <button onClick={() => setSelectedPubTypes([])} style={pubChipStyle(selectedPubTypes.length === 0)}>All</button>
            {(summary?.pubTypes || []).map((pt) => {
              const on = selectedPubTypes.includes(pt.type);
              return (
                <button key={pt.type} style={pubChipStyle(on)}
                  onClick={() => setSelectedPubTypes((s) => toggleInList(s, pt.type))}>
                  {pt.type} ({pt.n.toLocaleString()})
                </button>
              );
            })}
          </div>
        )}

        {/* ---- active filter chips (§2.4, mockup:274-284) — directly beneath the control row.
            Rendered only when something is off its default; the source segment is never a chip
            and the search box is one, both transcribed in filterChips() rather than re-decided
            here. Removing a chip removes ONLY that filter. */}
        {chips.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "10px 14px", borderBottom: `1px solid ${CTRL.rule}`, background: CTRL.band }}>
            <span style={{ fontSize: 12, letterSpacing: ".06em", color: "#8b93a2" }}>FILTERS</span>
            {chips.map((chip) => (
              <button key={chip.id} type="button" onClick={() => removeChip(chip)}
                aria-label={`Remove filter ${chip.label}`} title="Remove this filter"
                style={{ font: "inherit", display: "inline-flex", alignItems: "center", gap: 7, border: `1px solid ${CTRL.chipBorder}`, background: CTRL.accentBg, color: CTRL.accentInk, borderRadius: 999, padding: "4px 8px 4px 11px", fontSize: 13, cursor: "pointer" }}>
                {chip.label}<span style={{ color: "#6f8cbe", fontSize: 14, lineHeight: 1 }}>×</span>
              </button>
            ))}
            <button type="button" onClick={resetAll}
              title={`Reset all ${filterCount} ${filterCount === 1 ? "filter" : "filters"} to their defaults (sort is left alone)`}
              style={{ font: "inherit", border: "none", background: "none", fontSize: 13, color: CTRL.muted, cursor: "pointer", padding: "4px 6px" }}>
              Clear
            </button>
          </div>
        )}

        {/* ---- selection / bulk bar (§2.5, mockup:286-315) ------------------------------------
            The actions appear only when rows are selected. What did NOT change: a selection can
            only exist on the open queue (isBulkSelectable gates on statusView), every accept-type
            button still reads selectedAcceptRows, and "Accept near-certain" is gated on the open
            queue explicitly now that the bar itself renders in every queue for "Showing N of M". */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, rowGap: 8, flexWrap: "wrap", padding: "9px 14px", borderBottom: `1px solid ${CTRL.rule}`, background: hasSelection ? "#f3f7fd" : "#fff" }}>
          {statusView === "open" && (
            <Tip title="Select every selectable row on this page — single-candidate rows for bulk accept/assign/reject, multi-candidate (non-Scopus) rows and single-candidate no-ReCiter-identity rows for bulk assign/reject" placement="top" arrow>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 9, fontSize: 13.5, color: eligibleRows.length === 0 ? "#9aa2b1" : "#4a5262", cursor: eligibleRows.length === 0 ? "default" : "pointer" }}>
                <Checkbox size="small" disabled={eligibleRows.length === 0}
                  checked={allEligibleSelected}
                  indeterminate={someEligibleSelected && !allEligibleSelected}
                  onChange={toggleSelectAllEligible}
                  style={{ padding: 0 }} />
                <span>{hasSelection ? `${selectedRows.length.toLocaleString()} selected` : "Select all on page"}</span>
              </label>
            </Tip>
          )}

          {hasSelection && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 4, flexWrap: "wrap" }}>
              {/* Accept stays scoped to selectedAcceptRows and hides entirely once the selection
                  is assign-only; the count is appended only when the two differ, so the curator
                  is never told "Accept" will act on more rows than it will. */}
              {selectedAcceptRows.length > 0 && (
                <button style={barBtn("accept")} disabled={!!bulkProgress}
                  onClick={() => doBulkAccept(selectedAcceptRows)}>
                  Accept{selectedAcceptRows.length < selectedRows.length ? ` (${selectedAcceptRows.length})` : ""}
                </button>
              )}
              <button style={barBtn("plain")} disabled={!!bulkProgress}
                onClick={(e) => openAssignPicker(e.currentTarget)}>
                Assign to…
              </button>
              <button style={barBtn("plain")} disabled={!!bulkProgress}
                onClick={() => setRejectConfirmOpen(true)}>
                Reject
              </button>
              {/* §2.5's new bulk action. No confirm gate: snooze writes nothing but a wake date
                  on the row, and the Undo snackbar reverses the batch. */}
              <button style={barBtn("plain")} disabled={!!bulkProgress}
                onClick={() => doBulkSnooze(selectedRows)}>
                Snooze
              </button>
              <button type="button" onClick={() => setRulesOpen((v) => !v)}
                aria-label="What bulk actions act on" title="What bulk actions act on"
                style={{ font: "inherit", width: 26, height: 26, border: `1px solid ${rulesOpen ? CTRL.accent : CTRL.border}`, background: rulesOpen ? CTRL.accentBg : "#fff", borderRadius: "50%", fontSize: 12, color: rulesOpen ? CTRL.accentInk : CTRL.muted, cursor: "pointer" }}>
                i
              </button>
              <button type="button" onClick={clearSelection}
                style={{ font: "inherit", border: "none", background: "none", fontSize: 13, color: CTRL.muted, cursor: "pointer" }}>
                Clear
              </button>
              {/* Escape hatch from the page-scoped selection: offered only once this page is
                  fully selected and there is more behind it, with the count in the label. Hidden
                  whenever the selection holds multi-candidate rows — selectAllMatching REPLACES
                  the selection with the server's single-candidate-only set, which would drop them. */}
              {allEligibleSelected && selectedAcceptRows.length === selectedRows.length && !allMatching && count > eligibleRows.length && (
                <button style={barBtn("plain")} disabled={selectingAll} onClick={selectAllMatching}>
                  {selectingAll ? "Selecting…" : `Select all ${count.toLocaleString()} matching`}
                </button>
              )}
              {allMatching && (
                <span style={{ color: CTRL.accentInk, fontWeight: 600, fontSize: 13 }}>
                  All {allMatching.length.toLocaleString()} matching rows selected
                </span>
              )}
            </div>
          )}

          {bulkProgress && (
            <span style={{ color: "#4a5262", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
              Working: {bulkProgress.done.toLocaleString()} of {bulkProgress.total.toLocaleString()}…
            </span>
          )}

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, color: CTRL.soft, fontVariantNumeric: "tabular-nums" }}>
              Showing {rows.length.toLocaleString()} of {count.toLocaleString()}
            </span>
            {!hasSelection && statusView === "open" && (
              <Tip title="Acts on single-candidate rows with IO ≥ 95 on this page only (bounded blast radius)" placement="top" arrow>
                <span>
                  <button disabled={nearCertain.length === 0} onClick={() => doBulkAccept(nearCertain)}
                    style={{ ...barBtn("plain"), color: "#4a5262", opacity: nearCertain.length === 0 ? 0.5 : 1, cursor: nearCertain.length === 0 ? "default" : "pointer", whiteSpace: "nowrap" }}>
                    Accept near-certain · IO ≥ 95 <span style={{ color: CTRL.soft, fontVariantNumeric: "tabular-nums" }}>({nearCertain.length})</span>
                  </button>
                </span>
              </Tip>
            )}
          </div>
        </div>

        {/* the "i" strip (mockup:311-315) — today's always-on two-line caveat, verbatim, now
            behind the round i on the bar. Wording follows the selection: a select-all-matching
            batch is not page-scoped. */}
        {/* Tied to hasSelection, like the `i` that toggles it: without that, clearing a selection
            while the strip is open would leave it stranded with its own toggle gone. */}
        {rulesOpen && hasSelection && (
          <div style={{ padding: "11px 14px", borderBottom: `1px solid ${CTRL.rule}`, background: CTRL.band, fontSize: 13, lineHeight: 1.55, color: CTRL.muted, maxWidth: 760 }}>
            {allMatching
              ? "Bulk accept acts on every matching single-candidate row."
              : "Bulk accept acts on single-candidate rows on this page. Bulk assign and bulk reject also cover open, non-Scopus multi-candidate rows and single-candidate rows with no ReCiter identity."}
          </div>
        )}
      </div>

      {/* ---- person-type popover (§2.2, mockup:121-139) ---------------------------------- */}
      <Popover open={!!typeAnchor} anchorEl={typeAnchor} onClose={() => setTypeAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }} transformOrigin={{ vertical: "top", horizontal: "left" }}
        PaperProps={{ style: popPaper(250) }}>
        <div style={popHeadRow}>
          <div style={popHead}>PERSON TYPE <span style={popHeadCount}>{selectedTypes.length} of {personTypeOptions.length}</span></div>
          <button type="button" onClick={() => setSelectedTypes([])} style={linkBtn}>All</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {personTypeOptions.length === 0 && <div style={emptyOptStyle}>No types</div>}
          {personTypeOptions.map((pt) => {
            const on = selectedTypes.includes(pt.key);
            return (
              <label key={pt.key} style={optRow(on)}>
                <Checkbox size="small" checked={on} style={{ padding: 0 }}
                  onChange={() => setSelectedTypes((s) => toggleInList(s, pt.key))} />
                <span style={{ flex: 1, minWidth: 0 }}>{pt.key}</span>
                <span style={optCountStyle}>{pt.n.toLocaleString()}</span>
              </label>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", borderTop: `1px solid ${CTRL.rule}`, marginTop: 11, paddingTop: 10 }}>
          <button type="button" onClick={() => setTypeAnchor(null)} style={doneBtn}>Done</button>
        </div>
      </Popover>

      {/* ---- affiliation popover: two independent multi-selects (§2.2, mockup:145-182) ----
          Identity filters Person.primaryInstitution (#982's `person` basis), Article filters
          AuthorshipReview.author_affiliation (its `byline` basis). Both selected = both must
          match; the server ANDs them. Each list has its own facet counts, so the same bucket
          key shows different numbers on the two sides — that is the point, not a bug. */}
      <Popover open={!!affilAnchor} anchorEl={affilAnchor} onClose={() => setAffilAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }} transformOrigin={{ vertical: "top", horizontal: "left" }}
        PaperProps={{ style: { ...popPaper(320), display: "flex", flexDirection: "column", gap: 14 } }}>
        <div>
          <div style={popHeadRow}>
            <div style={popHead}>IDENTITY AFFILIATION <span style={popHeadCount}>{selectedInstitutions.length} of {identityOptions.length}</span></div>
            <button type="button" onClick={() => setSelectedInstitutions([])} style={linkBtn}>Any</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {identityOptions.length === 0 && <div style={emptyOptStyle}>No institutions</div>}
            {identityOptions.map((inst) => {
              const on = selectedInstitutions.includes(inst.key);
              return (
                <label key={inst.key} style={optRow(on)}>
                  <Checkbox size="small" checked={on} style={{ padding: 0 }}
                    onChange={() => setSelectedInstitutions((s) => toggleInList(s, inst.key))} />
                  <span style={{ flex: 1, minWidth: 0 }}>{INSTITUTION_LABELS[inst.key] || inst.key}</span>
                  <span style={optCountStyle}>{inst.n.toLocaleString()}</span>
                </label>
              );
            })}
          </div>
          <div style={helperStyle}>Where the proposed WCM person sits in the directory.</div>
        </div>
        <div>
          <div style={popHeadRow}>
            {/* "N of M" needs the facet to know M, so M is withheld until it arrives rather
                than briefly reading "1 of 1". */}
            <div style={popHead}>ARTICLE AFFILIATION <span style={popHeadCount}>{selectedAuthorAffiliations.length} of {authorFacetsReady ? authorOptions.length : "…"}</span></div>
            <button type="button" onClick={() => setSelectedAuthorAffiliations([])} style={linkBtn}>Any</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {/* These counts are fetched on demand (see affilFacetKey), so this list has a third
                state the identity list above does not: not-yet-known. Distinguish it from
                genuinely empty — "No institutions" would be a false statement while the request
                is still out, and a 0 beside a checkbox is worse, because it reads as fact.
                Already-ticked boxes keep rendering throughout (withSelected puts them back) and
                stay tickable; only their count column is blanked. So a selection is never
                hidden, and never mislabelled, by its own facet being in flight. */}
            {!authorFacetsReady && <div style={emptyOptStyle}>Counting…</div>}
            {authorFacetsReady && authorOptions.length === 0 && <div style={emptyOptStyle}>No institutions</div>}
            {authorOptions.map((inst) => {
              const on = selectedAuthorAffiliations.includes(inst.key);
              return (
                <label key={inst.key} style={optRow(on)}>
                  <Checkbox size="small" checked={on} style={{ padding: 0 }}
                    onChange={() => setSelectedAuthorAffiliations((s) => toggleInList(s, inst.key))} />
                  <span style={{ flex: 1, minWidth: 0 }}>{INSTITUTION_LABELS[inst.key] || inst.key}</span>
                  <span style={optCountStyle}>{authorFacetsReady ? inst.n.toLocaleString() : "—"}</span>
                </label>
              );
            })}
          </div>
          <div style={helperStyle}>As printed on the article. Several may be selected.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${CTRL.rule}`, paddingTop: 11 }}>
          {/* Reset here restores only THIS control's two lists (mockup:697), not every filter —
              that is the Filters popover's "Reset all". */}
          <button type="button" onClick={() => patchFilters({
            selectedInstitutions: FILTER_DEFAULTS.selectedInstitutions.slice(),
            selectedAuthorAffiliations: FILTER_DEFAULTS.selectedAuthorAffiliations.slice(),
          })} style={{ ...linkBtn, color: CTRL.muted }}>Reset</button>
          <button type="button" onClick={() => setAffilAnchor(null)} style={doneBtn}>Done</button>
        </div>
      </Popover>

      {/* ---- Filters popover (§2.3, mockup:212-270): QUEUE / MATCH CLASS / DATE / HIDE ---- */}
      <Popover open={!!filtersAnchor} anchorEl={filtersAnchor} onClose={() => setFiltersAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ style: { ...popPaper(400), padding: "16px 18px 14px" } }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          <div>
            <div style={{ ...popHead, marginBottom: 8 }}>QUEUE</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {QUEUE_OPTIONS.map((q) => {
                const n = q.key === "conflicts" ? summary?.conflicts : q.key === "duplicates" ? summary?.duplicates : undefined;
                return (
                  <button key={q.key} type="button" onClick={() => setStatusView(q.key)}
                    style={{ ...listBtn(statusView === q.key), flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                    <span>{STATUS_VIEW_LABEL[q.key]}{n != null ? ` (${n.toLocaleString()})` : ""}</span>
                    {q.note && <span style={{ fontSize: 12, fontWeight: 400, color: CTRL.soft }}>{q.note}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            {/* MATCH CLASS is the union of the two deleted chip strips (HANDOFF §3a): three lane
                entries and four classification entries in ONE single-select list, mockup order.
                selectMatchClass writes both axes in one patch, so picking a lane resets the
                class and vice versa — the lane's old "single" default cannot be stranded. */}
            <div style={{ ...popHead, marginBottom: 8 }}>MATCH CLASS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {MATCH_CLASS_OPTIONS.map((opt) => {
                const n = opt.count(summary);
                return (
                  <Tip key={opt.label} title={opt.hint} placement="left" arrow>
                    <button type="button" onClick={() => selectMatchClass(opt)}
                      style={{ ...listBtn(activeMatchClass === opt), justifyContent: "space-between" }}>
                      <span>{opt.label}</span>
                      <span style={{ fontSize: 12, color: "#8b93a2", fontVariantNumeric: "tabular-nums" }}>
                        {n != null ? n.toLocaleString() : ""}
                      </span>
                    </button>
                  </Tip>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ ...popHead, marginBottom: 7 }}>DATE</div>
            <select value={datePreset} onChange={(e) => applyDatePreset(e.target.value)} aria-label="Article publication date"
              style={{ font: "inherit", width: "100%", border: `1px solid ${CTRL.border}`, borderRadius: 6, padding: "7px 8px", fontSize: 13.5, background: "#fff", color: CTRL.ink, cursor: "pointer" }}>
              {DATE_PRESET_ORDER.map((p) => <option key={p} value={p}>{DATE_PRESET_LABEL[p]}</option>)}
            </select>
            {datePreset === "custom" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <label style={{ fontSize: 12.5, color: CTRL.muted, display: "flex", alignItems: "center", gap: 6 }}>
                  From
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                    style={{ font: "inherit", padding: "5px 8px", borderRadius: 6, border: `1px solid ${CTRL.border}`, fontSize: 13, color: CTRL.ink }} />
                </label>
                <label style={{ fontSize: 12.5, color: CTRL.muted, display: "flex", alignItems: "center", gap: 6 }}>
                  To
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                    style={{ font: "inherit", padding: "5px 8px", borderRadius: 6, border: `1px solid ${CTRL.border}`, fontSize: 13, color: CTRL.ink }} />
                </label>
                {(dateFrom || dateTo) && (
                  <button type="button" onClick={() => patchFilters({ dateFrom: "", dateTo: "" })} style={{ ...linkBtn, color: CTRL.muted }}>
                    Clear dates
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <div style={{ ...popHead, marginBottom: 8 }}>HIDE</div>
            <Tip title={"Hides rows with no proposed identity at all (the “No suggested identity” rows below) — there is nothing for Accept or Reject to act on there. Does NOT hide “No ReCiter identity” rows, where a person IS proposed but isn't in ReCiter yet — see the checkbox below."} placement="left" arrow>
              <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: CTRL.ink, padding: "4px 0", cursor: "pointer" }}>
                <Checkbox size="small" checked={hideNoSuggestion}
                  onChange={(e) => setHideNoSuggestion(e.target.checked)} style={{ padding: 0 }} />
                Rows with no suggested identity
              </label>
            </Tip>
            <Tip title={"Hides rows proposing a person who has no ReCiter identity yet (the “No ReCiter identity” pill) — there is a proposal, just nothing in ReCiter to accept it into. The totals above reflect this filter when it's on."} placement="left" arrow>
              <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: CTRL.ink, padding: "4px 0", cursor: "pointer" }}>
                <Checkbox size="small" checked={hideNoIdentity}
                  onChange={(e) => setHideNoIdentity(e.target.checked)} style={{ padding: 0 }} />
                Rows with no ReCiter identity
              </label>
            </Tip>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${CTRL.rule}`, paddingTop: 12 }}>
            <button type="button" onClick={resetAll} style={{ ...linkBtn, color: CTRL.muted }}
              title="Restore every filter to its default (sort is left alone)">Reset all</button>
            <button type="button" onClick={() => setFiltersAnchor(null)} style={{ ...doneBtn, padding: "7px 16px" }}>Done</button>
          </div>
        </div>
      </Popover>

      {/* ---- keyboard legend (§2.2, mockup:200-210) --------------------------------------
          Transcribed from the HANDLER, not from the mockup's list: the mockup names J/K/Y/N/S/F,
          but `f` is not implemented and `u`, `x` and Enter are. Documenting a shortcut that does
          nothing is worse than omitting it, so the list below is exactly what the keydown
          listener does, including the queue restrictions three of them carry. */}
      <Popover open={!!keysAnchor} anchorEl={keysAnchor} onClose={() => setKeysAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ style: { width: 250, maxWidth: "calc(100vw - 32px)", background: "#101c30", color: "#dbe2ee", borderRadius: 8, padding: "12px 14px", boxShadow: "0 12px 28px rgba(16,28,48,0.22)" } }}>
        <div style={{ fontSize: 11, letterSpacing: ".1em", color: "#8b96aa", marginBottom: 9 }}>KEYBOARD</div>
        {KEY_LEGEND.map((k) => (
          <div key={k.key} style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "3px 0", fontSize: 13 }}>
            <span style={{ minWidth: 22, textAlign: "center", border: "1px solid #3a4a66", borderRadius: 4, padding: "1px 0", fontSize: 12, flex: "none" }}>{k.key}</span>
            <span>{k.label}</span>
          </div>
        ))}
        <div style={{ fontSize: 11.5, color: "#8b96aa", marginTop: 9, lineHeight: 1.45 }}>
          Inactive while a popover, menu or dialog is open, and while typing in a field.
        </div>
      </Popover>

      {/* T4: "Assign selected (N) to…" picker — union of every candidate the selection
          proposes (rowCandidateLites: candidate_cwids_json for a multi row, the row's own
          top_cwid for a single one), ranked by how many selected rows propose it, plus a
          typed-cwid escape hatch for someone the union doesn't include. Choosing an option (B-8)
          fires the server lookup rather than submitting or computing anything client-side. */}
      <Menu anchorEl={assignMenuAnchor} open={!!assignMenuAnchor} onClose={() => setAssignMenuAnchor(null)}
        PaperProps={{ style: { maxWidth: 380 } }}>
        {assignCandidateUnion.length === 0 && <MenuItem disabled>No candidates on the selected rows</MenuItem>}
        {assignCandidateUnion.map((c) => (
          <MenuItem key={c.cwid} dense onClick={() => chooseAssignTarget(c.cwid)}>
            {c.name ? `${c.name} ` : ""}({c.cwid}) — matches {c.matches} of {selectedRows.length} selected
          </MenuItem>
        ))}
        <div onClick={(e) => e.stopPropagation()} style={{
          display: "flex", gap: 6, alignItems: "center", padding: "8px 12px",
          borderTop: assignCandidateUnion.length ? "1px solid #e8edf2" : "none",
        }}>
          <label style={{ fontSize: 11.5, color: "#94a3b8" }}>Someone else:</label>
          <input value={assignOtherCwid} placeholder="cwid"
            onChange={(e) => setAssignOtherCwid(e.target.value.trim())}
            onKeyDown={(e) => { if (e.key === "Enter" && assignOtherCwid && !assignLookupCwid) chooseAssignTarget(assignOtherCwid); }}
            style={{ width: 90, padding: "3px 6px", fontSize: 12, border: "1px solid #cbd5e1", borderRadius: 4, color: "#334155" }} />
          <button style={btn("accept", !assignOtherCwid || !!assignLookupCwid)} disabled={!assignOtherCwid || !!assignLookupCwid}
            onClick={() => chooseAssignTarget(assignOtherCwid)}>
            Go
          </button>
        </div>
      </Menu>

      {/* B-8: the ONE server lookup chooseAssignTarget fires before the confirm dialog can
          render — a transient "Looking up…" step rather than a spinner glued onto the picker,
          since the picker (a MUI Menu) is already closed by the time this fires. */}
      {assignLookupCwid && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15,23,42,.35)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1400,
        }}>
          <div style={{
            background: "#fff", borderRadius: 10, padding: "16px 20px", fontSize: 13,
            color: "#475569", boxShadow: "0 8px 32px rgba(15,23,42,.25)",
          }}>
            Looking up {assignLookupCwid}…
          </div>
        </div>
      )}

      {/* B-8: bulk-assign confirm step — the bulk equivalent of the per-row
          OFF_CANDIDATE/NO_RECITER_IDENTITY 422 confirms. Built entirely on the lookup's answer
          (assignConfirm.name/hasIdentity), never on the typed string: the curator confirms
          against a human name the server looked up, or an explicit "no name on file" notice,
          exactly like the single-row confirm does. EVERY selected row is submitted on Assign
          (see doBulkAssign) — onCandidate/offCandidate below are stated for transparency, not a
          submit/skip choice, so the button is never disabled by a 0-to-submit count (the
          sts2022 dead end this replaces). */}
      {assignConfirm && (
        <div onClick={() => setAssignConfirm(null)} style={{
          position: "fixed", inset: 0, background: "rgba(15,23,42,.35)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1400,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "#fff", borderRadius: 10, padding: 20, maxWidth: 460,
            boxShadow: "0 8px 32px rgba(15,23,42,.25)",
          }}>
            {(() => {
              const total = assignConfirm.onCandidate.length + assignConfirm.offCandidate.length;
              return (
                <>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
                    Assign {total} row{total === 1 ? "" : "s"} to{" "}
                    {assignConfirm.name ? `${assignConfirm.name} ` : ""}({assignConfirm.cwid})
                  </div>
                  <div style={{ fontSize: 12.5, color: "#475569", marginBottom: 10, lineHeight: 1.45 }}>
                    {assignConfirm.onCandidate.length} of {total} selected row{total === 1 ? "" : "s"} propose
                    {assignConfirm.onCandidate.length === 1 ? "s" : ""} this person.
                    {assignConfirm.offCandidate.length > 0 && (
                      <> {assignConfirm.offCandidate.length} don’t — confirming assigns{" "}
                        {assignConfirm.offCandidate.length === 1 ? "it" : "them"} anyway, the same write
                        the per-row confirm makes.</>
                    )}
                  </div>
                </>
              );
            })()}
            {!assignConfirm.hasIdentity ? (
              <div style={{ fontSize: 12.5, color: "#b45309", marginBottom: 12, lineHeight: 1.45 }}>
                {assignConfirm.cwid} has no ReCiter identity. Confirming records your decision on each row
                only — it will NOT be added to the person’s publication record, because there is no
                identity to add it to.
              </div>
            ) : !assignConfirm.name ? (
              <div style={{ fontSize: 12.5, color: "#b45309", marginBottom: 12, lineHeight: 1.45 }}>
                No name on file anywhere for {assignConfirm.cwid} — check the identifier.
              </div>
            ) : null}
            <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 14, lineHeight: 1.45 }}>
              Each row also records “not mine” for its other proposed candidates that have a ReCiter
              identity (the F-2 policy) — same as a per-row assign. Reopening a row undoes both.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={btn("ghost")} onClick={() => setAssignConfirm(null)}>Cancel</button>
              <button style={btn("accept")} onClick={doBulkAssign}>
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

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
              const multiCount = selectedRows.filter((r) => !r.single_candidate).length;
              // scopus excluded: its reject is row-only (no GoldStandard write), so the amber sentence below would be false for it
              const noIdentityCount = selectedRows.filter((r) => r.single_candidate && r.identity_in_reciter === false && r.source !== "scopus").length;
              const scopusCount = selectedRows.filter((r) => r.source === "scopus").length;
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
                    <div style={{ fontSize: 12.5, color: "#b45309", marginBottom: 10, lineHeight: 1.45 }}>
                      {noIdentityCount} propose someone with no ReCiter identity. The rejection is still
                      written against that identifier and applies to their profile once ReCiter has an
                      identity for them.
                    </div>
                  )}
                  {scopusCount > 0 && (
                    <div style={{ fontSize: 12.5, color: "#475569", marginBottom: 10, lineHeight: 1.45 }}>
                      {scopusCount} Scopus row{scopusCount === 1 ? "" : "s"} close here only — nothing is
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

      {/* card queue */}
      <div>
        {loading && <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>Loading…</div>}
        {!loading && rows.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>No authorships match these filters.</div>
        )}
        {!loading && rows.map((r) => (
          <AuthorshipCard
            key={r.id}
            row={r}
            // Both review queues (see STATUS_VIEW_LABEL above) hand the card "open": their rows
            // ARE open rows, so the card must offer the same per-row actions, including Force.
            // Spelled out rather than routed through a helper so the type narrows here.
            statusView={statusView === "duplicates" || statusView === "conflicts" ? "open" : statusView}
            // …but the checkbox must NOT follow that substitution, and this is why it is a prop
            // rather than something the card recomputes from the statusView it was handed. Bulk
            // actions are open-queue only (isBulkSelectable returns false for every other view,
            // and toggleSelect gates on the REAL statusView), so a card told "open" inside the
            // duplicates or conflicts queue rendered an enabled checkbox that did nothing when
            // clicked. Computed here, from the real queue, so the page and the card cannot
            // disagree about what is selectable.
            selectable={isBulkSelectable(r, statusView)}
            isExpanded={expanded === r.id}
            isSelected={selected.has(r.id)}
            isFocused={focusedId === r.id}
            acting={actingId === r.id}
            pickedCwid={picked[r.id]}
            registerRef={(el) => { cardRefs.current[r.id] = el; }}
            onFocus={() => setFocusedId(r.id)}
            onToggleExpand={() => setExpanded((e) => (e === r.id ? null : r.id))}
            onToggleSelect={() => toggleSelect(r)}
            onPick={(cwid) => setPicked((p) => ({ ...p, [r.id]: cwid }))}
            onAction={(action, extra) => doAction(r, action, extra)}
            onMenu={(anchor) => setMenu({ anchor, row: r })}
            onAssignOther={() => focusAssignOther(r.id)}
            onNarrowPmid={() => narrowToPmid(r.pmid)}
            onFindOthers={() => findOthersLikeThis(r.wcm_author)}
            // §2.6 hover card: `undefined` means "not asked yet / still in flight", which the
            // card renders as a loading line. An answered cwid always has an entry.
            priorNames={r.top_cwid ? priorNames[r.top_cwid] : undefined}
            onHoverIdentity={() => requestPriorNames(r.top_cwid)}
            // Session conflict if this curator just hit it; otherwise rehydrate the one
            // persisted on the row, so a refresh (or a different curator) still sees why.
            conflict={conflicts[r.id] ?? (r.accept_conflict ? {
              kind: "dup" as const,
              id: r.id, action: "accept", message: r.accept_conflict, matches: [],
              wcm_author: r.wcm_author, top_name: r.top_name, ts: 0,
            } : undefined)}
            onClearConflict={() => clearConflict(r.id)}
          />
        ))}
      </div>

      {/* pagination */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18, color: "#475569", fontSize: 13 }}>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{count.toLocaleString()} authorships · page {page + 1} of {totalPages}</span>
        <span style={{ display: "flex", gap: 8 }}>
          <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} style={btn("ghost", page === 0)}>Previous</button>
          <button disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} style={btn("ghost", page + 1 >= totalPages)}>Next</button>
        </span>
      </div>

      {/* overflow menu: Snooze / Dismiss, plus Reject all for multi-candidate rows.
          Single-candidate Reject is a primary button on the card itself, not buried here.
          Multi-candidate's "none of them wrote it" is a real reject too — against every
          candidate, not just top_cwid — so it belongs here, not the no-op Dismiss below.
          "Assign to someone else…" is a SHORTCUT, not a new control (issue #937): it expands
          the card and focuses the typed-cwid input <AssignOther> already renders, the same
          input the "Evidence"/"Pick one" disclosure reveals. On a single-candidate row that
          disclosure is the ONLY other item, and its label gives no hint an assign control
          lives behind it — a two-item menu (Snooze/Dismiss) reads as "this is all there is",
          which is exactly how the feature got reported as unshipped after #936 put it live.
          "Show N others like this" (T5) mirrors the card's own ghost button — offered for every
          row that has a server-computed like_count > 0, not just multi-candidate ones, and
          hidden entirely (proactive) once there's nobody else to gather. */}
      <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)}>
        {menu && !menu.row.single_candidate && (
          <MenuItem onClick={() => menu && doAction(menu.row, "reject")} style={{ color: "#b91c1c" }}>
            <IconX size={14} style={{ marginRight: 8 }} /> Reject all
          </MenuItem>
        )}
        {menu && (
          <MenuItem onClick={() => {
            const id = menu.row.id;
            setMenu(null);
            focusAssignOther(id);
          }}>
            Assign to someone else…
          </MenuItem>
        )}
        {menu && (menu.row.like_count ?? 0) > 0 && (
          <MenuItem onClick={() => { findOthersLikeThis(menu.row.wcm_author); setMenu(null); }}>
            Show {menu.row.like_count} other{menu.row.like_count === 1 ? "" : "s"} like this
          </MenuItem>
        )}
        <MenuItem onClick={() => menu && doAction(menu.row, "snooze")}>Snooze 90 days</MenuItem>
        <MenuItem onClick={() => menu && doAction(menu.row, "dismiss")}>Dismiss</MenuItem>
      </Menu>

      {/* undo (immediate reversal, batched) */}
      <Snackbar open={!!undo} autoHideDuration={12000} onClose={() => setUndo(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        message={undo ? undo.label : ""}
        action={
          <button onClick={doUndo}
            style={{ color: "#7cc4ff", background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>UNDO</button>
        } />

      {/* error */}
      <Snackbar open={!!errorMsg} autoHideDuration={10000} onClose={() => setErrorMsg("")}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}>
        <Alert severity="error" variant="filled" onClose={() => setErrorMsg("")} sx={{ maxWidth: 460 }}>
          {errorMsg}
        </Alert>
      </Snackbar>

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
                <span style={{ color: stillActive ? "#b45309" : "#94a3b8", fontWeight: 500 }}>
                  {stillActive ? "unresolved" : "resolved/cleared"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{entry.message}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                {new Date(entry.ts).toLocaleTimeString()}
              </div>
            </MenuItem>
          );
        })}
      </Menu>

      {/* server-backed "Recent activity" — the 15 most-recently-resolved authorships across the
          whole queue (global, cross-curator, cross-session; see authorshipRecentActivity).
          Read-only lookback: resolved rows have no view left to jump to, so entries are
          display-only, not clickable, unlike historyAnchor's jump-to-card entries above. */}
      <Menu anchorEl={activityAnchor} open={!!activityAnchor} onClose={() => setActivityAnchor(null)}
        PaperProps={{ style: { maxWidth: 420, maxHeight: 420 } }}>
        {recentActivity.length === 0 && <MenuItem disabled>No recent activity</MenuItem>}
        {recentActivity.map((entry) => {
          const verb = STATUS_LABEL[entry.status || ""] || entry.status || "Resolved";
          const label = entry.title
            || (entry.source === "scopus" && entry.external_id ? `Scopus ${entry.external_id}` : entry.pmid ? `PMID ${entry.pmid}` : "Untitled");
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
            <MenuItem key={entry.id} dense disableRipple
              style={{ whiteSpace: "normal", display: "block", padding: "8px 14px", cursor: "default" }}>
              <div style={{ fontSize: 12.5, color: "#0f172a" }}>
                <strong>{verb}</strong> — {label}
              </div>
              {(subjectName || subjectCwid) && (
                <div style={{ fontSize: 11.5, color: "#475569", marginTop: 2 }}>
                  {subjectName || "—"}{" "}
                  {subjectCwid && (
                    <a href={`/curate/${subjectCwid}`} target="_blank" rel="noreferrer" style={{ color: "#2563eb", textDecoration: "none" }}>
                      {subjectCwid}
                    </a>
                  )}
                </div>
              )}
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
                <span>{entry.reviewer || "—"} · {formatActivityDate(entry.resolved_at)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); undoRecentActivity(entry); }}
                  style={{ font: "inherit", marginLeft: "auto", background: "none", border: "none", color: "#2563eb", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                  Undo
                </button>
              </div>
            </MenuItem>
          );
        })}
      </Menu>
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
  accent: "#2563c9",       // active border / primary button
  accentBg: "#eef4fd",     // active row + open-popover button fill
  accentInk: "#1c3f7d",
  band: "#fbfaf8",         // chip row + the "i" strip
  chipBorder: "#c8d8f4",
};

// §2.1's three header-band buttons (mockup:76-81). One shape, three palettes: red for identity
// conflicts, amber for duplicate records, plain for Activity and the session conflict log.
const alertPill = (kind: "red" | "amber" | "plain"): CSSProperties => ({
  font: "inherit",
  display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 6, padding: "7px 12px",
  fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
  border: `1px solid ${kind === "red" ? "#dcb4b0" : kind === "amber" ? "#e6c99a" : CTRL.border}`,
  background: kind === "red" ? "#fdf3f2" : kind === "amber" ? "#fdf6e8" : "#fff",
  color: kind === "red" ? "#9a3128" : kind === "amber" ? "#8a5a08" : "#4a5262",
});

// source segment (mockup:601-605): active segment is white with a 1px shadow, not a border.
const segBtn = (active: boolean): CSSProperties => ({
  font: "inherit",
  border: "none", cursor: "pointer", borderRadius: 5, padding: "7px 14px", fontSize: 13.5,
  whiteSpace: "nowrap",
  background: active ? "#fff" : "transparent",
  color: active ? CTRL.ink : CTRL.muted,
  fontWeight: active ? 600 : 400,
  boxShadow: active ? "0 1px 2px rgba(27,36,50,0.12)" : "none",
});

// the two dropdown buttons: border goes blue when the popover is open OR the filter is set, so
// an active facet is visible without opening it (mockup:684-686, :695-696).
const dropBtn = (active: boolean, open: boolean): CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 8, font: "inherit", fontSize: 13.5,
  border: `1px solid ${open || active ? CTRL.accent : CTRL.border}`,
  background: open ? CTRL.accentBg : "#fff", color: CTRL.ink,
  borderRadius: 6, padding: "7px 11px", cursor: "pointer", whiteSpace: "nowrap",
  maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis",
});
const caretStyle: CSSProperties = { color: CTRL.soft, fontSize: 11 };
const countBadgeStyle: CSSProperties = {
  minWidth: 19, textAlign: "center", fontSize: 12, fontVariantNumeric: "tabular-nums",
  background: CTRL.accent, color: "#fff", borderRadius: 999, padding: "1px 6px",
};

const popPaper = (width: number): CSSProperties => ({
  width, maxWidth: "calc(100vw - 32px)", border: `1px solid ${CTRL.border}`, borderRadius: 8,
  boxShadow: "0 16px 40px rgba(27,36,50,0.16)", padding: "14px 14px 12px",
});
const popHead: CSSProperties = { fontSize: 11, letterSpacing: ".1em", color: CTRL.muted };
const popHeadCount: CSSProperties = { color: "#9aa2b1", fontVariantNumeric: "tabular-nums" };
const popHeadRow: CSSProperties = {
  display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 6,
};
const linkBtn: CSSProperties = {
  font: "inherit",
  border: "none", background: "none", padding: 0, fontSize: 12.5, color: CTRL.accent,
  cursor: "pointer",
};
const doneBtn: CSSProperties = {
  font: "inherit",
  border: `1px solid ${CTRL.accent}`, background: CTRL.accent, color: "#fff", borderRadius: 6,
  padding: "6px 14px", fontSize: 13.5, cursor: "pointer",
};
// a checkbox row in a multiselect popover
const optRow = (on: boolean): CSSProperties => ({
  display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, padding: "5px 7px",
  borderRadius: 5, cursor: "pointer",
  background: on ? CTRL.accentBg : "transparent", color: on ? CTRL.accentInk : "#3d4756",
});
const optCountStyle: CSSProperties = { fontSize: 12, color: "#8b93a2", fontVariantNumeric: "tabular-nums" };
const emptyOptStyle: CSSProperties = { fontSize: 13, color: "#9aa2b1", padding: "5px 7px" };
const helperStyle: CSSProperties = { fontSize: 12.5, color: CTRL.soft, marginTop: 5, lineHeight: 1.45 };
// a single-select list row in the Filters popover (QUEUE, MATCH CLASS)
const listBtn = (active: boolean): CSSProperties => ({
  font: "inherit",
  display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
  border: "none", cursor: "pointer", borderRadius: 5, padding: "7px 9px", fontSize: 13.5,
  background: active ? CTRL.accentBg : "transparent",
  color: active ? CTRL.accentInk : "#3d4756",
  fontWeight: active ? 600 : 400,
});
// the bulk bar's buttons (mockup:292-301): Accept is the only coloured one.
const barBtn = (kind: "accept" | "plain"): CSSProperties => ({
  font: "inherit",
  border: `1px solid ${kind === "accept" ? "#9dc4a8" : CTRL.border}`,
  background: kind === "accept" ? "#eef7f0" : "#fff",
  color: kind === "accept" ? "#146c39" : CTRL.ink,
  borderRadius: 6, padding: "6px 13px", fontSize: 13.5, cursor: "pointer",
});

// The `?` legend (§2.2). Transcribed from the keydown handler in this file, not from the
// mockup's fixture: the mockup lists J/K/Y/N/S/F, but `f` (open filters) is not implemented and
// `u`, `x` and Enter are. Three of these only fire on the Open queue, which the handler enforces
// and the labels therefore say.
const KEY_LEGEND: Array<{ key: string; label: string }> = [
  { key: "J", label: "Next row" },
  { key: "K", label: "Previous row" },
  { key: "Y", label: "Accept (single-candidate, Open queue)" },
  { key: "N", label: "Reject (Open queue)" },
  { key: "S", label: "Snooze (Open queue)" },
  { key: "X", label: "Select / deselect the row" },
  { key: "U", label: "Undo the last action" },
  { key: "↵", label: "Open the record in a new tab" },
];

const pubChipStyle = (active: boolean): CSSProperties => ({
  font: "inherit",
  border: `1px solid ${active ? CTRL.chipBorder : CTRL.border}`, background: active ? CTRL.accentBg : "#fff",
  color: active ? CTRL.accentInk : CTRL.muted, borderRadius: 999, padding: "3px 10px", fontSize: 12,
  fontWeight: 600, cursor: "pointer",
});

// ---- card ----------------------------------------------------------------
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
  priorNames?: PriorNames;
  onHoverIdentity: () => void;
  conflict?: ConflictEntry;
  onClearConflict: () => void;
}

const AuthorshipCard = ({
  row: r, statusView, selectable, isExpanded, isSelected, isFocused, acting, pickedCwid,
  registerRef, onFocus, onToggleExpand, onToggleSelect, onPick, onAction, onMenu, onAssignOther, onNarrowPmid,
  onFindOthers, priorNames, onHoverIdentity,
  conflict, onClearConflict,
}: CardProps) => {
  // Matches the server accept gate (`!row.single_candidate`) and the sibling gates below
  // (toggleSelect, nearCertain, eligibleRows) — the n_candidates>1 clause let a card keep
  // showing Accept on a row the server would 409 (stale n_candidates, single_candidate
  // already flipped), landing the curator on the generic "nothing was saved" toast.
  const isMulti = !r.single_candidate;
  const noIdentity = r.identity_in_reciter === false;
  const alreadyRejected = r.top_already_rejected === true;
  // #938 — ReCiterDB#177 nulls the producer's candidate columns (top_cwid included) on rows
  // the merged matcher no longer matches to anyone; gated on top_cwid itself, not on the
  // identity lookup above, which is vacuously true (`!r.top_cwid || …`) and so never fires here.
  const noSuggestion = !r.top_cwid;
  const isAbsent = r.top_io_score == null;
  const wcm = hasWcm(r.author_affiliation);
  const candidates = isMulti ? parseCandidates(r.candidate_cwids_json) : [];
  const meta = CLASS_META[r.classification || "absent"];
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
  const [identityHover, setIdentityHover] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelHover = () => { if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; } };
  useEffect(() => cancelHover, []);
  const openIdentityHover = () => {
    cancelHover();
    hoverTimer.current = setTimeout(() => { setIdentityHover(true); onHoverIdentity(); }, 220);
  };
  const closeIdentityHover = () => { cancelHover(); setIdentityHover(false); };

  const cardStyle: CSSProperties = {
    background: isSelected ? "#eff6ff" : "#fff",
    border: "1px solid #e8edf2",
    borderRadius: 10,
    marginBottom: 11,
    boxShadow: isFocused ? "0 0 0 2px #2563eb" : "0 1px 2px rgba(15,23,42,.04)",
    transition: "box-shadow 150ms, background 150ms",
    cursor: "pointer",
  };

  return (
    <article ref={registerRef} tabIndex={0} onFocus={onFocus} onMouseEnter={onFocus} onClick={onToggleExpand} style={cardStyle}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 15px" }}>
        {/* selection checkbox — single-candidate open rows with a ReCiter identity, PLUS
            (T4) open, non-scopus multi-candidate rows, for bulk-assign only. See `selectable`. */}
        <input type="checkbox" disabled={!selectable}
          checked={isSelected} onChange={onToggleSelect} onClick={(e) => e.stopPropagation()}
          aria-label={`select ${r.wcm_author || ""}`}
          style={{ width: 16, height: 16, marginTop: 3, accentColor: "#2563eb", cursor: selectable ? "pointer" : "default", flex: "none", opacity: selectable ? 1 : 0.3 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* L1 — WCM author + position */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>{r.wcm_author}</span>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{r.author_position_label} author</span>
            {/* §2.6's co-author pill. The mockup labels this "+N more WCM on this paper", which
                this number does not mean and must not claim: pmid_sibling_count counts sibling
                authorship_review rows in the ACTIVE STATUS VIEW only, so a co-author already
                accepted onto their identity — the commonest case on a well-worked paper — is
                not in it. Rather than ship the mockup's wording over a number that would
                understate the paper's WCM authors, the label says what it counts. Fixing the
                count itself needs a person_article join the list query does not have. */}
            {(r.pmid_sibling_count ?? 1) > 1 && (
              <Tip title="Other authorship rows for this paper still sitting in the queue you're viewing. Co-authors already assigned to an identity are NOT counted, so this is not the paper's full WCM author list. Click to narrow the queue to this PMID." placement="top" arrow>
                <button onClick={(e) => { e.stopPropagation(); onNarrowPmid(); }} style={{
                  display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid #e2e9f3", background: "#f4f7fc",
                  color: "#2563eb", borderRadius: 12, padding: "1px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                }}>
                  <IconUsers size={12} /> +{(r.pmid_sibling_count as number) - 1} more in this queue
                </button>
              </Tip>
            )}
          </div>

          {/* L2 — proposed identity */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, fontSize: 13, color: "#475569", flexWrap: "wrap" }}>
            <span style={{ color: "#94a3b8" }}>→</span>
            {isMulti ? (
              <span style={{ color: "#94a3b8" }}>choose among {r.n_candidates} WCM homonyms</span>
            ) : noSuggestion ? (
              <span style={{ fontStyle: "italic", color: "#94a3b8" }}>No suggested identity — assign one below</span>
            ) : (
              <>
                {/* §2.6: the proposed identity's name + cwid carry the 296px hover card. The
                    wrapper is the hover target AND the positioning context for the popup. */}
                <span onMouseEnter={openIdentityHover} onMouseLeave={closeIdentityHover}
                  style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, color: "#0f172a" }}>{r.top_name}</span>
                  {r.top_cwid && (
                    <a href={`/curate/${r.top_cwid}`} target="_blank" rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title={`Open ${r.top_name || r.top_cwid}'s curate profile`}
                      style={{ color: "#2563eb", textDecoration: "none" }}>{r.top_cwid}</a>
                  )}
                  {identityHover && (
                    <IdentityHoverCard row={r} priorNames={priorNames} />
                  )}
                </span>
                <span style={{ color: "#94a3b8" }}>· {r.top_person_type}{r.top_dept ? `, ${r.top_dept}` : ""}</span>
              </>
            )}
            {/* T5: "Show N others like this" — proactive (only rendered once the server-side
                like_count says there IS someone) and variant-tolerant (the normalized-key match
                behind like_count catches "Bernard J. Park" starting from "Bernard Park", which
                T4's free-text-box version could not). Every open card, not just multi-candidate
                ones — a curator working a single-candidate row may still want the group. */}
            {statusView === "open" && likeCount > 0 && (
              <Tip title={`Filter the queue to ${likeCount} other open row${likeCount === 1 ? "" : "s"} for "${r.wcm_author}" (matches middle-initial and similar byline variants)`} placement="top" arrow>
                <button style={btn("ghost")} onClick={(e) => { e.stopPropagation(); onFindOthers(); }}>
                  Show {likeCount} other{likeCount === 1 ? "" : "s"} like this
                </button>
              </Tip>
            )}
          </div>

          {/* Scopus source markers — this lane is not-in-PubMed, so no production/IO score exists */}
          {r.source === "scopus" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
              <span style={scopusBadgeStyle}>Scopus</span>
              <span style={notInPubmedPillStyle}>Not in PubMed</span>
              {r.pub_type && <Chip kind="neutral" style={{ fontSize: 10, padding: "1px 7px" }}>{r.pub_type}</Chip>}
              {r.dup_flag && (
                <Tip title={r.dup_reason || "Possible duplicate — already added as an external article"} placement="top" arrow>
                  <span><Chip kind="warn"><IconAlert size={12} /> Possible duplicate</Chip></span>
                </Tip>
              )}
            </div>
          )}
          {r.source !== "scopus" && r.dup_flag && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
              <Tip title={r.dup_reason || "Possible duplicate — already added as an external article"} placement="top" arrow>
                <span><Chip kind="warn"><IconAlert size={12} /> Possible duplicate</Chip></span>
              </Tip>
            </div>
          )}

          {/* PubMed-twin flag — a SEPARATE producer signal from dup_flag above (that one is an
              exact-DOI precheck against external_article) and from accept_conflict (a live 409
              from a previous Accept attempt): the producer's heuristic title+surname PubMed
              search for a Scopus row (or an unverdicted doi/scopus match). Clears once a
              curator sets a verdict — "Same paper" dismisses the row, "Different papers" sets
              matched_pmid_verdict='distinct' and this chip stops rendering for it. */}
          {r.matched_pmid != null && !r.matched_pmid_verdict && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
              <Tip title="The producer found a PubMed record that may be the same paper as this Scopus row (a heuristic title+author search, not a confirmed match). Expand this card to compare and record a verdict." placement="top" arrow>
                <span><Chip kind="warn"><IconAlert size={12} /> PubMed twin? {
                  r.matched_pmid_source === "doi" ? "DOI match"
                    : r.matched_pmid_source === "scopus" ? "Scopus link"
                    : "title match"
                }</Chip></span>
              </Tip>
            </div>
          )}

          {/* #990: another WCM identity already holds ACCEPTED at this row's exact byline slot
              (identityConflictWhere()'s own rival, named). Same amber box register as
              MultiEvidence's "no department" line below — fires on every row shape, single- or
              multi-candidate, since accepted_by is computed per (pmid, author_position), not
              per n_candidates. */}
          {(r.accepted_by?.length ?? 0) > 0 && (
            <div style={{ display: "flex", gap: 7, fontSize: 12.5, lineHeight: 1.5, borderRadius: 7, padding: "8px 10px", background: "#fffbeb", color: "#b45309", marginTop: 5 }}>
              <IconAlert size={15} style={{ marginTop: 1 }} />
              <span>Already accepted by {r.accepted_by!.map((a) => `${a.name} (${a.cwid})`).join(", ")}</span>
            </div>
          )}

          {/* Scopus byline — full author list from authors_json, quiet/muted like the L3 meta line */}
          {r.source === "scopus" && formatAuthorsJson(r.authors_json) && (
            <div style={{ fontSize: 12.5, color: "#94a3b8", marginTop: 3, ...clampStyle(2) }} title={formatAuthorsJson(r.authors_json)}>
              {formatAuthorsJson(r.authors_json)}
            </div>
          )}

          {/* L3 — paper meta (quiet). Title wraps to two lines, then venue and date get a line
              of their own so a long title can no longer push them out of view (#927). PMID link
              now lives in the evidence panel. */}
          <div style={{ fontSize: 12.5, color: "#94a3b8", marginTop: 4, ...clampStyle(2) }} title={stripHtml(r.title)}>
            <span dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(r.title) }} />
          </div>
          {/* §2.6's meta line: journal · Indexed date · PMID + copy. The PMID moved up here
              from the evidence panel, where it was only reachable by expanding the card — a
              curator cross-checking in PubMed had to open a row to get the number. */}
          {(r.journal || r.entrez_date || (r.source !== "scopus" && r.pmid)) && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap", fontSize: 12.5, color: "#94a3b8", marginTop: 2 }}>
              {(r.journal || r.entrez_date) && (
                <span>
                  {r.journal && <i><span dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(r.journal) }} /></i>}
                  {r.entrez_date && (
                    <Tip title={dateLabel(r.source).tip} placement="top" arrow>
                      <span style={{ cursor: "help" }}>{r.journal ? " · " : ""}{dateLabel(r.source).label} {r.entrez_date}</span>
                    </Tip>
                  )}
                </span>
              )}
              {r.source !== "scopus" && r.pmid != null && <PmidCite pmid={r.pmid} />}
            </div>
          )}

          {/* L4 — full affiliation (WCM highlighted), wraps to multiple lines + disclosure */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 7, marginTop: 7, fontSize: 12.5, color: "#475569" }}>
            <span style={{ display: "inline-flex", alignItems: "flex-start", gap: 6, minWidth: 0, flex: 1 }}>
              <IconPin size={15} style={{ color: "#94a3b8", marginTop: 2 }} />
              <span>
                {r.author_affiliation ? highlightAffiliation(r.author_affiliation) : "—"}
              </span>
            </span>
            <button onClick={(e) => { e.stopPropagation(); onToggleExpand(); }} aria-expanded={isExpanded} style={{
              display: "inline-flex", alignItems: "center", gap: 4, marginLeft: "auto", background: "none", border: "none",
              font: "inherit", fontSize: 12, fontWeight: 600, color: isExpanded ? "#2563eb" : "#475569", cursor: "pointer",
              padding: "2px 4px", borderRadius: 5, flex: "none",
            }}>
              {isMulti ? "Pick one" : "Evidence"} {isExpanded ? <IconChevD size={13} /> : <IconChevR size={13} />}
            </button>
          </div>
        </div>

        {/* right rail: score block + primary action + overflow */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
          {/* §2.6 hides the AS diagnosis "once the row is resolved". In this queue the only
              resolved rows on screen are the Dismissed view's (accept/reject/assign remove the
              row outright; snoozed rows are not resolved), so that is the one view it hides in. */}
          <ScoreRail row={r} isMulti={isMulti} isAbsent={isAbsent} candidates={candidates}
            resolved={statusView === "dismissed"} />
          {statusView === "open" ? (
            isMulti ? (
              <button style={btn("ghost")} onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}>Pick one <IconChevR size={13} /></button>
            ) : noSuggestion ? (
              // #938 — top_cwid null: no candidate to accept OR reject (both 409 server-side
              // with nothing proposed), so neither button is offered. "Someone else" below
              // (AssignOther, rendered for every non-multi row) stays the one live action.
              <Tip title="ReCiterDB's matcher no longer matches this byline to any WCM identity — there is no candidate here to accept or reject. Assign it to someone below, or leave it open." placement="top" arrow>
                <span style={noIdentityPillStyle} onClick={(e) => e.stopPropagation()}>No suggested identity</span>
              </Tip>
            ) : noIdentity ? (
              <>
                <button style={btn("reject", acting)} disabled={acting} onClick={(e) => { e.stopPropagation(); onAction("reject"); }}>
                  <IconX size={14} /> Reject
                </button>
                {/* T3 — the pill used to be inert (Accept has nothing to add this authorship
                    to). It's the same "Assign to someone else…" shortcut as the overflow menu:
                    expand the card and focus AssignOther's typed-cwid input. A ghost "Assign…"
                    button sits next to it so the affordance is visible without opening ⋯. */}
                <Tip title={`${r.top_name || r.top_cwid} has no record in ReCiter's Identity table, so there is nothing to add this authorship to. Click to assign this authorship to someone else instead.`} placement="top" arrow>
                  <span
                    style={{ ...noIdentityPillStyle, cursor: "pointer" }}
                    title="Assign this authorship — expand and pick or type a person"
                    onClick={(e) => { e.stopPropagation(); onAssignOther(); }}
                  >
                    No ReCiter identity
                  </span>
                </Tip>
                <button style={btn("ghost", acting)} disabled={acting} onClick={(e) => { e.stopPropagation(); onAssignOther(); }}>
                  Assign…
                </button>
              </>
            ) : alreadyRejected ? (
              <>
                <button style={btn("reject", acting)} disabled={acting} onClick={(e) => { e.stopPropagation(); onAction("reject"); }}>
                  <IconX size={14} /> Reject
                </button>
                <Tip title={`${r.top_name || r.top_cwid} already rejected this exact article via their own curation page, so this authorship can't be accepted.`} placement="top" arrow>
                  <span style={alreadyRejectedPillStyle} onClick={(e) => e.stopPropagation()}>Already rejected by this person</span>
                </Tip>
              </>
            ) : (
              <>
                <button style={btn("reject", acting)} disabled={acting} onClick={(e) => { e.stopPropagation(); onAction("reject"); }}>
                  <IconX size={14} /> Reject
                </button>
                <button style={btn("accept", acting)} disabled={acting} onClick={(e) => { e.stopPropagation(); onAction("accept"); }}>
                  <IconCheck /> Accept
                </button>
              </>
            )
          ) : (
            <button style={btn("ghost", acting)} disabled={acting} onClick={(e) => { e.stopPropagation(); onAction("reopen"); }}>Reopen</button>
          )}
          {statusView === "open" && (
            <button style={iconBtn(acting)} disabled={acting} aria-label="More actions"
              onClick={(e) => { e.stopPropagation(); onMenu(e.currentTarget); }}><IconMore /></button>
          )}
        </div>
      </div>

      {/* snoozed wake-time hint */}
      {statusView === "snoozed" && r.snooze_until && (
        <div style={{ padding: "0 15px 10px 43px", fontSize: 11, color: "#94a3b8" }}>Wakes {r.snooze_until}</div>
      )}

      {/* possible-duplicate conflict — anchored to THIS card (never a global toast that can
          drift over an unrelated one), stays up until the curator acts, names who it's for. */}
      {conflict && (
        <div onClick={(e) => e.stopPropagation()} style={{
          margin: "0 15px 12px 43px", padding: "10px 12px", borderRadius: 8,
          background: "#fffbeb", border: "1px solid #fde68a", fontSize: 12.5, color: "#78350f",
        }}>
          <div style={{ fontWeight: 700, marginBottom: 3 }}>
            {conflict.kind === "no_identity" ? "No ReCiter identity"
              : conflict.kind === "off_candidate" ? "Not a proposed candidate — this writes their record"
                : conflict.kind === "multi_candidate" ? "This row now has multiple candidates"
                  : "Possible duplicate"}
            {" — "}{conflict.wcm_author || conflict.top_name || r.wcm_author}
          </div>
          <div style={{ marginBottom: 6 }}>{conflict.message}</div>
          {conflict.matches.length > 0 && (
            <ul style={{ margin: "0 0 8px", paddingLeft: 18 }}>
              {conflict.matches.map((m, i) => (
                <li key={i} style={{ marginBottom: 2 }}>
                  {m.title || m.detail || m.type || "conflicting record"}
                  {(m.journal || m.pubYear) && (
                    <span style={{ color: "#92400e" }}> ({[m.journal, m.pubYear].filter(Boolean).join(", ")})</span>
                  )}
                  {m.matchedId && <span style={{ color: "#a16207" }}> — {m.matchedId}</span>}
                </li>
              ))}
            </ul>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            {/* multi_candidate has no retry — the row's own re-render (fetchData(true) after
                the 409) already replaced Accept with Pick-one, so there's nothing to confirm. */}
            {conflict.kind !== "multi_candidate" && (
              <button onClick={() => { onAction(conflict.action, conflict.extra); onClearConflict(); }}
                style={{ ...btn("accept"), padding: "3px 10px", fontSize: 12 }}>
                {conflict.kind === "no_identity" ? "Assign anyway — record on this row only"
                  : conflict.kind === "off_candidate" ? "Yes — add to their publication record"
                    : "Force add anyway"}
              </button>
            )}
            <button onClick={onClearConflict} style={{ ...btn("ghost"), padding: "3px 10px", fontSize: 12 }}>
              {conflict.kind === "multi_candidate" ? "Got it" : "Cancel"}
            </button>
          </div>
        </div>
      )}

      {/* expanded evidence / pick-one */}
      {isExpanded && (
        <div style={{ padding: "0 15px 14px 43px", fontSize: 13, color: "#475569" }}>
          {isMulti ? (
            <MultiEvidence row={r} candidates={candidates} pickedCwid={pickedCwid} acting={acting}
              onPick={onPick} onAction={onAction} />
          ) : (
            <SingleEvidence row={r} wcm={wcm} isAbsent={isAbsent} />
          )}
          {/* PubMed-twin adjudication (#951 Layer 2) — the producer's matched_pmid flag,
              rendered ahead of AssignOther so the comparison is the first thing a curator sees
              on a flagged row (assigning is still possible below regardless of what this
              panel finds). Fetched lazily on expand, same as everything else in this block. */}
          {r.matched_pmid != null && (
            <CounterpartPanel row={r} acting={acting} onAction={onAction} />
          )}
          {/* Both row kinds, not just multi (#925 shipped it inside MultiEvidence only): a
              single-candidate row is precisely where the producer was CONFIDENTLY wrong, so
              it's the case where the curator most often knows a name the card can't offer. */}
          <AssignOther rowId={r.id} acting={acting} onAction={onAction}
            homonyms={r.source === "scopus" ? 0
              : isMulti ? candidates.length
                // F-2: a single-candidate row now records the same "not mine" for its one
                // proposed candidate when the curator assigns elsewhere — but only when that
                // candidate actually exists to be displaced (a real top_cwid) and has a
                // ReCiter identity to write the rejection against (noIdentity / noSuggestion
                // are exactly the server-computed facts that already gate this row's own
                // "No ReCiter identity" pill and no-suggestion state).
                : (noSuggestion || noIdentity ? 0 : 1)} />
        </div>
      )}
    </article>
  );
};

// §2.6's score stack: one badge, with the AS diagnosis in 11.5px beneath it (mockup:401-416).
// The badge SHAPE is the mockup's for every branch; its colour thresholds are this page's own
// existing ones (ioColor: >= 90 / >= 50), not the mockup's fixture, so a row that reads green
// today still reads green — the redesign restyles the block, it does not re-grade the queue.
const ioBadgeColors = (v?: number): { bg: string; fg: string } => (
  v == null ? { bg: "#f2f0ec", fg: "#6b7484" }
    : v >= 90 ? { bg: "#eaf5ed", fg: "#146c39" }
      : v >= 50 ? { bg: "#fdf3e2", fg: "#8a5a08" }
        : { bg: "#f2f0ec", fg: "#6b7484" }
);
const scoreBadgeStyle = (bg: string, fg: string): CSSProperties => ({
  display: "inline-block", fontSize: 12.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999,
  whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", background: bg, color: fg,
});

// right-rail score block
const ScoreRail = ({ row: r, isMulti, isAbsent, candidates, resolved }: { row: AuthorshipRow; isMulti: boolean; isAbsent: boolean; candidates: Candidate[]; resolved?: boolean }) => {
  // #938 — top_io_score is not part of ReCiterDB#177's null sweep, so without this branch a
  // no-suggestion row (top_cwid null) would fall through to the plain numeric score below,
  // a real coloured score attached to no candidate at all. Same muted palette as the
  // "No ReCiter identity" pill (noIdentityPillStyle) — a different fact, same "nothing to
  // act on here" register.
  if (!r.top_cwid) {
    return (
      <div style={{ textAlign: "right", minWidth: 46 }}>
        <span style={scoreBadgeStyle("#f2f0ec", "#6b7484")}>No suggestion</span>
      </div>
    );
  }
  if (isMulti) {
    const total = r.n_candidates ?? candidates.length;
    return (
      <div style={{ textAlign: "right", minWidth: 46 }}>
        <span style={scoreBadgeStyle("#fdf3e2", "#8a5a08")}>{total} candidates</span>
        {r.top_io_score != null && (
          <span style={{ display: "block", fontSize: 11.5, color: "#5c6474", marginTop: 2, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
            top IO {fmtScore(r.top_io_score)}
          </span>
        )}
      </div>
    );
  }
  if (isAbsent) {
    const scopus = r.source === "scopus";
    return (
      <div style={{ textAlign: "right", minWidth: 46 }}>
        <span style={scoreBadgeStyle(scopus ? "#eef2ff" : "#fdf3e2", scopus ? "#4338ca" : "#8a5a08")}>
          {scopus ? "Not in PubMed" : "Never retrieved"}
        </span>
        <span style={{ display: "block", fontSize: 11.5, color: "#5c6474", marginTop: 2, textAlign: "right" }}>
          conf: {confBand(r.top_confidence)}
        </span>
      </div>
    );
  }
  const io = ioBadgeColors(r.top_io_score);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, minWidth: 64 }}>
      <Tip title="Identity-Only score — authorship likelihood from identity evidence alone (name, affiliation, cohort), ignoring curator feedback (0-100)." placement="left" arrow>
        <span style={{ ...scoreBadgeStyle(io.bg, io.fg), cursor: "help" }}>IO {fmtScore(r.top_io_score)}</span>
      </Tip>
      {/* AS = ReCiter's production authorship score, the diagnosis under the trusted signal.
          Amber below 70 (mockup:763-765). Hidden once the row is resolved — there is no
          decision left for it to inform. */}
      {!resolved && r.top_fg_score != null && (
        <Tip title="AS — ReCiter authorship score (production model), 0-100. Below 30 means production buried this person." placement="left" arrow>
          <span style={{ fontSize: 11.5, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", cursor: "help", color: r.top_fg_score < 70 ? "#8a5a08" : "#5c6474" }}>
            AS {fmtScore(r.top_fg_score)}
          </span>
        </Tip>
      )}
    </div>
  );
};

// single-candidate / absent evidence panel
const SingleEvidence = ({ row: r, wcm, isAbsent }: { row: AuthorshipRow; wcm: boolean; isAbsent: boolean }) => {
  // #938 — top_cwid null: neither ioFgNote nor scopusNote below is safe to call, since both
  // are written assuming a matched candidate exists (ioFgNote literally names r.top_cwid as
  // the thing "uniquely matched"). Short-circuit the note itself rather than patch either
  // function for a case they were never meant to describe.
  const noSuggestion = !r.top_cwid;
  return (
  <>
    {/* Scopus rows have no PMID, so this lane keeps its record/DOI links here. PubMed rows get
        their PMID + copy button on the card's own meta line (§2.6) instead of twice over. */}
    {r.source === "scopus" && <div><ScopusLinks row={r} /></div>}
    {/* absent → labeled facts, no score blocks (F10) */}
    {isAbsent && (
      <div style={{ display: "flex", gap: 22, marginBottom: 10 }}>
        <div><div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{confBand(r.top_confidence)}</div><div style={factLabel}>Confidence</div></div>
        <div><div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>{r.top_cohort_size ?? "—"}</div><div style={factLabel}>WCM homonym</div></div>
        <div><div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{r.top_given_match || "—"}</div><div style={factLabel}>Given name</div></div>
      </div>
    )}
    {/* signal chips (F7) */}
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 9 }}>
      {wcm
        ? <Chip kind="ok"><IconCheck size={13} /> WCM affiliation match</Chip>
        : <Chip kind="warn"><IconAlert size={13} /> No WCM string in affiliation</Chip>}
      {/* #938 — top_dept/top_affil_match are also part of ReCiterDB#177's null sweep; on a
          no-suggestion row there is no candidate department to compare against, so this chip
          would otherwise assert a mismatch against nothing (same class of bug as ioFgNote). */}
      {!noSuggestion && (r.top_affil_match
        ? <Chip kind="neutral">Dept: {r.top_dept} ✓</Chip>
        : <Chip kind="neutral">Dept ≠ affiliation</Chip>)}
    </div>
    {/* inline note (F8) — scopus lane gets its own not-in-PubMed explanation; #938's
        no-suggestion rows get neither, since both notes assume a matched candidate */}
    <div style={{
      display: "flex", gap: 7, fontSize: 12.5, lineHeight: 1.5, borderRadius: 7, padding: "8px 10px",
      background: noSuggestion ? "#f8fafc" : r.source === "scopus" ? "#eef2ff" : isAbsent ? "#fffbeb" : "#eff6ff",
      color: noSuggestion ? "#64748b" : r.source === "scopus" ? "#4338ca" : isAbsent ? "#b45309" : "#475569",
    }}>
      {noSuggestion
        ? <IconInfo size={15} style={{ marginTop: 1, color: "#64748b" }} />
        : r.source === "scopus"
          ? <IconInfo size={15} style={{ marginTop: 1, color: "#4338ca" }} />
          : isAbsent ? <IconAlert size={15} style={{ marginTop: 1, color: "#b45309" }} /> : <IconInfo size={15} style={{ marginTop: 1, color: "#2563eb" }} />}
      <span>{noSuggestion
        ? "No proposed identity — the matcher no longer matches this byline to any WCM identity. Assign it to someone below, or leave it open."
        : r.source === "scopus" ? scopusNote(r) : ioFgNote(r)}</span>
    </div>
  </>
  );
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
const HomonymNote = ({ n }: { n: number }) => n < 1 ? null : (
  <div style={{ fontSize: 11.5, lineHeight: 1.45, color: "#b45309", marginTop: 7, maxWidth: 620 }}>
    Assigning also records “not mine” for the other {n} candidate{n === 1 ? "" : "s"} on this row
    (those with a ReCiter identity). Reopening the row undoes both.
  </div>
);

// multi-candidate disambiguation panel (F11)
const MultiEvidence = ({ row: r, candidates, pickedCwid, acting, onPick, onAction }: {
  row: AuthorshipRow; candidates: Candidate[]; pickedCwid?: string; acting: boolean;
  onPick: (cwid: string) => void; onAction: (action: string, extra?: Record<string, any>) => void;
}) => {
  // rank by full given-name match first, then IO desc, then matcher confidence desc --
  // the same key the AAR producer now writes server-side. io_score is on a 0-100 scale, so
  // a 0.62 is the model saying "not this person"; ranking on IO alone let any faintly-scored
  // homonym take the lead over a byline-exact name match. IO and then confidence break the
  // remaining ties (a candidate production never retrieved -- io_score null -- still carries
  // a name/department confidence signal).
  // Candidates who already rejected this exact pmid (GoldStandard.rejectedpmids) must never
  // become the visually-highlighted lead — rank/lead computation runs over this filtered set —
  // but they stay VISIBLE in the rendered list below (`visible` is still built from the raw
  // `candidates` prop) so a curator who remembers "5 candidates" isn't confused by only 4.
  const eligibleForLead = candidates.filter((c) => !c.already_rejected);
  const isFull = (c: Candidate) => (c.given_match === "full" ? 1 : 0);
  const ranked = [...eligibleForLead].sort((a, b) => isFull(b) - isFull(a) ||
    (b.io_score ?? -1) - (a.io_score ?? -1) || (b.confidence ?? -1) - (a.confidence ?? -1));
  // a full name match is never folded away behind "Show all", scored or not.
  const unfolded = ranked.filter((c) => isFull(c) || c.io_score != null);
  const folded = ranked.filter((c) => !isFull(c) && c.io_score == null);
  const [showAll, setShowAll] = useState(false);
  const anyDeptMatch = candidates.some((c) => c.affil_dept_match);
  // lead = the top-ranked candidate, but only when it is actually strong: a full given-name
  // match, or an IO-scored one, or a confidence that is itself meaningful (>=0.5) -- a flat
  // tie among all-weak candidates should still highlight nobody.
  const top = ranked[0];
  const lead = top && (isFull(top) || top.io_score != null || (top.confidence ?? 0) >= 0.5) ? top : undefined;
  // The Assign button writes the PRODUCTION gold standard, so it must reflect an
  // EXPLICIT curator pick — never a silent default. We highlight the top-ranked
  // candidate (lead) as a visual hint only; selectedCwid drives the radio state but
  // Assign is gated on pickedCwid below so opening/mis-clicking a card can't write GS.
  const selectedCwid = pickedCwid;
  // when nothing survives the fold, there is nothing to show in the default view —
  // auto-expand the folded list so the curator always has a visible choice to pick.
  // Already-rejected candidates are appended unconditionally (not gated by showAll) so they
  // stay visible for transparency even though they're excluded from the ranked/lead logic above.
  const rejectedCandidates = candidates.filter((c) => c.already_rejected)
    .sort((a, b) => (b.io_score ?? -1) - (a.io_score ?? -1) || (b.confidence ?? -1) - (a.confidence ?? -1));
  const visible = [...(showAll || unfolded.length === 0 ? ranked : unfolded), ...rejectedCandidates];
  // #990: which of these candidates is ALREADY the accepted rival identityConflictWhere()/
  // accepted_by names for this exact byline slot — a "picking this one just re-confirms an
  // existing conflict" signal, distinct from already_rejected (which is about a DIFFERENT
  // candidate's own /curate rejection, not this row's slot).
  // Lowercased on both sides: the server's own exclusion of the row's top_cwid, and the SQL
  // this list comes from, compare cwids under a case-insensitive collation, so a case-only
  // difference between a candidate cwid and an accepted_by cwid must not silently drop the
  // badge off the one candidate the curator most needs it on.
  const acceptedByCwids = new Set((r.accepted_by || []).map((a) => String(a.cwid || "").toLowerCase()));

  return (
    <>
      {/* see SingleEvidence — the PMID now sits on the card's meta line, not in here. */}
      {r.source === "scopus" && <div><ScopusLinks row={r} /></div>}
      {!anyDeptMatch && (
        <div style={{ display: "flex", gap: 7, fontSize: 12.5, lineHeight: 1.5, borderRadius: 7, padding: "8px 10px", background: "#fffbeb", color: "#b45309", marginBottom: 10 }}>
          <IconAlert size={15} style={{ marginTop: 1 }} />
          <span>The affiliation names Weill Cornell but no department — ranked by identity-only (IO).</span>
        </div>
      )}
      <div>
        {visible.map((c, i) => {
          const isLead = c.cwid === lead?.cwid;
          const checked = c.cwid === selectedCwid;
          const rejected = c.already_rejected === true;
          const acceptedElsewhere = acceptedByCwids.has(String(c.cwid || "").toLowerCase());
          return (
            <label key={c.cwid || i} onClick={(e) => e.stopPropagation()} style={{
              display: "flex", alignItems: "center", gap: 11, padding: "9px 11px",
              border: `1px solid ${isLead ? "#bbf7d0" : rejected ? "#fecaca" : "#e8edf2"}`, borderRadius: 7, marginBottom: 7,
              cursor: rejected ? "not-allowed" : "pointer",
              background: isLead ? "#f0fdf4" : rejected ? "#fef2f2" : "#fff",
              opacity: rejected ? 0.8 : 1,
            }}>
              <input type="radio" name={`m${r.id}`} checked={checked} disabled={rejected} onChange={() => onPick(c.cwid)}
                onClick={(e) => e.stopPropagation()}
                style={{ accentColor: "#2563eb", flex: "none" }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "#0f172a" }}>
                  {c.name}{" "}
                  {c.cwid && <a href={`/curate/${c.cwid}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "#2563eb", textDecoration: "none", fontWeight: 400 }}>{c.cwid}</a>}
                </span>
                <span style={{ display: "block", fontSize: 12, color: "#94a3b8" }}>
                  {c.person_type}{c.dept ? ` · ${c.dept}` : ""}{!hasWcm(r.author_affiliation) ? " · ⚠ no WCM string" : ""}
                </span>
                {(c.given_match === "full" || c.affil_dept_match || rejected || acceptedElsewhere) && (
                  <span style={{ display: "flex", gap: 5, marginTop: 4, flexWrap: "wrap" }}>
                    {/* already-rejected (GoldStandard) takes precedence — shown ahead of any match chips */}
                    {rejected && <Chip kind="warn">Already rejected</Chip>}
                    {/* #990: this candidate is the accepted_by rival named on the card above —
                        picking them here would just re-confirm the existing slot conflict. */}
                    {acceptedElsewhere && <Chip kind="warn">Accepted this article</Chip>}
                    {c.given_match === "full" && <Chip kind="ok">Full name match</Chip>}
                    {c.affil_dept_match && <Chip kind="ok">Dept match</Chip>}
                  </span>
                )}
              </span>
              <span style={{ textAlign: "right" }}>
                {c.io_score != null ? (
                  <>
                    <span style={{ display: "block", fontSize: 16, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: ioColor(c.io_score) }}>
                      {fmtScore(c.io_score)}
                    </span>
                    {c.final_score != null && (
                      <span style={{ display: "block", fontSize: 10.5, color: "#c2410c", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>Auth. Score {fmtScore(c.final_score)}</span>
                    )}
                  </>
                ) : (
                  <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: (c.confidence ?? 0) >= 0.5 ? "#15803d" : "#94a3b8" }}>
                    {confBand(c.confidence)} match
                  </span>
                )}
              </span>
            </label>
          );
        })}
        {!showAll && unfolded.length > 0 && folded.length > 0 && (
          <button onClick={(e) => { e.stopPropagation(); setShowAll(true); }} style={{ background: "none", border: "none", color: "#2563eb", fontSize: 12, cursor: "pointer", padding: "2px 0", marginBottom: 8 }}>
            Show all {ranked.length} ({folded.length} never retrieved, IO unavailable)
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
        {/* defense in depth: the radio being disabled already prevents picking a rejected
            candidate through the UI, but this closes any edge-case gap cheaply. */}
        <button style={btn("accept", acting || !pickedCwid || candidates.find((c) => c.cwid === pickedCwid)?.already_rejected)}
          disabled={acting || !pickedCwid || candidates.find((c) => c.cwid === pickedCwid)?.already_rejected}
          onClick={(e) => { e.stopPropagation(); pickedCwid && onAction("assign", { cwid: pickedCwid }); }}>
          <IconCheck /> Assign selected
        </button>
        <button style={btn("reject", acting)} disabled={acting} onClick={(e) => { e.stopPropagation(); onAction("reject"); }}>
          <IconX /> Reject all
        </button>
      </div>
      {/* count is candidates-minus-one and does not move with the radio: whichever one is
          picked, the same number of others are rejected. */}
      {r.source !== "scopus" && <HomonymNote n={Math.max(0, candidates.length - 1)} />}
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
const AssignOther = ({ rowId, acting, onAction, homonyms = 0 }: {
  rowId: number; acting: boolean; onAction: (action: string, extra?: Record<string, any>) => void;
  homonyms?: number;
}) => {
  const [otherCwid, setOtherCwid] = useState("");
  // What the debounced POST /api/db/authorships/lookup has found for the CURRENT otherCwid —
  // reset to idle on every keystroke (not just short ones) so a resolved answer can never be
  // submitted against a string the curator has since changed. requestSeq guards the fetch
  // itself: a later keystroke bumps it, and a response whose seq no longer matches is dropped
  // even if it lands after a newer one (out-of-order network replies).
  const [lookupState, setLookupState] = useState<TypedCwidLookupState>({ status: "idle" });
  const requestSeq = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); }, []);

  const submitOther = useCallback(() => {
    if (!otherCwid || acting) return;
    // Resolved AND for this exact string (lookupState is reset on every keystroke, so a
    // "resolved" status can only describe otherCwid as it stands right now) → one-click write,
    // reusing the same {cwid,name,hasIdentity} shape and the same assignConfirmFlags the
    // bulk-assign confirm dialog sends. offCandidate is always true: a typed cwid is by
    // definition not one of this row's proposed candidates (assignGate.ts:25 only consults
    // confirmOffCandidate when the server's own offCandidate check is also true, so sending it
    // unconditionally is harmless on the rows where the typed cwid happens to already be
    // on-candidate). Anything else (idle/loading/error) — today's unconfirmed call, unchanged;
    // the existing 422 → banner path (doAction's catch) still handles it.
    if (lookupState.status === "resolved") {
      onAction("assign", { cwid: lookupState.cwid, ...assignConfirmFlags(true, lookupState.hasIdentity) });
    } else {
      onAction("assign", { cwid: otherCwid });
    }
  }, [otherCwid, acting, lookupState, onAction]);

  // every handler stops propagation: the card is click-to-expand, so an unguarded click or
  // Enter inside this input collapses the card out from under the curator mid-type.
  return (
    <>
      <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center", justifyContent: "flex-end" }}>
        <label htmlFor={`otherCwid-${rowId}`} style={{ fontSize: 11.5, color: "#94a3b8" }}>
          Someone else:
        </label>
        <input id={`otherCwid-${rowId}`} value={otherCwid} placeholder="cwid"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            const val = e.target.value.trim();
            setOtherCwid(val);
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
            requestSeq.current += 1; // invalidate any in-flight/pending lookup for the old value
            setLookupState({ status: "idle" }); // EVERY keystroke — a resolved answer never outlives its string
            if (val.length < 4) return;
            const seq = requestSeq.current;
            debounceTimer.current = setTimeout(() => {
              setLookupState({ status: "loading" });
              fetch("/api/db/authorships/lookup", {
                credentials: "same-origin", method: "POST", headers: apiHeaders,
                body: JSON.stringify({ cwid: val }),
              })
                .then(async (r) => {
                  if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
                  return r.json();
                })
                .then((d) => {
                  if (requestSeq.current !== seq) return; // a newer keystroke fired since
                  setLookupState({
                    status: "resolved", cwid: String(d.cwid || val),
                    name: d.name ?? null, hasIdentity: !!d.hasIdentity,
                  });
                })
                .catch((e) => {
                  if (requestSeq.current !== seq) return;
                  setLookupState({ status: "error", message: String(e?.message || e) });
                });
            }, 350);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || !otherCwid || acting) return;
            e.preventDefault(); e.stopPropagation();
            submitOther();
          }}
          style={{
            width: 92, padding: "3px 6px", fontSize: 12, border: "1px solid #cbd5e1",
            borderRadius: 4, color: "#334155",
          }} />
        {/* never disabled on lookupState — a slow/errored lookup must not block the button,
            it only changes which onAction call submitOther makes. */}
        <button style={btn("accept", acting || !otherCwid)} disabled={acting || !otherCwid}
          onClick={(e) => { e.stopPropagation(); submitOther(); }}>
          Assign
        </button>
      </div>
      {(() => {
        const preview = typedCwidPreview(lookupState);
        if (!preview) return null;
        return (
          <div onClick={(e) => e.stopPropagation()} style={{
            textAlign: "right", fontSize: 11, marginTop: 2,
            color: preview.tone === "warn" ? "#b45309" : "#64748b",
          }}>
            {preview.text}
          </div>
        );
      })()}
      {/* all N here, not N-1: someone typed into this box is by definition not one of the
          proposed candidates, so every one of them is the "other" — the stronger version of
          the warning under Assign selected. (If the curator types a listed candidate's cwid
          instead of clicking its radio, the server excludes them and this over-counts by one.) */}
      <HomonymNote n={homonyms} />
    </>
  );
};

const factLabel: CSSProperties = { fontSize: 10.5, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".04em", marginTop: 1 };

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
  background: state === "equal" ? "#f0fdf4" : state === "differ" ? "#fffbeb" : "transparent",
  color: state === "equal" ? "#15803d" : state === "differ" ? "#b45309" : "#94a3b8",
});
const emDash = <span style={{ color: "#94a3b8" }}>—</span>;

// Same paper / Different papers — the only two writes this panel makes, both reusing the
// standard onAction→doAction path (see doAction's `action !== "verdict"` undo suppression):
// dismiss/{reason:"dup_of_matched_pmid"} composes its note server-side (case "dismiss" in
// authorships.controller.ts); verdict/{verdict:"distinct"} only ever writes 'distinct' — 'same'
// is never sent or stored anywhere, "same paper" IS the dismiss above.
const CounterpartActions = ({ acting, onAction }: {
  acting: boolean; onAction: (action: string, extra?: Record<string, any>) => void;
}) => (
  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
    <button style={btn("accept", acting)} disabled={acting}
      onClick={(e) => { e.stopPropagation(); onAction("dismiss", { reason: "dup_of_matched_pmid" }); }}>
      Same paper — dismiss
    </button>
    <button style={btn("soft", acting)} disabled={acting}
      onClick={(e) => { e.stopPropagation(); onAction("verdict", { verdict: "distinct" }); }}>
      Different papers
    </button>
  </div>
);

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
        <div style={{ display: "flex", gap: 7, fontSize: 12.5, color: "#b45309", marginBottom: 10 }}>
          <IconAlert size={15} style={{ marginTop: 1 }} />
          <span>PubMed record {pmid} could not be fetched ({state.message}).</span>
        </div>
        <CounterpartActions acting={acting} onAction={onAction} />
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
        <div style={{ display: "flex", gap: 7, fontSize: 12.5, marginBottom: 10, color: "#b45309", background: "#fffbeb", borderRadius: 7, padding: "8px 10px" }}>
          <IconAlert size={15} style={{ marginTop: 1 }} />
          <span>PubMed record {pmid} could not be fetched ({fetchError}).</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 1fr", gap: "5px 12px", fontSize: 12.5, alignItems: "start" }}>
        <div />
        <div style={{ fontWeight: 700, color: "#475569" }}>Scopus record</div>
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
        {compare.sharedSurnames} of {compare.scopusAuthorCount} Scopus surname{compare.scopusAuthorCount === 1 ? "" : "s"} shared with PubMed
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
              onClick={(e) => e.stopPropagation()} style={{ color: "#2563eb" }}>
              /curate/{r.top_cwid}
            </a>{" "}
            if it belongs to them
          </>
        ) : (
          `PubMed record ${pmid} was never proposed for a WCM person, and this row has no proposed identity to add it from.`
        )}
      </div>

      <CounterpartActions acting={acting} onAction={onAction} />
    </div>
  );
};

export default AuthorshipsTabs;
