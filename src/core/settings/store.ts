import { sameJson, tally, type ImportCounts, type MergeOutcome } from '@/core/data';
import { isRecord } from '@/core/guards';
import { createListeners } from '@/core/listeners';
import { createLogger } from '@/core/log';
import { jsonStore } from '@/core/storage';

/**
 * Tous les réglages du script sous une seule clé du localStorage (`wm-settings-v1`) :
 * activation des fonctionnalités et valeurs des réglages, par fonctionnalité, et la date de chaque changement
 * (fusion à l'import de la fenêtre Mémoire).
 */
export interface StoredSettings {
  /** Choix explicites d'activation : `{ [id]: activée }`. Absent = valeur par défaut. */
  readonly features: Readonly<Record<string, boolean>>;
  /** Valeurs des réglages : `{ [fonctionnalité]: { [clé]: valeur } }`, validées à la lecture. */
  readonly values: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  /**
   * Date (ms) du dernier changement de chaque choix et de chaque valeur : à l'import, le plus récent l'emporte,
   * réglage par réglage. Absente (réglage d'avant les dates) : le plus ancien possible.
   */
  readonly changedAt: {
    readonly features: Readonly<Record<string, number>>;
    readonly values: Readonly<Record<string, Readonly<Record<string, number>>>>;
  };
}

export const SETTINGS_KEY = 'wm-settings-v1';
const EMPTY: StoredSettings = { features: {}, values: {}, changedAt: { features: {}, values: {} } };

const isDate = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

function parseDates(raw: unknown): Record<string, number> {
  const dates: Record<string, number> = {};
  if (isRecord(raw)) for (const [key, value] of Object.entries(raw)) if (isDate(value)) dates[key] = value;
  return dates;
}

/** Réglages relus (stockage ou fichier d'export) ; les valeurs sont validées à l'usage, contre leur réglage. */
export function parseStoredSettings(raw: unknown): StoredSettings | undefined {
  if (!isRecord(raw)) return undefined;
  const features: Record<string, boolean> = {};
  if (isRecord(raw.features)) {
    for (const [id, value] of Object.entries(raw.features)) if (typeof value === 'boolean') features[id] = value;
  }
  const values: Record<string, Record<string, unknown>> = {};
  if (isRecord(raw.values)) {
    for (const [namespace, entries] of Object.entries(raw.values)) if (isRecord(entries)) values[namespace] = { ...entries };
  }
  const dates = isRecord(raw.changedAt) ? raw.changedAt : {};
  const valueDates: Record<string, Record<string, number>> = {};
  if (isRecord(dates.values)) {
    for (const [namespace, entries] of Object.entries(dates.values)) valueDates[namespace] = parseDates(entries);
  }
  return { features, values, changedAt: { features: parseDates(dates.features), values: valueDates } };
}

const store = jsonStore<StoredSettings>(SETTINGS_KEY, EMPTY, parseStoredSettings);

const listeners = createListeners(createLogger('réglages'), 'écouteur des réglages');

export function readSettings(): StoredSettings {
  return store.get();
}

export function updateSettings(change: (current: StoredSettings) => StoredSettings): void {
  store.update(change);
  listeners.emit();
}

/** Prévenu de tout changement de réglage : dans cet onglet, ou dans un autre (voir `syncSettingsAcrossTabs`). */
export function onSettingsChange(listener: () => void, options?: { signal?: AbortSignal }): void {
  listeners.on(listener, options);
}

/** Un réglage changé dans un autre onglet est signalé ici aussi. */
export function syncSettingsAcrossTabs(win: Window): void {
  win.addEventListener('storage', (event) => {
    if (event.key === SETTINGS_KEY) listeners.emit();
  });
}

/** Choix d'activation explicite d'une fonctionnalité, ou `undefined` (valeur par défaut). */
export function featureChoice(id: string): boolean | undefined {
  return readSettings().features[id];
}

export function setFeatureChoice(id: string, enabled: boolean): void {
  updateSettings((current) => ({
    ...current,
    features: { ...current.features, [id]: enabled },
    changedAt: { ...current.changedAt, features: { ...current.changedAt.features, [id]: Date.now() } },
  }));
}

/** Enregistre la valeur d'un réglage (déjà validée), datée. */
export function writeSettingValue(namespace: string, key: string, value: unknown): void {
  updateSettings((current) => ({
    ...current,
    values: { ...current.values, [namespace]: { ...current.values[namespace], [key]: value } },
    changedAt: {
      ...current.changedAt,
      values: { ...current.changedAt.values, [namespace]: { ...current.changedAt.values[namespace], [key]: Date.now() } },
    },
  }));
}

/** Valeur gardée à l'import : simple (booléen, nombre) ; `get` la valide ensuite contre son réglage. */
const isPlainValue = (value: unknown) => typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));

/**
 * Fusion des réglages d'un fichier avec ceux d'ici, choix par choix et valeur par valeur : absent ici, ajouté ;
 * présent des deux côtés, le plus récemment changé l'emporte (à égalité, celui d'ici).
 */
export function mergeSettings(
  local: StoredSettings,
  incoming: StoredSettings,
): { readonly result: StoredSettings; readonly outcomes: readonly MergeOutcome[] } {
  const outcomes: MergeOutcome[] = [];
  const features = { ...local.features };
  const featureDates = { ...local.changedAt.features };
  for (const [id, value] of Object.entries(incoming.features)) {
    const date = incoming.changedAt.features[id] ?? 0;
    const known = local.features[id];
    if (known !== undefined && date <= (featureDates[id] ?? 0)) {
      outcomes.push('unchanged');
      continue;
    }
    outcomes.push(known === undefined ? 'added' : known === value ? 'unchanged' : 'updated');
    features[id] = value;
    featureDates[id] = date;
  }
  const values: Record<string, Readonly<Record<string, unknown>>> = { ...local.values };
  const valueDates: Record<string, Readonly<Record<string, number>>> = { ...local.changedAt.values };
  for (const [namespace, entries] of Object.entries(incoming.values)) {
    for (const [key, value] of Object.entries(entries)) {
      if (!isPlainValue(value)) continue;
      const date = incoming.changedAt.values[namespace]?.[key] ?? 0;
      const known = local.values[namespace]?.[key];
      if (known !== undefined && date <= (valueDates[namespace]?.[key] ?? 0)) {
        outcomes.push('unchanged');
        continue;
      }
      outcomes.push(known === undefined ? 'added' : known === value ? 'unchanged' : 'updated');
      values[namespace] = { ...values[namespace], [key]: value };
      valueDates[namespace] = { ...valueDates[namespace], [key]: date };
    }
  }
  return { result: { features, values, changedAt: { features: featureDates, values: valueDates } }, outcomes };
}

/** Réglages d'un fichier d'export fusionnés avec ceux d'ici (`apply` faux : comptés seulement). */
export function importSettings(raw: unknown, apply: boolean): ImportCounts | undefined {
  const incoming = parseStoredSettings(raw);
  if (!incoming) return undefined;
  const local = readSettings();
  const { result, outcomes } = mergeSettings(local, incoming);
  if (apply && !sameJson(result, local)) updateSettings(() => result);
  return tally(outcomes, 0);
}
