#!/usr/bin/env node

/**
 * Bulk ORCID Update Script
 *
 * Finds people with a single clear ORCID candidate (3+ accepts, 0 rejects,
 * no existing ORCID in Identity) and updates their Identity in DynamoDB.
 *
 * Usage:
 *   node scripts/bulk-update-orcid.js                                    # Dry run
 *   node scripts/bulk-update-orcid.js --apply                            # Apply
 *   node scripts/bulk-update-orcid.js --api-url http://host:port         # Override API URL
 *
 * Environment (reads from .env.local automatically):
 *   RECITER_DB_HOST, RECITER_DB_NAME, RECITER_DB_USERNAME, RECITER_DB_PASSWORD
 *   RECITER_API_BASE_URL, NEXT_PUBLIC_RECITER_API_KEY
 */

const mysql = require('mysql2/promise');
const path = require('path');

// ── Load .env.local ──
try {
  const fs = require('fs');
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx);
        const val = trimmed.substring(eqIdx + 1);
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
} catch (e) { /* ignore */ }

const DRY_RUN = !process.argv.includes('--apply');

// --api-url flag overrides RECITER_API_BASE_URL
const apiUrlIdx = process.argv.indexOf('--api-url');
const API_BASE = (apiUrlIdx !== -1 && process.argv[apiUrlIdx + 1])
  ? process.argv[apiUrlIdx + 1]
  : process.env.RECITER_API_BASE_URL;
const API_KEY = process.env.NEXT_PUBLIC_RECITER_API_KEY;

if (!API_BASE || !API_KEY) {
  console.error('Missing RECITER_API_BASE_URL (or --api-url) and/or NEXT_PUBLIC_RECITER_API_KEY');
  console.error('Set them in .env.local, as environment variables, or pass --api-url.');
  process.exit(1);
}

const QUERY = `
SELECT
    a.personIdentifier,
    a.orcid,
    COUNT(DISTINCT CASE WHEN userAssertion = 'ACCEPTED' THEN b.pmid END) AS articleCount_accepted,
    COUNT(DISTINCT CASE WHEN userAssertion = 'NULL' THEN b.pmid END) AS articleCount_null,
    COUNT(DISTINCT CASE WHEN userAssertion = 'REJECTED' THEN b.pmid END) AS articleCount_rejected
FROM
    person_article_author a
JOIN
    person_article b ON b.pmid = a.pmid AND b.personIdentifier = a.personIdentifier
WHERE
    a.orcid IS NOT NULL
    AND a.orcid != ''
    AND targetAuthor = 1
GROUP BY
    a.personIdentifier, a.orcid
HAVING
    COUNT(DISTINCT CASE WHEN userAssertion = 'ACCEPTED' THEN b.pmid END) >= 3
    AND COUNT(DISTINCT CASE WHEN userAssertion = 'REJECTED' THEN b.pmid END) = 0
ORDER BY
    articleCount_accepted DESC
`;

