import { readSettings, updateSettings } from './store';
import type { SettingDefinition, Settings, SettingsSchema, SettingValue } from './types';

/**
 * Déclare les réglages d'une fonctionnalité. Les valeurs sont relues à chaque `get` :
 * un changement fait dans la fenêtre de paramètres ou dans un autre onglet est pris en compte
 * au prochain usage, sans rien avoir à écouter.
 *
 *     export const settings = defineSettings('pulls-discard-next', {
 *       delayMs: { type: 'number', label: 'Délai', default: 600, min: 0, max: 3000, unit: 'ms' },
 *     });
 *     settings.get('delayMs'); // number
 */
export function defineSettings<S extends SettingsSchema>(namespace: string, schema: S): Settings<S> {
  for (const [key, definition] of Object.entries(schema)) {
    const parent = definition.enabledBy;
    if (parent !== undefined && schema[parent]?.type !== 'boolean') {
      throw new Error(`réglage ${namespace}.${key} : ${parent} n'est pas un réglage booléen du même module`);
    }
  }

  function stored(): Readonly<Record<string, unknown>> {
    return readSettings().values[namespace] ?? {};
  }

  function write(key: string, value: unknown): void {
    updateSettings((current) => ({
      ...current,
      values: { ...current.values, [namespace]: { ...current.values[namespace], [key]: value } },
    }));
  }

  return {
    schema,
    get(key) {
      const definition = schema[key];
      if (!definition) throw new Error(`réglage inconnu : ${namespace}.${key}`);
      return validate(definition, stored()[key]) as SettingValue<S[typeof key]>;
    },
    set(key, value) {
      const definition = schema[key];
      if (!definition) throw new Error(`réglage inconnu : ${namespace}.${key}`);
      write(key, validate(definition, value));
    },
  };
}

/** Valeur utilisable : du bon type, bornée ; sinon la valeur par défaut. */
function validate(definition: SettingDefinition, value: unknown): boolean | number {
  if (definition.type === 'boolean') return typeof value === 'boolean' ? value : definition.default;
  if (definition.type === 'choice') {
    return definition.options.some((option) => option.value === value) ? (value as number) : definition.default;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return definition.default;
  return Math.min(definition.max, Math.max(definition.min, value));
}
