# Build Issue: `npm ci` fails with missing `string_decoder@1.1.1`

## Status
Blocking deployment to `reciter-dev` as of 2026-04-06.
Last successful build: 2026-02-09 (pipeline execution `c0296aa3`).

## Symptom

CodeBuild (`ReCiter-Publication-Manager-Dev` pipeline, Build stage) fails with:

```
npm error code EUSAGE
npm error `npm ci` can only install packages when your package.json and
npm error package-lock.json or npm-shrinkwrap.json are in sync.
npm error
npm error Missing: string_decoder@1.1.1 from lock file
```

## Root Cause

The `package-lock.json` (lockfileVersion 3) was generated with a different npm version
than the one bundled with `node:20-alpine` in the Dockerfile. The `node:20-alpine` image
tag is mutable — it has received a npm update (now `10.8.2`) since the lock file was last
regenerated. npm 10.8.2 is stricter about requiring transitive dependencies to be
explicitly listed, and `string_decoder@1.1.1` is missing from the current lock file.

Running `npm install --legacy-peer-deps` locally (npm 10.9.4) does not reproduce the
problem or update the lock file in a way that satisfies npm 10.8.2 inside the container.

## What Was Tried

1. `npm install --package-lock-only` — no change to lock file
2. `npm install --legacy-peer-deps` — small change (102 lines removed), same error

## Fix Required

The lock file must be regenerated **inside a container matching the build environment**
so the correct npm version resolves all transitive dependencies:

```bash
docker run --rm -v $(pwd):/app -w /app node:20-alpine \
  sh -c "npm install --legacy-peer-deps"
git add package-lock.json
git commit -m "fix(deps): regenerate package-lock.json inside node:20-alpine"
git push origin dev_Upd_NextJS14SNode18
```

Then trigger and approve the pipeline as usual.

## Alternative (Quick Unblock)

Change the Dockerfile line from:
```dockerfile
RUN npm ci --frozen-lockfile
```
to:
```dockerfile
RUN npm install --legacy-peer-deps
```

This trades reproducibility for unblocking the deployment. Not recommended long-term.

## Pipeline Reference

- Pipeline: `ReCiter-Publication-Manager-Dev` (AWS CodePipeline, us-east-1)
- CodeBuild project: `ReCiter-Publication-Manager`
- Branch: `dev_Upd_NextJS14SNode18`
- Dockerfile base image: `node:20-alpine`

## Commits Waiting to Deploy

| Commit | Description |
|--------|-------------|
| `f1cb7c3` | fix(deps): update package-lock.json (partial fix, insufficient) |
| `064a91f` | fix(curate): immutable parent updates + child re-sync so cards disappear on assert |
| `ba162b8` | fix(curate): immediately remove actioned cards from Suggested tab |
| `51f5377` | fix(goldstandard): add try-catch to prevent unhandled exceptions |
| `51ed535` | fix(goldstandard): remove invalid Content-Length header |
