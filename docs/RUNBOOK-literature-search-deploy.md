# RUNBOOK — Turning Literature Search on: DEV (the demo) and PROD

Written 2026-07-14, while the reason is still understood. Everything below was verified against the
live cluster and the committed buildspec, not remembered.

# PART 1 — DEV, and the librarian demo

## MERGING PR #824 INTO `dev` DOES NOT GIVE YOU A DEMO

Read this before scheduling anything. **Three gates sit between the merge and a working page, and not
one of them is code.** Each fails in a different, confusing way, and two of them fail *in front of the
audience*.

### D1. Both dev pipelines are parked at a manual approval — and you need BOTH

**Verified 2026-07-14** (`aws codepipeline get-pipeline-state`): `ReCiter-Pubmed-Retrieval-Tool-Dev` and
`ReCiter-Scopus-Dev-k8` are **both** sitting at `ManualApproval: InProgress`, with `Build: Succeeded`
behind them. **Merging changes nothing until someone clicks them**, and merging RPM #824 itself needs the
RPM dev pipeline run too.

- **PubMed** — without the sort/retmax build (tool PRs **#164/#165, merged 2026-07-14, NOT deployed**),
  **Modes 2 and 3 will refuse to run.** That is deliberate: the controller detects an old jar and throws,
  rather than printing *"the top 50, by most relevant"* over a slice that was never ranked. **Mode 1 is
  unaffected** — so a Mode-1-only demo survives this gate.
- **Scopus** — without its deploy (`#35` merged, never deployed), `POST /scopus/search/query` **404s**.
  Ticking Scopus renders an explicit failure panel — graceful, and browser-verified — but *"this database
  could not be searched"* is not what you want on screen in front of a librarian.

### D2. The Bedrock IAM policy is not attached anywhere — this one 502s the demo

A grep finds **no `bedrock:InvokeModel` policy anywhere in the org**, including ReCiter-CDK. Without it,
the very first *"Build strategy"* click is an `AccessDeniedException` → **502**. Attach
`docs/iam-reciter-pm-bedrock.json` to the role the dev pod actually runs as, and prove it with the
`simulate-principal-policy` command in `docs/iam-reciter-pm-bedrock.md` — that needs no pod and no kubectl.

**UNVERIFIED, AND CHECK IT FIRST:** *prod* has **no service account** (see P2 below), so there may be no
role to attach anything to. **Nobody has confirmed whether dev has one.** If dev has no service account
either, this is not a five-minute task and it must not be discovered on demo day.

### D3. The allowlist fails shut — so nobody, *including the presenter*, can open the page

`LITERATURE_SEARCH_CWIDS` is an **`optional: true`** `secretKeyRef` into the `reciter-pm-dev-secrets`
Secret (`kubernetes/k8-deployment.yaml:189`). `optional` means **the pod starts happily without it** — and
then the allowlist denies **everyone**. That is the intended safety property (an absent key means the pilot
is closed, not open — executed and verified), and it is also a silent demo-killer.

So the key must contain the CWIDs of **the presenter and every librarian in the room**, comma-separated,
no spaces. Note that dev **does** run `kubectl apply` (`k8-buildspec.yml:91`), so `BEDROCK_MODEL_ID` and
`AWS_REGION` come from the manifest automatically — **the allowlist is the only variable you must set by
hand on dev.**

> A `kubectl get secret reciter-pm-dev-secrets` returned **NotFound** in the default namespace on
> 2026-07-14. That may simply be the wrong namespace — **confirm the namespace before concluding the
> Secret is missing.**

## The order, and the order is the point

```
1. Review + merge PR #824 → dev            (a human review; the PR title says DO NOT MERGE for a reason)
2. Approve the RPM dev pipeline            → the code is actually on the pod
3. Approve BOTH retrieval-tool pipelines   → PubMed (Modes 2-3) and Scopus (no 404 panel)
4. Attach the Bedrock IAM policy           → or step 6 is a 502
5. Set LITERATURE_SEARCH_CWIDS             → or step 6 is a 403 for everyone, you included
6. DRIVE IT YOURSELF, END TO END, ON DEV   → before any librarian sees it
```

**Step 6 is not optional.** Two of the three gates fail *at the demo*, not before it, and the failure looks
like a broken product rather than a missing config.

## What to actually demo — lead with the part that works

The measurements (`RECALL-STUDY.md`) say the **Boolean query is the deliverable**: the strategy retrieves
**99%** of the studies a published Cochrane review included, and survives a badly-phrased question. The
relevance-ranked 50 is **triage**, not a screen. Demo that story, because it is the true one.

**Use Mode 1, and give it seeds. The seeds ARE the demo.** Driven live on 2026-07-14:

1. Ask a real question, and paste 2–3 PMIDs the search **must** find.
2. It builds a numbered PRESS-style strategy, every line with its own count, every line a checkbox.
3. **Known-item validation names the block that failed.** Seeded with PMID 30141340 it reported:
   *"Not retrieved — excluded by the **Educational or psychological interventions (lines 4–5)** block"*
   — and offered a widening line, **unticked**, carrying exactly the missing vocabulary
   (`"action plan"[tiab] OR "care plan"[tiab] …`), **verified** to retrieve the paper and **priced**
   at *+59 records to screen*. **This is the moment. Nothing else in the tool lands like it.**
4. **Copy PRISMA-S methods block** → paste it. It carries the AI disclosure, the model id, the verbatim
   fenced query and the date. That is what makes it publishable.
5. **Download everything** → open the `.xlsx`. Show that when the sample is truncated the AI verdict column
   is **refused**, and the sheet says why — because that file goes to Covidence, and a verdict over a
   relevance-ranked sliver would be a screen-shaped object that costs a review its recall.

**Do NOT demo:** Modes 2/3 (unless D1's PubMed approval is done), Scopus (unless its approval is done), and
**do not call the AI screen a screen.** It triages. Saying otherwise is the one claim the data refuses.

# PART 2 — PROD

## The one fact this runbook exists to carry

**The prod pipeline only runs `kubectl set image`. It never runs `kubectl apply`.**

`k8-buildspec.yml`:

- **line 83** (`master`) and **line 95** (`master_Next14`):
  `kubectl set image deployment/reciter-pm-prod reciter-pm=$REPOSITORY_URI:$TAG -n $EKS_CLUSTER_NAME`
  — and nothing else.
- **line 91** (`dev`): `kubectl apply -f kubernetes/k8-deployment.yaml -f kubernetes/k8-service.yaml`,
  *then* set image (PM PR #800).

**That asymmetry is the trap.** DEV reconciles the whole manifest, so DEV picks up `BEDROCK_MODEL_ID`,
`AWS_REGION` and `LITERATURE_SEARCH_CWIDS` from `kubernetes/k8-deployment.yaml` (committed, correct, `a4a0851`).
**PROD never reads that file at all.** The YAML can be perfect and prod will still serve a permanent
**503 "Literature Search is not configured on this environment"** (`src/pages/api/literature/search.ts:272`)
until the vars are set **imperatively**. The feature will work in dev, 503 in prod, and everyone will
go read the code. Don't. Read this.

Corollary, and it is a good one: because prod only ever sets the image, **imperative env vars survive
every future prod deploy.** You set them once.

## Real names (verified live, no placeholders)

| Thing | Value |
|---|---|
| Cluster | `reciter` (us-east-1, acct `665083158573`) |
| Namespace | `reciter` (the buildspec's `-n $EKS_CLUSTER_NAME` — cluster and namespace share the name) |
| Prod deployment | `reciter-pm-prod` |
| Container | `reciter-pm` |
| Prod secret | `reciter-pm-secrets` (**not** `-prod-secrets`) |
| Prod host | `https://reciter.weill.cornell.edu` (internal ALB — VPN required) |
| Prod branch | `master_Next14`, via the pipeline confusingly named **Dev-V2** (manual trigger + approval, ~10 min) |

## Pre-flight (do these BEFORE the release window)

### P1. Bedrock IAM — or the feature 502s instead of 503ing honestly

The policy is written: **`docs/iam-reciter-pm-bedrock.json`**. Do not re-derive it; it already handles the
`us.` inference-profile fan-out trap (profile ARN **and** the foundation-model ARNs in every fan-out region).
Attach it and prove it with `aws iam simulate-principal-policy` per that document.

### P2. PROD HAS NO SERVICE ACCOUNT. This is not in any handoff.

```bash
kubectl -n reciter get deploy reciter-pm-prod -o jsonpath='{.spec.template.spec.serviceAccountName}'   # -> EMPTY
kubectl -n reciter get deploy reciter-pm-dev  -o jsonpath='{.spec.template.spec.serviceAccountName}'   # -> reciter-pm
```

The prod pod runs as the `default` SA, which has **no IRSA annotation**. Its AWS identity is the **node
instance role**, not `reciter-pm`. So attaching the Bedrock policy to the `reciter-pm` role
(`eksctl-reciter-addon-iamserviceaccount-recite-Role1-2KkFv4xYVFNi`) **does nothing for prod** — P1 alone
leaves you with a 502 on the first Bedrock call. Prod must be moved onto the SA, imperatively:

```bash
kubectl -n reciter set serviceaccount deployment/reciter-pm-prod reciter-pm
```

The SA's trust policy is scoped to `system:serviceaccount:reciter:reciter-pm` — same namespace, so prod pods
assume it correctly. **The judgment call:** this changes prod's AWS identity for *everything*. RPM makes exactly
two kinds of AWS call — Bedrock (`@aws-sdk/client-bedrock-runtime`) and DynamoDB provenance
(`src/lib/articleProvenance.ts`) — and the `reciter-pm` role already carries `ReciterPM-ArticleProvenance-Read`.
So the blast radius is: **provenance panels must still load after the switch.** Verify that (step V3) before
declaring done. Do not instead attach Bedrock to the node role — that grants it to every pod on the node.

### P3. Scopus in prod is a live 502 hazard

Prod's env has `SCOPUS_API_KEY` / `SCOPUS_INST_TOKEN` but **no `RECITER_SCOPUS_API_URL`**. Per the per-database failure handling in `src/pages/api/literature/search.ts`,
one database failing 502s the *entire* Mode-1 build (and the user is billed silently). Either set it:

```bash
kubectl -n reciter set env deployment/reciter-pm-prod RECITER_SCOPUS_API_URL=http://reciter-scopus-prod
```

…**and** confirm `reciter-scopus-prod` serves `POST /scopus/search/query` (Scopus #35 is merged but the deploy
never ran — it 404s on dev today), or tell the pilot: **PubMed only**. Do not ship an untested Scopus tick.

## The release (in this order — the order is the safety property)

Order matters: steps 1–2 make the feature *possible*; step 3 is the switch that turns it on. Between them the
feature is DARK but healthy.

```bash
aws eks update-kubeconfig --name reciter --region us-east-1

# 0. Ship the code: trigger the "Dev-V2" pipeline on master_Next14, approve, wait ~10 min.
kubectl -n reciter rollout status deployment/reciter-pm-prod --timeout=10m

# 1. + 2.  Configure the feature. Still nobody can use it (empty allowlist = 403 for all).
kubectl -n reciter set env deployment/reciter-pm-prod \
  BEDROCK_MODEL_ID=us.anthropic.claude-opus-4-8 \
  AWS_REGION=us-east-1
kubectl -n reciter rollout status deployment/reciter-pm-prod --timeout=5m

# 3. THE SWITCH. Comma-separated CWIDs, no spaces. This is the only step that opens the pilot.
kubectl -n reciter set env deployment/reciter-pm-prod LITERATURE_SEARCH_CWIDS=cwid1,cwid2
kubectl -n reciter rollout status deployment/reciter-pm-prod --timeout=5m
```

Each `set env` rolls the deployment (1 replica, ~60–90s). That is expected.

## `LITERATURE_SEARCH_CWIDS` — the feature is DARK until this is set, by design

`controllers/literatureAllowlist.ts` **fails shut**. This was *executed*, not reasoned: against the compiled
`isAllowlisted()` with the var unset, `""`, `"   "` and `",,,"` — **every case returns `false` for every CWID**.
An absent or empty roster means the pilot is **closed**, not open.

**This is the intended safety property, not a bug.** Do not "fix" it. Do not add a default. Do not fall back to
"all users" when the list is empty. It is also why deploying the code to prod is safe on its own: with no roster,
`/api/literature/search` 403s everyone and the sidebar link never renders.

**Who decides the roster:** the pilot list is the **librarian/SR team's** call, not engineering's — the same people
who own the recall question (now answered — see `RECALL-STUDY.md`). Engineering
executes the list it is given; it does not add itself.

**Sessions are cached.** `src/pages/api/auth/[...nextauth].jsx:201` stamps `token.literatureAccess` at **login**.
A user added to the roster must **sign out and back in** before the sidebar link appears. The API gate itself is
live immediately (the JWT boolean is cosmetic; the 403 in `search.ts:239` is the real gate).

## Verify — all from outside the pod

**V1. The env actually landed** (this is the whole point; the pipeline cannot do it for you):

```bash
kubectl -n reciter get deploy reciter-pm-prod \
  -o jsonpath='{range .spec.template.spec.containers[0].env[*]}{.name}{"\n"}{end}' \
  | grep -E 'BEDROCK_MODEL_ID|AWS_REGION|LITERATURE_SEARCH_CWIDS'
```
Three lines, or you are still in the 503 state.

**V2. Read the status code — it names the failure exactly.** On `https://reciter.weill.cornell.edu`, as a pilot
user, run one small Mode-1 search and watch the network tab for `POST /api/literature/search`:

| Code | Meaning | Fix |
|---|---|---|
| **503** | `BEDROCK_MODEL_ID` unset → **the set-image trap**. The code is fine. | Step 1–2 above |
| **403** | Env is set; this CWID is not on the roster (or their session predates step 3) | Add CWID / re-login |
| **502** | Env is set, roster is right, **Bedrock is refusing** → IAM (P1) or SA (P2) | `docs/iam-reciter-pm-bedrock.json` |
| **200** | Shipped. | — |

**V3. Nothing else broke** (the P2 blast radius): open any curated article's provenance/history panel in prod.
It reads DynamoDB through the pod's AWS identity, which you just changed. If it loads, the SA switch is clean.

## Roll back

**The allowlist is the rollback.** Because it fails shut, emptying it is a complete, instant kill switch that needs
no build, no pipeline, no approval, and no code change:

```bash
kubectl -n reciter set env deployment/reciter-pm-prod LITERATURE_SEARCH_CWIDS-   # note the trailing '-' = unset
```

Every user 403s on the next request; the sidebar link disappears at their next login. **This is worth saying out
loud: a feature whose off-switch is one imperative command and whose default is closed is a feature you can ship on
a Friday.** (Shrinking the roster to a single CWID is the same command with a value — use it to cut the pilot back
rather than off.)

Deeper rollback, in order of severity:

```bash
kubectl -n reciter set env deployment/reciter-pm-prod BEDROCK_MODEL_ID- AWS_REGION-   # back to honest 503
kubectl -n reciter rollout undo deployment/reciter-pm-prod                            # previous image AND env
```

`rollout undo` reverts the whole pod template — image *and* the env you set. Use it only if you want the pre-release
state entirely; otherwise prefer the allowlist.

## Two things that will hurt you

1. **Never `kubectl apply -f kubernetes/k8-deployment.yaml` against prod as a shortcut.** That file describes
   **`reciter-pm-dev`** — dev name, dev secret (`reciter-pm-dev-secrets`), dev HPA. Applying it in the `reciter`
   namespace does not fix prod; it stomps dev.
2. `expr "${BRANCH}" : ".*master"` (buildspec line 82) also matches `master_Next14`, so a `master_Next14` build
   executes **both** prod `set image` blocks (lines 83 and 95). They are identical and idempotent — harmless, but it
   is why the log shows the set-image twice. Not a bug; don't "fix" it under time pressure.
