# IAM: `bedrock:InvokeModel` for the ReCiter Publication Manager pod

For whoever owns the `reciter-pm` IRSA role. Nothing here touches application code.
Everything below was **executed against the live account (`665083158573`)** on 2026-07-14, not reasoned.

## What to attach, and to what

Policy document: `docs/iam-reciter-pm-bedrock.json` (this directory).

Suggested policy name: **`ReciterPM-Bedrock-InvokeModel`** — matching the one policy the role already
carries, `ReciterPM-ArticleProvenance-Read` (a standalone customer-managed policy, attached to the
IRSA role).

Attach it to the IAM role that backs the pod's ServiceAccount:

| | |
|---|---|
| K8s ServiceAccount | `reciter-pm` in namespace `reciter` (`kubernetes/k8-deployment.yaml:33`) |
| IAM role (IRSA) | `eksctl-reciter-addon-iamserviceaccount-recite-Role1-2KkFv4xYVFNi` |
| Role ARN | `arn:aws:iam::665083158573:role/eksctl-reciter-addon-iamserviceaccount-recite-Role1-2KkFv4xYVFNi` |
| Trust | web identity, `oidc.eks.us-east-1.amazonaws.com/id/1BF3F29E409987A26C331BB74A58B214`, `sub = system:serviceaccount:reciter:reciter-pm` |
| Already attached | `ReciterPM-ArticleProvenance-Read` |

There is **no IAM role literally named `reciter-pm`** — `aws iam get-role --role-name reciter-pm`
returns `NoSuchEntity`. `reciter-pm` is the ServiceAccount name; the role above is the one whose trust
policy names that ServiceAccount, found by reading the trust document of every candidate role. Don't
create a second role.

```bash
aws iam create-policy \
  --policy-name ReciterPM-Bedrock-InvokeModel \
  --policy-document file://docs/iam-reciter-pm-bedrock.json

aws iam attach-role-policy \
  --role-name eksctl-reciter-addon-iamserviceaccount-recite-Role1-2KkFv4xYVFNi \
  --policy-arn arn:aws:iam::665083158573:policy/ReciterPM-Bedrock-InvokeModel
```

## Pattern copied from

`~/Dropbox/GitHub/CViche/docs/PRODUCTION_SECRETS.md`, the section **"If you're using Bedrock as the LLM
provider"** (lines 176–191): IRSA ServiceAccount → role → an `Allow` on
`bedrock:InvokeModel` + `bedrock:InvokeModelWithResponseStream`, scoped to **named model ARNs**, never
`Resource: "*"`. CViche wires the same shape in `k8s/base/backend/service-account.yaml` +
`k8s/overlays/{dev,prod}/sa-patch.yaml` (`cviche-sa` → `cviche-bedrock-role`). This policy is that
document's stanza, with the cross-region-profile hole closed.

## Why the foundation-model ARNs are NOT redundant

`BEDROCK_MODEL_ID = us.anthropic.claude-opus-4-8`. The `us.` prefix means this is a **cross-region
inference profile**, not a model. `InvokeModel` against a profile is authorized **twice**: once on the
profile ARN, and once on the foundation-model ARN **in whichever region Bedrock routes the request to**
— which is not necessarily the region the client called. A policy naming only the profile ARN passes
code review and throws `AccessDeniedException` in production the first time the profile routes out of
`us-east-1`. (Worse: it can *appear* to work for a while, then fail under load, when routing kicks in.)

Fan-out regions were read from the API, not assumed:

```
$ aws bedrock get-inference-profile \
    --inference-profile-identifier us.anthropic.claude-opus-4-8 --region us-east-1
  "description": "Routes requests to Claude Opus 4.8 in us-east-1, us-east-2, us-west-2.",
  "models": [
    { "modelArn": "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-opus-4-8" },
    { "modelArn": "arn:aws:bedrock:us-east-2::foundation-model/anthropic.claude-opus-4-8" },
    { "modelArn": "arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-opus-4-8" }
  ],
  "status": "ACTIVE", "type": "SYSTEM_DEFINED"
```

