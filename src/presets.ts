/**
 * Chordal preset data — the "everything" aggregator. Assembles all 9 families' recipes and
 * presets from families/*.ts into the same FAMILY_RECIPES/PRESETS shape the rest of the
 * library (index.ts, chordal-playground.ts) has always used, so importing `chordal` keeps
 * working exactly as before.
 *
 * Importing this file pulls in every family. A consumer who only needs one family should
 * import it directly instead — `import chime from 'chordal/chime'` — which never touches
 * this file at all, and pull in `createPlayer` from `chordal/lite` to play it. See
 * families/*.ts for the data, resolve.ts for the family-agnostic synthesis math both paths
 * share.
 */

import softBubble from './families/soft-bubble';
import glassCrystal from './families/glass-crystal';
import paperSnap from './families/paper-snap';
import metallicTact from './families/metallic-tact';
import chime from './families/chime';
import digitalBlip from './families/digital-blip';
import spring from './families/spring';
import tinySparkle from './families/tiny-sparkle';
import snap from './families/snap';
import type { FamilyRecipe, InstancePreset, SoundFamily, SoundInstance, SoundFamilyModule } from './types';

export * from './types';
export { resolveNoteParams, resolveToggleTuning, isToneAudible, getPitchRange } from './resolve';

const ALL_FAMILIES: SoundFamilyModule[] = [
  softBubble,
  glassCrystal,
  paperSnap,
  metallicTact,
  chime,
  digitalBlip,
  spring,
  tinySparkle,
  snap,
];

export const FAMILY_RECIPES: Record<SoundFamily, FamilyRecipe> = Object.fromEntries(
  ALL_FAMILIES.map((family) => [family.name, family.recipe])
) as Record<SoundFamily, FamilyRecipe>;

export const PRESETS: Record<SoundFamily, Record<SoundInstance, InstancePreset>> = Object.fromEntries(
  ALL_FAMILIES.map((family) => [family.name, family.presets])
) as Record<SoundFamily, Record<SoundInstance, InstancePreset>>;
