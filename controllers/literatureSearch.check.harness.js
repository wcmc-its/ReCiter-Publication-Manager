/*
 * The shared plumbing behind the Literature Search checks: where the compiled output goes, how
 * .env.local is read, and how the modules under test are compiled.
 *
 * NOTHING HERE ASSERTS ANYTHING, and nothing here wraps node:assert. Each part of the check calls
 * assert directly, because a bespoke assertion helper buys a tidier call site and costs the one
 * thing a red check is for: the message that says which property broke and why it matters.
 *
 * THE ENV LOADER IS THE ONE COPY. literatureSearch.recall.js, .screen.js and .question.js each
 * carry a byte-identical inline copy of loadEnvLocal's body; they can require this file and drop
 * theirs. They are deliberately not touched here — each is a check in its own right and deserves
 * its own change rather than being edited in passing by a refactor of a different file.
 */
const fs = require('node:fs')
const path = require('node:path')
const { execSync } = require('node:child_process')

const ROOT = path.resolve(__dirname, '..')
// Compile INSIDE the worktree, not os.tmpdir(). The controller imports
// @aws-sdk/client-bedrock-runtime at module scope, and node resolves node_modules by walking
// UP from the required file — from /var/folders/... it never reaches the repo and the require
// dies with MODULE_NOT_FOUND. (The check still makes no model call; the import just has to
// resolve.) .litcheck/ is gitignored.
//
// A subdirectory of .litcheck/, never the top level: literatureSearch.pure.check.js keeps its own
// compiled output and its own cleanup under .litcheck/pure, and this check's cleanOutDir() runs an
// UNSCOPED recursive rm — if OUT were the shared .litcheck/ itself, this check's start/success/catch
// cleanup could delete the pure check's tree out from under it (or vice versa) whenever both run
// around the same time. .litcheck/live keeps this check's recursive delete inside its own subtree,
// exactly as .litcheck/pure already keeps the other one inside its.
const OUT = path.join(ROOT, '.litcheck', 'live')

// A laptop keeps RECITER_PUBMED_API_URL in .env.local, which is gitignored — so on any runner that
// checks the repo out there is no such file, and reading it unconditionally crashes with ENOENT
// before a single assertion runs. A missing file is therefore not an error: the same names arrive as
// real environment variables instead. An UNSET url still is an error, and the first count says so
// loudly. Where the file does exist it still WINS, or a stale shell export would quietly point a
// local run at a different PubMed than the one the developer is reading in .env.local.
const loadEnvLocal = (root = ROOT) => {
    const envFile = path.join(root, '.env.local')
    if (fs.existsSync(envFile)) {
        for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
            const m = line.match(/^([A-Z_]+)\s*=\s*(.*)$/)
            if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
        }
    }
}

const cleanOutDir = (outDir = OUT) => fs.rmSync(outDir, { recursive: true, force: true })

// The compile is the step most likely to break for a reason that has nothing to do with the
// feature — a stray type error in a module the check merely loads, a missing tsc. execSync throws
// "Command failed" and the exit code, which names neither the compiler nor the files, so a green
// feature reads as a broken check. Say what failed to compile, and where it was going.
const compileLiterature = (sources, outDir = OUT) => {
    try {
        execSync(
            `npx tsc ${sources.join(' ')} --outDir ${outDir} ` +
            `--module commonjs --target es2020 --esModuleInterop --skipLibCheck --allowJs`,
            { cwd: ROOT, stdio: 'inherit' },
        )
    } catch (err) {
        throw new Error(
            `Failed to compile ${sources.join(', ')} into ${path.relative(ROOT, outDir)} — ` +
            `the check cannot run until tsc does: ${err.message}`,
        )
    }
}

// Load a module the step above just emitted. Always by its path INSIDE the worktree, for the same
// node_modules-resolution reason OUT exists at all.
const requireCompiled = (relPath, outDir = OUT) => require(path.join(outDir, relPath))

module.exports = { ROOT, OUT, loadEnvLocal, cleanOutDir, compileLiterature, requireCompiled }
