import type { SpeciesDef } from "./types";
import { applyTick, canEvolve, applyEvolution, defaultPet } from "./petState";
import type { AppData } from "./appData";

export function applyTickAll(
  data: AppData,
  rates: { satietyRate: number; expGain: number },
): AppData {
  const activeIds = new Set(data.slots.map((s) => s.speciesId));
  const pets = { ...data.pets };
  for (const id of activeIds) {
    const progress = pets[id];
    if (!progress) continue;
    pets[id] = { ...progress, instance: applyTick(progress.instance, rates) };
  }
  return { ...data, pets };
}

export function evolveSpecies(data: AppData, speciesId: string, species: SpeciesDef): AppData {
  const progress = data.pets[speciesId];
  if (!progress) return data;
  if (!canEvolve(species, progress.instance.form, progress.instance.exp)) return data;
  const nextInstance = applyEvolution(species, progress.instance);
  if (nextInstance === progress.instance) return data;
  const unlockedForms = progress.unlockedForms.includes(nextInstance.form)
    ? progress.unlockedForms
    : [...progress.unlockedForms, nextInstance.form];
  return {
    ...data,
    pets: { ...data.pets, [speciesId]: { unlockedForms, instance: nextInstance } },
  };
}

export function resetSpecies(data: AppData, speciesId: string): AppData {
  const progress = data.pets[speciesId];
  if (!progress) return data;
  return {
    ...data,
    pets: { ...data.pets, [speciesId]: { ...progress, instance: defaultPet() } },
  };
}

export function acquireSpecies(data: AppData, speciesId: string): AppData {
  if (data.pets[speciesId]) return data;
  const instance = defaultPet();
  return {
    ...data,
    pets: { ...data.pets, [speciesId]: { unlockedForms: [instance.form], instance } },
  };
}

export function addSlot(data: AppData, speciesId: string): AppData {
  const progress = data.pets[speciesId];
  if (!progress) return data;
  if (data.slots.some((s) => s.speciesId === speciesId)) return data;
  return { ...data, slots: [...data.slots, { speciesId, displayForm: progress.instance.form }] };
}

export function hideSlot(data: AppData, speciesId: string): AppData {
  if (data.slots.length <= 1) return data;
  return { ...data, slots: data.slots.filter((s) => s.speciesId !== speciesId) };
}

export function setDisplayForm(data: AppData, speciesId: string, form: string): AppData {
  const progress = data.pets[speciesId];
  if (!progress || !progress.unlockedForms.includes(form)) return data;
  const idx = data.slots.findIndex((s) => s.speciesId === speciesId);
  if (idx === -1) return data;
  const slots = [...data.slots];
  slots[idx] = { ...slots[idx], displayForm: form };
  return { ...data, slots };
}
