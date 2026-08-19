/*
 * STATIC GUARDS for the Literature Search check — properties asserted by reading a SOURCE FILE
 * rather than by exercising a database dialect. Split out of literatureSearch.check.dialects.js
 * because a grep of a .tsx file is not a dialect fact, even though it currently has only one tenant.
 */
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const { ROOT } = require('./literatureSearch.check.harness')

// ...AND THE SCREEN MUST COUNT WITH THIS EXACT FUNCTION. The component used to keep its own
// PMID-only `parseSeeds` (a `/^\d{5,9}$/` filter), which meant the live "N seeds" pill and the
// server's validation disagreed in BOTH directions: a pasted DOI counted 0 on screen and 1 on
// the server, a comma-separated list of 3 counted 1, and the same PMID twice counted 2 on
// screen and 1 on the server. The pill is the librarian's only pre-flight evidence that their
// seeds registered, so a shadowing copy is a confident wrong number by construction. There is
// no runtime seam to assert this through (the .tsx never reaches node), so assert it at the
// source: the browser imports the shared parser and does not redefine one.
const checkTsxDoesNotShadowParseSeeds = () => {
    const tsx = fs.readFileSync(
        path.join(ROOT, 'src/components/elements/Literature/LiteratureSearch.tsx'), 'utf8')
    assert.ok(!/(?:const|function)\s+parseSeeds\b/.test(tsx),
        'LiteratureSearch.tsx must NOT define its own parseSeeds — it shadows the shared one and the seed count stops matching what the server validates')
    assert.ok(/^\s*parseSeeds,\s*$/m.test(tsx),
        'LiteratureSearch.tsx must import parseSeeds from literatureSearch.strategy')
}

module.exports = { checkTsxDoesNotShadowParseSeeds }