async function getIdentity(uid) {
  try {
    const res = await fetch(`${API_BASE}/reciter/find/identity/by/uid?uid=${uid}`, {
      headers: { 'api-key': API_KEY },
    });
    if (res.status !== 200) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ReCiter API requires certain array fields to be non-null
const REQUIRED_ARRAY_FIELDS = [
  'alternateNames', 'emails', 'knownRelationships', 'organizationalUnits',
  'institutions', 'personTypes', 'grants',
];

async function saveIdentity(identity) {
  try {
    // Coerce null array fields to [] to avoid 500 validation errors
    for (const field of REQUIRED_ARRAY_FIELDS) {
      if (identity[field] === null || identity[field] === undefined) {
        identity[field] = [];
      }
    }
    // alternateNames must have at least one entry — synthesize from primaryName if empty
    if (identity.alternateNames.length === 0 && identity.primaryName) {
      const pn = identity.primaryName;
      identity.alternateNames = [{ firstName: pn.firstName || '', firstInitial: pn.firstInitial || '', lastName: pn.lastName || '' }];
    }
    // degreeYear must be an object
    if (!identity.degreeYear) {
      identity.degreeYear = { bachelorYear: 0, doctoralYear: 0 };
    }
    const res = await fetch(`${API_BASE}/reciter/identity/`, {
      method: 'POST',
      headers: {
        'api-key': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(identity),
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log(`  Bulk ORCID Update — ${DRY_RUN ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  console.log(`  API: ${API_BASE}`);
  console.log('='.repeat(60));
  console.log();

  // ── Verify ReCiter API is reachable ──
  console.log('Step 1: Checking ReCiter API connectivity...');
  const testIdentity = await getIdentity('paa2013');
  if (!testIdentity) {
    console.error('  ERROR: Cannot reach ReCiter API at ' + API_BASE);
    console.error('  Check RECITER_API_BASE_URL or pass --api-url <url>');
    process.exit(1);
  }
  console.log('  OK — ReCiter API is reachable.');
  console.log();

  // ── Query MySQL for candidates ──
  console.log('Step 2: Querying MySQL for ORCID candidates...');
  const conn = await mysql.createConnection({
    host: process.env.RECITER_DB_HOST,
    user: process.env.RECITER_DB_USERNAME,
    password: process.env.RECITER_DB_PASSWORD,
    database: process.env.RECITER_DB_NAME,
  });

  const [rows] = await conn.query(QUERY);
  console.log(`  ${rows.length} ORCID candidates found (3+ accepts, 0 rejects)`);

  // ── Dedupe: only keep people with exactly one ORCID candidate ──
  const byPerson = new Map();
  for (const row of rows) {
    if (!byPerson.has(row.personIdentifier)) {
      byPerson.set(row.personIdentifier, []);
    }
    byPerson.get(row.personIdentifier).push(row);
  }

  const CLEAR_WINNER_RATIO = 3; // top candidate must have 3x+ the accepts of the runner-up

  const singleCandidates = [];
  const resolvedAmbiguous = [];
  const trueAmbiguous = [];
  for (const [pid, candidates] of byPerson) {
    if (candidates.length === 1) {
      singleCandidates.push(candidates[0]);
    } else {
      // Sort by accepts descending
      candidates.sort((a, b) => b.articleCount_accepted - a.articleCount_accepted);
      const top = candidates[0].articleCount_accepted;
      const runnerUp = candidates[1].articleCount_accepted;
      if (top >= runnerUp * CLEAR_WINNER_RATIO) {
        resolvedAmbiguous.push(candidates[0]);
      } else {
        trueAmbiguous.push({ pid, candidates });
      }
    }
  }
  console.log(`  ${singleCandidates.length} people with exactly one ORCID candidate`);
  console.log(`  ${resolvedAmbiguous.length} ambiguous resolved (clear winner — ${CLEAR_WINNER_RATIO}x+ ratio)`);
  for (const r of resolvedAmbiguous) {
    const others = byPerson.get(r.personIdentifier).filter(c => c.orcid !== r.orcid);
    console.log(`    ${r.personIdentifier}: ${r.orcid} (${r.articleCount_accepted} accepted) vs ${others.map(o => o.orcid + ' (' + o.articleCount_accepted + ')').join(', ')}`);
  }
  console.log(`  ${trueAmbiguous.length} skipped (too close to call)`);
  for (const a of trueAmbiguous) {
    console.log(`    ${a.pid}: ${a.candidates.map(c => c.orcid + ' (' + c.articleCount_accepted + ' accepted)').join(' vs ')}`);
  }
  console.log();

  // Merge single + resolved ambiguous
  const allCandidates = [...singleCandidates, ...resolvedAmbiguous];

  // ── Check each against Identity API ──
  console.log('Step 3: Checking Identity records...');
  const toUpdate = [];
  let skippedExisting = 0;
  let skippedNotFound = 0;
  let checked = 0;

  for (const row of allCandidates) {
    checked++;
    if (checked % 100 === 0) {
      process.stdout.write(`  Checked ${checked}/${allCandidates.length} identities...\r`);
    }

    const identity = await getIdentity(row.personIdentifier);
    if (!identity) {
      skippedNotFound++;
      continue;
    }

    if (identity.orcid && identity.orcid.trim() !== '') {
      skippedExisting++;
      continue;
    }

    toUpdate.push({ row, identity });
  }
  console.log(`  Checked ${checked}/${allCandidates.length} identities.       `);
  console.log();
  console.log(`  NEW ORCIDs to assign:       ${toUpdate.length}`);
  console.log(`  Already have ORCID:         ${skippedExisting}`);
  console.log(`  Identity not found:         ${skippedNotFound}`);
  console.log();

  if (toUpdate.length === 0) {
    console.log('Nothing to update.');
    await conn.end();
    return;
  }

  // ── Preview or apply ──
  if (DRY_RUN) {
    console.log('Step 4: Preview (first 50):');
    for (const item of toUpdate.slice(0, 50)) {
      const { personIdentifier, orcid, articleCount_accepted } = item.row;
      console.log(`  ${personIdentifier} → ${orcid} (${articleCount_accepted} accepted)`);
    }
    if (toUpdate.length > 50) {
      console.log(`  ... and ${toUpdate.length - 50} more`);
    }
    console.log();
    console.log(`Run with --apply to update ${toUpdate.length} identities.`);
  } else {
    console.log(`Step 4: Updating ${toUpdate.length} identities...`);
    let updated = 0;
    let failed = 0;

    for (const item of toUpdate) {
      const { personIdentifier, orcid, articleCount_accepted } = item.row;
      item.identity.orcid = orcid;
      const ok = await saveIdentity(item.identity);
      if (ok) {
        updated++;
        console.log(`  [${updated}/${toUpdate.length}] SET ${personIdentifier} → ${orcid} (${articleCount_accepted} accepted)`);
      } else {
        failed++;
        console.log(`  [FAIL] ${personIdentifier} — save returned non-200`);
      }
    }

    console.log();
    console.log('Done.');
    console.log(`  Updated: ${updated}`);
    console.log(`  Failed:  ${failed}`);
  }

  await conn.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