**us-east-1, us-east-2, us-west-2.** The three `foundation-model` ARNs in the policy are copied verbatim
from that response — note there is **no `:0` version suffix** on this model id, unlike older Claude ARNs.
If AWS adds a region to the profile, this policy must be updated; re-run `get-inference-profile` before
assuming it hasn't changed.

`InvokeModelWithResponseStream` is granted alongside `InvokeModel`. The app only uses
`InvokeModelCommand` today (`controllers/literatureSearch.controller.ts:885+`); the streaming action has
the same blast radius and saves a second IAM change if screening is ever streamed. Drop it if you'd
rather grant strictly what's called.

## The proof — no kubectl, no pod

Run this from any shell with IAM read + `iam:SimulatePrincipalPolicy`. It evaluates the **real role**,
with the **candidate policy** layered in, against the **four ARNs the SDK call actually touches**:

```bash
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::665083158573:role/eksctl-reciter-addon-iamserviceaccount-recite-Role1-2KkFv4xYVFNi \
  --policy-input-list "$(cat docs/iam-reciter-pm-bedrock.json)" \
  --action-names bedrock:InvokeModel \
  --resource-arns \
    arn:aws:bedrock:us-east-1:665083158573:inference-profile/us.anthropic.claude-opus-4-8 \
    arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-opus-4-8 \
    arn:aws:bedrock:us-east-2::foundation-model/anthropic.claude-opus-4-8 \
    arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-opus-4-8 \
  --query 'EvaluationResults[0].ResourceSpecificResults[].[EvalResourceDecision,EvalResourceName]' \
  --output text
```

Two gotchas that will otherwise give you a wrong answer:

- `--policy-input-list "$(cat …)"` — passing `file://…` makes the CLI shred the document into a list of
  single characters and the call fails validation.
- Read **`ResourceSpecificResults`**, not the top-level `EvalDecision`. With several resources, the
  top-level decision is a rollup and reads `implicitDeny` if *any* resource is denied — which is exactly
  the signal you want, but it hides *which* one.

Actual output, run 2026-07-14 with the policy in this directory:

```
allowed	arn:aws:bedrock:us-east-1:665083158573:inference-profile/us.anthropic.claude-opus-4-8
allowed	arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-opus-4-8
allowed	arn:aws:bedrock:us-east-2::foundation-model/anthropic.claude-opus-4-8
allowed	arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-opus-4-8
```

### Negative control — the role as it stands today

Same command with `--policy-input-list` removed:

```
implicitDeny	arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-opus-4-8
```

So today the feature is a guaranteed runtime `AccessDeniedException`, and this policy is what fixes it.

### The trap, demonstrated

Simulating a policy that grants `InvokeModel` on **only** the inference-profile ARN — the version that
passes code review:

```
allowed        arn:aws:bedrock:us-east-1:665083158573:inference-profile/us.anthropic.claude-opus-4-8
implicitDeny   arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-opus-4-8
implicitDeny   arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-opus-4-8
```

Green on the ARN a reviewer looks at, denied on the three the request is actually authorized against.

## Not covered here

- **Model access.** IAM is necessary, not sufficient: `anthropic.claude-opus-4-8` must also be *enabled*
  for the account in the Bedrock console (Model access) in **each** of us-east-1, us-east-2, us-west-2.
  A disabled model returns `AccessDeniedException` too, and no IAM change will move it.
- **Prod env vars.** Per `RUNBOOK-prod-literature-search.md`, the prod pipeline only runs `kubectl set image`, never
  `kubectl apply` — so `BEDROCK_MODEL_ID` / `AWS_REGION` will not reach the prod pod from the manifest
  even with this policy attached. That is a separate runbook item.
