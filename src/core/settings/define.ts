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
  function stored(): Readonly<Record<string, unknown>> {
    return readSettings().values[namespace] ?? {};
  }

  function write(key: string, value: unknown): void {
    updateSettings((current) => {
      const entries: Record<string, unknown> = { ...(current.values[namespace] ?? {}) };
      if (value === undefined) delete entries[key];
      else entries[key] = value;
      return { ...current, values: { ...current.values, [namespace]: entries } };
    });
  }

  return {
    namespace,
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
    reset(key) {
      write(key, undefined);
    },
  };
}

/** Valeur utilisable : du bon type, bornée ; sinon la valeur par défaut. */
export function validate(definition: SettingDefinition, value: unknown): boolean | number {
  if (definition.type === 'boolean') return typeof value === 'boolean' ? value : definition.default;
  if (definition.type === 'choice') {
    return definition.options.some((option) => option.value === value) ? (value as number) : definition.default;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return definition.default;
  return Math.min(definition.max, Math.max(definition.min, value));
}
