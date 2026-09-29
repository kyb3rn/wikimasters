import { isRecord } from '@/core/guards';
import { jsonStore } from '@/core/storage';

/**
 * Tous les réglages du script sous une seule clé du localStorage (`wm-settings-v1`) :
 * activation des fonctionnalités et valeurs des réglages, par fonctionnalité. Une seule clé,
 * pour qu'un export / import futur soit une simple copie de cet objet.
 */
export interface StoredSettings {
  /** Choix explicites d'activation : `{ [id]: activée }`. Absent = valeur par défaut. */
  readonly features: Readonly<Record<string, boolean>>;
  /** Valeurs des réglages : `{ [fonctionnalité]: { [clé]: valeur } }`, validées à la lecture. */
  readonly values: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

export const SETTINGS_KEY = 'wm-settings-v1';
const EMPTY: StoredSettings = { features: {}, values: {} };

const store = jsonStore<StoredSettings>(SETTINGS_KEY, EMPTY, (raw) => {
  if (!isRecord(raw)) return undefined;
  const features: Record<string, boolean> = {};
  if (isRecord(raw.features)) {
    for (const [id, value] of Object.entries(raw.features)) if (typeof value === 'boolean') features[id] = value;
  }
  const values: Record<string, Record<string, unknown>> = {};
  if (isRecord(raw.values)) {
    for (const [namespace, entries] of Object.entries(raw.values)) if (isRecord(entries)) values[namespace] = { ...entries };
  }
  return { features, values };
});

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      // Un écouteur défaillant n'empêche pas les autres d'être prévenus.
    }
  }
}

export function readSettings(): StoredSettings {
  return store.get();
}

export function updateSettings(change: (current: StoredSettings) => StoredSettings): void {
  store.update(change);
  notify();
}

/** Prévenu de tout changement de réglage : dans cet onglet, ou dans un autre (voir `syncSettingsAcrossTabs`). */
export function onSettingsChange(listener: () => void, options?: { signal?: AbortSignal }): void {
  const signal = options?.signal;
  if (signal?.aborted) return;
  listeners.add(listener);
  signal?.addEventListener('abort', () => listeners.delete(listener), { once: true });
}

/** Un réglage changé dans un autre onglet est signalé ici aussi. */
export function syncSettingsAcrossTabs(win: Window): void {
  win.addEventListener('storage', (event) => {
    if (event.key === SETTINGS_KEY) notify();
  });
}

/** Choix d'activation explicite d'une fonctionnalité, ou `undefined` (valeur par défaut). */
export function featureChoice(id: string): boolean | undefined {
  return readSettings().features[id];
}

export function setFeatureChoice(id: string, enabled: boolean): void {
  updateSettings((current) => ({ ...current, features: { ...current.features, [id]: enabled } }));
}
