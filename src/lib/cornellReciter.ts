// Server side of the Cornell-only ReCiter rule (src/utils/cornellOnly.ts): the rule bound to its
// real lookups (reciterdb person row, DynamoDB GoldStandard), plus the person's stored PubMed
// assertions for the no-run /curate page and the PubMed search that page's Add tab runs.
import { isCornellOnlyUid } from '../../controllers/db/person.controller'
import { getGoldStandardStrict } from './goldStandardRejections'
import { reciterRunStatus, ReciterRunStatus } from '../utils/cornellOnly'

export const cornellReciterStatus = (uid: string): Promise<ReciterRunStatus> =>
  reciterRunStatus(uid, {
    isCornellOnly: isCornellOnlyUid,
    knownPmidCount: async (u) => (await getGoldStandardStrict(u)).known.length,
  })

// GoldStandard as the curate tabs' userAssertion: knownpmids ACCEPTED, rejectedpmids REJECTED
// (accepted wins if a pmid is somehow on both). Throws on a DynamoDB error.
export async function storedAssertions(uid: string): Promise<{ pmid: number, userAssertion: 'ACCEPTED' | 'REJECTED' }[]> {
  const { known, rejected } = await getGoldStandardStrict(uid)
  const accepted = new Set(known)
  return [
    ...known.map((pmid) => ({ pmid, userAssertion: 'ACCEPTED' as const })),
    ...rejected.filter((pmid) => !accepted.has(pmid)).map((pmid) => ({ pmid, userAssertion: 'REJECTED' as const })),
  ]
}
