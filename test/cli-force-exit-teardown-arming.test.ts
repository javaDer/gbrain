/**
 * Structural regression — the DISCONNECT_HARD_DEADLINE_MS force-exit timer
 * must be armed at TEARDOWN ENTRY, never before the op-dispatch try block.
 *
 * Pre-fix bug (fixed independently by master's v0.42.41.0 triage wave AND
 * the #2084 wave): the 10s unref'd setTimeout was armed BEFORE the try, so
 * any op whose handler ran past 10s wall-clock was killed mid-flight with
 * process.exit(0) and ZERO stdout — an empty "success" indistinguishable
 * from no results (a healthy `gbrain search` on a slow Postgres pooler hit
 * this on every run).
 *
 * Post-#2084 the arming lives INSIDE the shared `drainThenDisconnect`
 * helper — the single owner-disconnect every CLI exit path calls from its
 * finally — so it structurally bounds ONLY the teardown window (drain +
 * disconnect) at every site, not just the op-dispatch path.
 *
 * Source-grep is the right tool here (same rationale as
 * fix-wave-structural.test.ts): the rule is "this arming must stay at this
 * location". A behavioral test would need >10s of real wall-clock plus a
 * deliberately slow op handler in a spawned CLI — slow and flaky by
 * construction.
 */

import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';

describe('cli.ts — disconnect hard-deadline armed at teardown entry, not before the op body', () => {
  test('no timer arming between the op-dispatch entry and its try block', () => {
    const src = readFileSync('src/cli.ts', 'utf8');
    // The op-dispatch local-engine path: from connectEngine to its try, no
    // setTimeout call may be armed (a pre-try timer kills slow-but-progressing
    // op handlers mid-flight with exit 0 and empty stdout). `setTimeout(`
    // matches only a call site; ReturnType<typeof setTimeout> stays allowed.
    const entry = src.indexOf('// Local engine path (unchanged behavior');
    expect(entry).toBeGreaterThan(-1);
    const tryIdx = src.indexOf('try {', entry);
    expect(tryIdx).toBeGreaterThan(-1);
    expect(src.slice(entry, tryIdx)).not.toContain('setTimeout(');
  });

  test('the deadline arming lives inside drainThenDisconnect: gated, unref\'d, before the drain, cleared after', () => {
    const src = readFileSync('src/cli.ts', 'utf8');
    const helper = src.match(/export async function drainThenDisconnect[\s\S]+?^\}/m);
    expect(helper).not.toBeNull();
    const block = helper![0];

    const armIdx = block.indexOf('deadlineTimer = setTimeout');
    const drainIdx = block.indexOf('drainAllBackgroundWorkForCliExit');
    expect(armIdx).toBeGreaterThan(-1);
    expect(drainIdx).toBeGreaterThan(-1);
    // Armed at teardown entry, before the drain + disconnect it bounds.
    expect(armIdx).toBeLessThan(drainIdx);
    // Gated on the daemon-survival guard so `serve` stays alive.
    expect(block.slice(0, armIdx)).toMatch(/if \(shouldForceExitAfterMain\(\)\)/);
    // Unref'd so the timer itself never keeps the event loop alive.
    expect(block).toContain('deadlineTimer.unref?.()');
    // Cleared on clean teardown.
    expect(block).toContain('if (deadlineTimer) clearTimeout(deadlineTimer)');
    // The DISCONNECT_HARD_DEADLINE_MS declaration sits with the helper.
    const decl = src.indexOf('const DISCONNECT_HARD_DEADLINE_MS');
    expect(decl).toBeGreaterThan(-1);
    expect(src.indexOf('export async function drainThenDisconnect')).toBeGreaterThan(decl);
  });
});
