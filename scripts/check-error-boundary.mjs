#!/usr/bin/env node
/**
 * Guards the app-level render error boundary and the /_error redirect fix.
 * Run: node scripts/check-error-boundary.mjs
 */

import { readFile } from 'node:fs/promises';

const PASS = '\x1b[32mPASS\x1b[0m';
const FAIL = '\x1b[31mFAIL\x1b[0m';
let failures = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ${PASS} ${label}`);
  } else {
    console.log(`  ${FAIL} ${label}`);
    failures++;
  }
}

const app = await readFile(new URL('../src/pages/_app.tsx', import.meta.url), 'utf8');
const layout = await readFile(new URL('../src/components/layouts/AppLayout.jsx', import.meta.url), 'utf8');

console.log('\n1. _app.tsx boundary wiring:');
assert(/class RenderErrorBoundary extends Component/.test(app), 'boundary is a class component');
assert(/static getDerivedStateFromError/.test(app), 'renders a fallback via getDerivedStateFromError');
assert(/componentDidCatch/.test(app), 'logs via componentDidCatch');
assert(/<RenderErrorBoundary>[\s\S]*getLayout\(<Component[\s\S]*<\/RenderErrorBoundary>/.test(app), 'boundary wraps the page');
assert(/reportError\("ERR-0500", `Render crash \$\{this\.state\.ref\}/.test(app), 'reports ERR-0500 with the reference id');
assert(/<ErrorFallback statusCode=\{500\} \/>/.test(app), 'fallback renders the shared Error component as a 500 (danger colour)');

console.log('\n2. reference id generation:');
const expr = app.match(/const ref = (\(globalThis[\s\S]*?);\n/);
assert(!!expr, 'reference id expression found');
if (expr) {
  const make = new Function('globalThis', 'performance', `return ${expr[1]}`);
  const withCrypto = make({ crypto: { randomUUID: () => '0193f4c2-9c1a-7b3e-8f21-9a0f2c4d5e6b' } }, performance);
  const withoutCrypto = make({}, performance);
  for (const [label, ref] of [['crypto.randomUUID', withCrypto], ['performance.now fallback', withoutCrypto]]) {
    assert(typeof ref === 'string' && ref.length === 8, `${label}: 8 characters (got ${JSON.stringify(ref)})`);
    assert(/^[0-9A-Z]+$/.test(ref), `${label}: greppable, uppercase alphanumeric`);
  }
}

console.log('\n3. AppLayout no longer traps the user on /_error:');
assert(/import \{ clearError,/.test(layout), 'clearError imported');
assert(/router\.push\("\/_error"\);[\s\S]{0,300}?dispatch\(clearError\(\)\);/.test(layout), 'errors array cleared right after the redirect');

console.log(failures ? `\n${failures} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failures ? 1 : 0);
