# Decision: Literature Search talks to PubMed through the ReCiter Retrieval Tool, not an MCP server

**Status:** decided, 2026-07-13
**Applies to:** Literature Search (Mode 1), and any future PubMed-backed feature in RPM.

## The question that keeps coming up

*"There's a PubMed MCP server available. Should the app use it instead of the ReCiter PubMed
Retrieval Tool?"*

**No.** Not "not yet" — the MCP server cannot do the two things this feature is built on. Below is
the evidence, so nobody has to re-derive it.

(The planning doc lives in `~/Dropbox/Projects/PubMed MCP/`, which is probably why this recurs.
That directory name is where the spec sits; it is not a statement about the implementation.)

## What we actually use

| Need | Endpoint on the Retrieval Tool |
|---|---|
| Hit counts, uncapped (the deliverable) | `POST /pubmed/query-number-pubmed-articles/` (esearch) |
| Seed titles + MeSH, bounded to 3–5 PMIDs | `POST /pubmed/query-complex/` (efetch) |

Consistent with PRs #796–800, which deliberately consolidated PM's PubMed access behind the
retrieval tool. The tool owns `PUBMED_API_KEY` and the backoff.

## Why the MCP server cannot replace it

### 1. It rejects wildcards. This alone is fatal.

The `search_articles` tool's `query` parameter says, verbatim:

> *"Cannot be an empty string nor use wildcard symbols like `*`."*

Every strategy this feature produces is built on truncation. A real line from a live run:

```
probiotic*[tiab] OR synbiotic*[tiab] OR prebiotic*[tiab] OR psychobiotic*[tiab] OR lactobacill*[tiab]
depress*[tiab] OR dysthymi*[tiab] OR melanchol*[tiab]
```

Truncation **is** recall-oriented searching — it is how one term catches
depression/depressive/depressed. A client that cannot accept `*` cannot run a single
systematic-review strategy we emit. Not degraded: unrunnable.

### 2. It returns ranked articles, not a count. The count IS the deliverable.

`search_articles` takes `max_results` (default 20), `retstart` for pagination, and `sort`
(relevance among the options). Mode 1's output is an **uncapped hit count** from esearch. A live
run yielded 5,931 records; deriving that through this tool means paginating 5,931 articles twenty
at a time (~297 calls) to reproduce what esearch returns in one. A realistic 15,000-hit SR
strategy is worse.

It also accepts *natural-language* queries and ranks by relevance, which implies query rewriting.
**Reproducibility is the entire promise of Mode 1** — the count must match what a librarian gets
typing the same Boolean into the PubMed web UI. Any rewriting layer destroys that.

### 3. It is not deployable from a pod.

The server is claude.ai-hosted and interactively authenticated. It exists because a human is
authenticated in a Claude session. When a librarian clicks "Build strategy" on reciter-dev at 2am
there is no Claude session to broker the call and no IRSA path to authenticate one. The pod needs
a service it can reach in-cluster.

An MCP server is a protocol for connecting an **LLM client** to tools. A Next.js API route making
a deterministic HTTP call is not an LLM client. Wrapping it in MCP adds a protocol layer for
nothing.

## What the MCP server is legitimately good for

**Ad-hoc exploration by a human or an agent** — checking what MeSH a paper carries, sanity-reading
an abstract. Fine. But **do not use it to verify this feature**: validating our PubMed client
against a *different* PubMed client proves nothing about the one that ships. Verify against the
retrieval tool on `:8083`, and use raw `curl` to NCBI when you need to establish whether a failure
is ours or theirs. (That is exactly how the stale-jar DOCTYPE failure got correctly pinned on the
jar rather than on this feature.)

## What would reopen this

**PMC full text.** The MCP server has `get_full_text_article`; the ReCiter retrieval tool has no
full-text path. Mode 1 explicitly does not need it — full-text screening is Covidence's job and is
permanently out of scope. If Issue review ever needs full text, reopen the question — but the
answer is still probably "add an efetch-PMC route to the retrieval tool," not "add a second PubMed
client with different query semantics."

Nothing else on the roadmap needs it. Abstracts, which Modes 2/3 would need for synthesis, already
come back from `query-complex`.

## The inverse idea, which is genuinely interesting and NOT this

Exposing **ReCiter's own search as an MCP server**, so a librarian could drive strategy-building
from Claude. That is a different feature with a different justification, and it should wait until a
librarian asks for it.
