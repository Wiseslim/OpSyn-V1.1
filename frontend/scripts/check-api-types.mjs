#!/usr/bin/env node
/**
 * Fails if src/api/schema.gen.ts is out of date with the running API.
 *
 * The frontend's view of the wire format drifted from the backend's four
 * separate times before this existed: OutageIncident declared six fields
 * the API never sent, TaskWorkflowPayload demanded two the API treats as
 * optional, StaffStatus omitted a value the backend accepts, and
 * job_title was required against an Optional[str]. Every one was found by
 * reading the backend by hand.
 *
 * Regenerating and diffing turns that class of mistake into a failed
 * build. Skips cleanly when the API is unreachable, so it never blocks a
 * local run or an offline CI job -- it only fails on real drift.
 *
 *   npm run types:check
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SPEC      = process.env.OPENAPI_URL ?? 'http://localhost:8000/openapi.json';
const COMMITTED = 'src/api/schema.gen.ts';
const SCRATCH   = join(tmpdir(), `opsyn-schema-${process.pid}.ts`);

const reachable = await fetch(SPEC, { signal: AbortSignal.timeout(5000) })
  .then((r) => r.ok)
  .catch(() => false);

if (!reachable) {
  console.log(`- API not reachable at ${SPEC}; skipping the contract check.`);
  console.log('  Start the stack and re-run to verify the types still match.');
  process.exit(0);
}

try {
  execFileSync('npx', ['openapi-typescript', SPEC, '-o', SCRATCH], {
    stdio: 'pipe',
    shell: process.platform === 'win32',
  });
} catch (err) {
  console.error('! Could not generate types from the API.');
  console.error(String(err.stderr ?? err));
  process.exit(1);
}

// schema.gen.ts is committed exactly as the generator writes it, so a
// plain comparison suffices once line endings are normalised.
const normalise = (text) => text.split('\r\n').join('\n').trim();

const fresh     = normalise(readFileSync(SCRATCH, 'utf8'));
const committed = normalise(readFileSync(COMMITTED, 'utf8'));
rmSync(SCRATCH, { force: true });

if (fresh === committed) {
  console.log('+ API types are in sync with the backend.');
  process.exit(0);
}

console.error('! API types are out of date with the backend.');
console.error(`  ${COMMITTED} no longer matches ${SPEC}.`);
console.error('  Run `npm run types:generate`, review the diff, and commit it.');
process.exit(1);
