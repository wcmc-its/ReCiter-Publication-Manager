// "Cornell-only" person: a Cornell Ithaca person (a `cornell-ithaca` row in person_person_type)
// whose reciterdb `person` row has no ReCiter Analysis behind it. ReCiterDB inserts those rows
// from Identity alone, so every Analysis column -- dateAdded included -- is NULL. They are never
// run through ReCiter until they have enough accepted PubMed papers (CORNELL_RECITER_MIN_PUBMED
// below): until then Find People labels them, /curate shows a no-run page built from the stores,
// and the reports person picker leaves them out. Dual WCM/Cornell appointees have an
// Analysis-backed row (dateAdded set), so they are NOT Cornell-only and behave as before.
//
// One SQL fragment for every caller, so the flag, the exclusion and the guard can't disagree.
// `alias` is the person table's alias in the surrounding query (Sequelize uses the model name,
// `Person`).
export const CORNELL_ITHACA_PERSON_TYPE = "cornell-ithaca";

export const cornellOnlySql = (alias: string): string =>
  `(\`${alias}\`.\`dateAdded\` IS NULL AND EXISTS (SELECT 1 FROM \`person_person_type\` \`cornellPpt\`` +
  ` WHERE \`cornellPpt\`.\`personIdentifier\` = \`${alias}\`.\`personIdentifier\`` +
  ` AND \`cornellPpt\`.\`personType\` = '${CORNELL_ITHACA_PERSON_TYPE}'))`;

// When a Cornell-only person may be run through ReCiter after all: once their GoldStandard holds
// at least this many accepted PubMed papers (/authorships accepts and manual /curate adds alike).
// Below it they get the no-run /curate page, built from the stores. At or above it the normal path
// takes over: the next run (the debounced refresh after the accept, or opening /curate) writes an
// Analysis, the nightly gives them a dated person row, and cornellOnlySql stops matching. No flag.
export const CORNELL_RECITER_MIN_PUBMED = 3;

export type ReciterRunStatus = { cornellOnly: boolean; reciterEligible: boolean; blocked: boolean };

// The rule, with its two lookups passed in so it can be tested without a database. One place for
// the feature-generator route, the PubMed search, analysisRefresh and the /curate page check.
//   - Cornell-only lookup fails: treated as not Cornell-only, so the run goes ahead. Same as
//     before this rule existed: a reciterdb hiccup must not take /curate down for everyone.
//   - knownPmids lookup fails for a Cornell-only person: blocked, which is how every Cornell-only
//     person was treated before. A run is one-way (it writes the Analysis that makes them an
//     ordinary person), so an outage must not switch anyone early.
export async function reciterRunStatus(
  uid: string,
  lookups: { isCornellOnly: (uid: string) => Promise<boolean>; knownPmidCount: (uid: string) => Promise<number> },
): Promise<ReciterRunStatus> {
  const cornellOnly = await lookups.isCornellOnly(uid).catch((e) => { console.log(`[cornellOnly] ${uid} lookup failed:`, e); return false; });
  if (!cornellOnly) return { cornellOnly: false, reciterEligible: true, blocked: false };
  const known = await lookups.knownPmidCount(uid).catch((e) => { console.log(`[cornellOnly] ${uid} knownPmids lookup failed:`, e); return -1; });
  const reciterEligible = known >= CORNELL_RECITER_MIN_PUBMED;
  return { cornellOnly: true, reciterEligible, blocked: !reciterEligible };
}
