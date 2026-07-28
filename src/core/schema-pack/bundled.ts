// Bundled schema-pack registry — single source of truth for the packs that
// ship in src/core/schema-pack/base/. Keep every bundled-pack consumer
// (CLI/MCP inspection, active-pack loading, mutation guards, upgrade
// discovery) on this one list so they cannot drift.
//
// v0.39 T8 — gbrain-base + gbrain-recommended.
// v0.41 T4 — lens packs: creator, investor, engineer, everything (meta-pack).
// v0.42 type-unification — gbrain-base-v2, the 15-type canonical successor.

import gbrainBase from './base/gbrain-base.yaml' with { type: 'text' };
import gbrainRecommended from './base/gbrain-recommended.yaml' with { type: 'text' };
import gbrainCreator from './base/gbrain-creator.yaml' with { type: 'text' };
import gbrainInvestor from './base/gbrain-investor.yaml' with { type: 'text' };
import gbrainEngineer from './base/gbrain-engineer.yaml' with { type: 'text' };
import gbrainEverything from './base/gbrain-everything.yaml' with { type: 'text' };
import gbrainBaseV2 from './base/gbrain-base-v2.yaml' with { type: 'text' };

export const BUNDLED_PACK_NAMES = [
  'gbrain-base',
  'gbrain-recommended',
  'gbrain-creator',
  'gbrain-investor',
  'gbrain-engineer',
  'gbrain-everything',
  'gbrain-base-v2',
] as const;

export type BundledPackName = typeof BUNDLED_PACK_NAMES[number];

const BUNDLED_PACK_SOURCES: Record<BundledPackName, string> = {
  'gbrain-base': gbrainBase,
  'gbrain-recommended': gbrainRecommended,
  'gbrain-creator': gbrainCreator,
  'gbrain-investor': gbrainInvestor,
  'gbrain-engineer': gbrainEngineer,
  'gbrain-everything': gbrainEverything,
  'gbrain-base-v2': gbrainBaseV2,
};

export function isBundledPackName(name: string): name is BundledPackName {
  return (BUNDLED_PACK_NAMES as readonly string[]).includes(name);
}

/** Return the manifest text statically embedded by Bun's bundler/compiler. */
export function getBundledPackSource(name: string): string | null {
  return isBundledPackName(name) ? BUNDLED_PACK_SOURCES[name] : null;
}
