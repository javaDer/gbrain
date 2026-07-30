# Incident Report: Docker Build and Compiled Schema Pack Assets

**Date:** 2026-07-28  
**Components:** Docker image publishing, Bun standalone binary, schema pack loader  
**Affected release:** `gbrain 0.42.66.1`  
**Affected image:** `ghcr.io/javader/gbrain@sha256:301a55b51f9de3371da3b492b39c80d4276698aa329cc36e338a39c979a29f3d`

## Summary

Two independent packaging defects affected the GHCR Docker image flow:

1. Docker dependency installation failed because the root `postinstall`
   referenced a repository script before the script had been copied into the
   build layer.
2. After the image built, the standalone `/usr/local/bin/gbrain` executable
   could list bundled schema pack names but could not load their YAML
   manifests. The runtime image contained only the binary, while the loader
   still expected files from the source tree.

Both defects were reproduced locally with deterministic command-line harnesses,
fixed at their packaging boundaries, covered by regression checks, committed,
and pushed to `master`.

## Incident 1: Docker Publish Failed During `bun install`

GitHub Actions reported only the final Buildx error:

```text
process "/bin/sh -c bun install --frozen-lockfile" did not complete successfully
```

The full failed-run log showed the actual cause:

```text
$ bun run scripts/postinstall.ts
error: Module not found "scripts/postinstall.ts"
error: postinstall script from "gbrain" exited with 1
```

### Root cause

The Dockerfile copied only `bun.lock` and `package.json` before running
`bun install`. The root lifecycle hook needed `scripts/postinstall.ts`, but the
rest of the repository was copied in the next layer. `.dockerignore` also
excluded `scripts/`.

The hook's migration side effect was not needed while building an image.

### Fix

The dependency layer now skips the root package lifecycle hook:

```dockerfile
RUN bun install --frozen-lockfile --ignore-scripts
```

Minimal reproduction against the failed commit changed from exit code 1 to 0,
with all dependencies, including PGLite, installed successfully.

**Commit:** `c991f95f fix(docker): skip root postinstall during image build`

## Incident 2: Bundled Schema Packs Missing From the Standalone Binary

The affected image produced this contradictory behavior:

```text
$ gbrain schema list
Bundled packs:
  gbrain-base
  gbrain-recommended
  gbrain-creator
  gbrain-investor
  gbrain-engineer
  gbrain-everything
  gbrain-base-v2

$ gbrain schema use gbrain-base-v2
Unknown pack: gbrain-base-v2

$ gbrain schema active
unknown schema pack: gbrain-base
```

Setting `GBRAIN_SCHEMA_PACK=gbrain-base-v2` did not help. The failure also
reproduced with a completely empty `GBRAIN_HOME`, ruling out configuration
precedence as the cause.

### Root cause

`schema list` printed the static `BUNDLED_PACK_NAMES` registry and never loaded
the manifests. `schema use`, `schema active`, and other schema commands resolved
bundled packs through source-relative filesystem paths such as:

```text
src/core/schema-pack/base/gbrain-base-v2.yaml
```

Those paths exist during `bun run src/cli.ts`, but not in a standalone
`bun build --compile` executable. The runtime Docker stage copied only the
binary, so no YAML files were available on disk.

### Fix

- All seven bundled YAML manifests are statically imported as text in
  `src/core/schema-pack/bundled.ts`, causing Bun to embed them in compiled
  binaries.
- `loadPackManifestByName` first uses a real file when one exists, preserving
  direct-source development behavior, then falls back to the embedded manifest.
- Schema CLI inspection, activation, validation, fork, diff, and lint commands
  now share the same manifest-loading entry point instead of maintaining a
  second path-only resolver.
- A regression test compiles the real standalone binary, runs it outside the
  source tree with an empty `GBRAIN_HOME`, and asserts that both the default
  `gbrain-base` pack and `gbrain-base-v2` activation work.

**Commit:** `1515f072 fix(schema): embed bundled packs in compiled binary`

## Verification

The final implementation passed:

- Compiled-binary regression: 2/2 tests.
- Existing schema CLI and loader regression set: 27/27 tests.
- TypeScript typecheck.
- `bun run verify`: 31/31 checks.
- Manual standalone-binary sequence:

```text
schema list                         exit 0
schema use gbrain-base-v2           exit 0
schema active                       exit 0
GBRAIN_SCHEMA_PACK=gbrain-recommended schema active  exit 0
```

The full local Docker/E2E gate could not run because the local OrbStack Docker
daemon was unavailable. GitHub Actions is therefore the authoritative
multi-architecture image build and publish gate for the pushed commit.

## Temporary Workaround for the Affected Image

Before a fixed image is available, `gbrain-base-v2` can be installed under a
non-bundled alias. The alias is required because the affected binary always
routes the original bundled name to its missing source-tree path.

```bash
mkdir -p /data/.gbrain/schema-packs/gbrain-base-v2-local

curl -fsSL \
  https://raw.githubusercontent.com/javaDer/gbrain/02d6becd2aab5c9acd1861f02d832898726d4b6a/src/core/schema-pack/base/gbrain-base-v2.yaml \
  -o /data/.gbrain/schema-packs/gbrain-base-v2-local/pack.yaml

gbrain schema validate gbrain-base-v2-local
gbrain schema use gbrain-base-v2-local
gbrain schema active
```

This workaround is safe for `gbrain-base-v2` because its manifest has
`extends: null` and does not require another missing bundled manifest.

## Lessons and Preventive Rules

1. A command that lists bundled resource names must prove those resources can
   also be loaded from the shipped artifact.
2. Source-relative `import.meta.url` paths are not sufficient evidence that a
   file is available inside a Bun standalone executable.
3. Every resource required by a single-binary distribution should be either
   statically embedded or explicitly copied into the runtime image.
4. Docker dependency-cache layers must not execute root lifecycle hooks that
   depend on files copied in later layers.
5. Packaging regressions need tests against the actual compiled executable,
   run from outside the repository, not only source-mode CLI tests.

## Release Status

- Both fixes were pushed to `master`.
- The schema fix push is commit `1515f072`.
- The Docker Publish and Test workflows should be checked for that exact SHA
  before declaring the replacement GHCR image ready.
