import { reciterConfig } from '../config/local.js'

// Re-run ReCiter's analysis for a person after curator feedback, debounced per uid.
//
// The curate tabs are ReCiter's STORED Analysis snapshot (`userAssertion` per article), and a
// goldstandard write does not touch it. Full-time faculty get re-run by the nightly
// inst-client, so their tabs catch up overnight; everyone else (postdocs, empty personTypes,
// non-routable cohorts) stays on the old snapshot until a human clicks Refresh — alc4061's
// 09-02 accept was still "Suggested" on 09-14. The pending-feedback overlay that was meant to
// bridge this (getPendingFeedback -> /publication/manager/userfeedback/find) has been dead
// since 2023: ReCiter has no such endpoint.
//
// Debounced, never per click: a curate session can be 300 accepts in a row. 300 overlapping
// analyses of one uid is a last-writer-wins race that can leave the Analysis BEHIND the
// gold standard (the bug this fixes, made intermittent), plus 300 Lambda invokes for nothing.
// So: one timer per uid, restarted on every write; it fires after QUIET_MS of silence; at most
// one run in flight per uid, and a write that lands mid-run marks the uid dirty so exactly one
// more run follows. Fire-and-forget: the gold-standard write is the one that matters and has
// already landed; a refresh that fails leaves things as they are today.
//
// ponytail: in-memory, per-process. reciter-pm-prod is one pod; a restart drops pending timers
// and the fallback is the status quo (nightly for FT, Refresh button for the rest). Move to the
// reporting_ad_hoc_feature_generator_execution table if PM ever scales past one replica.
const QUIET_MS = 60_000

const timers = new Map<string, ReturnType<typeof setTimeout>>()
const running = new Set<string>()
const dirty = new Set<string>()

export function scheduleAnalysisRefresh(uid: string | undefined) {
  if (!uid) return
  clearTimeout(timers.get(uid))
  timers.set(uid, setTimeout(() => { timers.delete(uid); void run(uid) }, QUIET_MS))
}

async function run(uid: string) {
  if (running.has(uid)) { dirty.add(uid); return }
  running.add(uid)
  try {
    // analysisRefreshFlag alone (no retrievalRefreshFlag) re-features and re-scores from the
    // existing PubMedArticle cache — sub-second for most people, seconds for a 300-article one.
    const res = await fetch(
      `${reciterConfig.reciter.featureGenerator.featureGeneratorEndpoint}?uid=${encodeURIComponent(uid)}&analysisRefreshFlag=true`,
      { headers: { 'api-key': reciterConfig.reciter.adminApiKey, 'User-Agent': 'reciter-pub-manager-server' } },
    )
    await res.arrayBuffer() // drain; the body is the full article list and we don't need it
    if (res.status !== 200) console.log(`[analysisRefresh] ${uid} -> ${res.status}`)
  } catch (e) {
    console.log(`[analysisRefresh] ${uid} failed:`, e)
  } finally {
    running.delete(uid)
    if (dirty.delete(uid)) void run(uid)
  }
}

// Test seam: lets a check drive the timer/in-flight logic without a ReCiter behind it.
export const __test = { timers, running, dirty, run, QUIET_MS }
