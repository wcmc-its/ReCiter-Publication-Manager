# Architecture diagrams

Polished, version-controlled architecture diagrams for ReCiter Publication
Manager, generated from plain-data `.mjs` specs by a dependency-free Node
renderer. No Mermaid, Graphviz, draw.io, layout engine, or `npm install`.

## Build

```bash
node scripts/diagrams/build.mjs
```

Outputs land in [`docs/architecture/`](../../docs/architecture/):

- `*.svg` — one standalone vector per view (renders on GitHub, crisp at any zoom) — **committed**
- `*.png` — raster for Slack/Teams/slides — **gitignored** (regenerable)
- `index.html` — a branded gallery; open it, then ⌘/Ctrl+P → *Save as PDF* for decks

PNG rasterizing uses `rsvg-convert` if present (`brew install librsvg`), else the
`sharp` npm package; without either, the SVGs + HTML still build.

## The views

| # | File | What it answers |
|---|------|-----------------|
| ① | `definitions/01-system-context.mjs` | What feeds Publication Manager and who it serves |
| ② | `definitions/02-app-internals.mjs` | Inside the Next.js container (C4: browser → middleware → API → controllers → data) |
| ③ | `definitions/03-request-flows.mjs` | The three core journeys: sign-in, curate, report |
| ④ | `definitions/04-deployment.mjs` | Git push → CodePipeline → CodeBuild → ECR → EKS |
| ⑤ | `definitions/05-rbac.mjs` | Roles → permissions → gated routes (+ role×capability matrix) |

## Verify (four tiers)

1. **`validate()`** — node overlaps + out-of-bounds. Runs in `build.mjs`; non-zero exit gates CI.
2. **Crossing lint** — edges that tunnel *through* a foreign node box:
   ```bash
   node scripts/diagrams/check-crossings.mjs
   ```
3. **Fact check** (`verify-facts.mjs`, auto-run by the build) — asserts the
   constants baked into the diagrams still match real sources: the pinned stack
   versions in `package.json`, `node:18-alpine` in the `Dockerfile`, the EKS
   deployment names in `k8-buildspec.yml`, the ReCiter feature-generator contract
   in `config/local.js`, `ROUTE_PERMISSIONS` in `src/middleware.ts`, and the
   `authorship_review` table. Fails loud if a source constant can't be found.
4. **Look at the rendered PNG / `index.html`.** Always — no automated check
   catches a label on a line or a confusing-but-legal route.

> **Note on versions:** the diagrams reflect `package.json` (the deployed image):
> Next.js 12, React 16, next-auth 3, saml2-js 3, Sequelize 6. The README "stack"
> table lists aspirational Next 14 / React 18 — `package.json` is the source of
> truth, and `verify-facts.mjs` binds to it.

## Editing

A view is a `spec` of `groups` (labelled bands), `nodes` (boxes), and `edges`
(wires) on a literal `vb: [width, height]` grid. Change a definition (pure data),
re-run `build.mjs`, and re-verify. `lib.mjs` / `build.mjs` / `check-crossings.mjs`
are the shared, project-agnostic renderer — keep them in sync with the other
ReCiter repos that use this toolkit rather than special-casing per diagram.
