import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = join(import.meta.dir, '..', '..');
const buildDir = mkdtempSync(join(tmpdir(), 'gbrain-schema-compiled-'));
const binaryPath = join(buildDir, 'gbrain');

beforeAll(() => {
  const build = spawnSync('bun', [
    'build',
    '--compile',
    '--outfile',
    binaryPath,
    'src/cli.ts',
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
  });
  expect(build.status, build.stderr || build.stdout).toBe(0);
});

afterAll(() => {
  rmSync(buildDir, { recursive: true, force: true });
});

function runCompiled(home: string, args: string[]) {
  const result = spawnSync(binaryPath, args, {
    cwd: home,
    encoding: 'utf-8',
    env: {
      ...process.env,
      GBRAIN_HOME: home,
      DATABASE_URL: '',
      GBRAIN_DATABASE_URL: '',
    },
  });
  return {
    code: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

describe('compiled binary bundled schema packs', () => {
  test('loads the default bundled pack without the source tree on disk', () => {
    const home = mkdtempSync(join(tmpdir(), 'gbrain-schema-compiled-home-'));
    try {
      const result = runCompiled(home, ['schema', 'active']);
      expect(result.code, result.stderr).toBe(0);
      expect(result.stdout).toContain('Active pack: gbrain-base');
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test('activates gbrain-base-v2 from the bundled registry', () => {
    const home = mkdtempSync(join(tmpdir(), 'gbrain-schema-compiled-home-'));
    try {
      const use = runCompiled(home, ['schema', 'use', 'gbrain-base-v2']);
      expect(use.code, use.stderr).toBe(0);

      const active = runCompiled(home, ['schema', 'active']);
      expect(active.code, active.stderr).toBe(0);
      expect(active.stdout).toContain('Active pack: gbrain-base-v2');
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
