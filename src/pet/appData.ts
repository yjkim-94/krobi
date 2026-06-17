import type { SpeciesDef } from "./types";
import { migrate as migratePetData, type PetData } from "./petState";

export type SpeciesInstance = PetData;

export type SpeciesProgress = {
  /** Forms ever reached for this species. Permanent — reset never removes entries. */
  unlockedForms: string[];
  /** The one active growth run for this species. */
  instance: SpeciesInstance;
};

export type SlotState = {
  speciesId: string;
  /** Cosmetic only — what form to render. Must be in pets[speciesId].unlockedForms. */
  displayForm: string;
};

export type AppData = {
  /** Keyed by speciesId. A species with no entry has never been acquired. */
  pets: Record<string, SpeciesProgress>;
  /** Pets currently shown in the window. Order = display order. */
  slots: SlotState[];
};

const STARTER_SPECIES = "krombi";

/** Walks species.json's `from` pointers from `form` back to stage1, inclusive, in order. */
export function unlockChain(species: SpeciesDef, form: string): string[] {
  const chain: string[] = [];
  let current: string | undefined = form;
  while (current) {
    chain.unshift(current);
    current = species.forms[current]?.from;
  }
  return chain;
}

function isAppData(raw: unknown): raw is AppData {
  return !!raw && typeof raw === "object" && "pets" in raw && "slots" in raw;
}

/**
 * Migrates legacy single-pet saves (`{ pet: PetData }`, implicitly krombi) and
 * fresh installs (no saved data) into the multi-species shape. Already-migrated
 * data is returned unchanged.
 */
export function migrateAppData(raw: unknown, krombiSpecies: SpeciesDef): AppData {
  if (isAppData(raw)) return raw;
  const r = (raw ?? {}) as Record<string, unknown>;
  const oldPet = migratePetData(r.pet);
  return {
    pets: {
      [STARTER_SPECIES]: { unlockedForms: unlockChain(krombiSpecies, oldPet.form), instance: oldPet },
    },
    slots: [{ speciesId: STARTER_SPECIES, displayForm: oldPet.form }],
  };
}
