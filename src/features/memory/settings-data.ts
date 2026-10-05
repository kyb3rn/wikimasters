import { jsonSize, type DataItem, type DataSet } from '@/core/data';
import type { Feature, FeatureCatalog } from '@/core/runtime';
import { importSettings, readSettings, SETTINGS_KEY, type SettingDefinition, type Settings } from '@/core/settings';

/** Nom d'une fonctionnalité, avec son interrupteur quand elle en a un à elle (« Revente : Afficher la page Revente »). */
const featureLabel = (feature: Feature) => (feature.toggleLabel ? `${feature.name} : ${feature.toggleLabel}` : feature.name);

function valueText(definition: SettingDefinition | undefined, value: unknown): string {
  if (!definition) return JSON.stringify(value) ?? String(value);
  if (definition.type === 'boolean') return value === true ? 'Oui' : 'Non';
  if (definition.type === 'choice') return definition.options.find((option) => option.value === value)?.label ?? String(value);
  return `${String(value)}${definition.unit ? ` ${definition.unit}` : ''}`;
}

/** Réglages en clair : un élément par fonctionnalité allumée ou éteinte à la main, et par valeur changée. */
export function settingsItems(features: readonly Feature[]): DataItem[] {
  const stored = readSettings();
  const owners = new Map<string, { readonly feature: Feature; readonly settings: Settings }>();
  for (const feature of features) {
    if (feature.settings && !owners.has(feature.settings.namespace)) owners.set(feature.settings.namespace, { feature, settings: feature.settings });
  }
  const choices = Object.entries(stored.features).map(([id, enabled]): DataItem => {
    const feature = features.find((candidate) => candidate.id === id);
    const date = stored.changedAt.features[id];
    return {
      key: `feature:${id}`,
      title: feature ? featureLabel(feature) : id,
      details: [enabled ? 'Allumée' : 'Éteinte'],
      ...(date !== undefined && { date }),
      bytes: jsonSize({ [id]: enabled }),
    };
  });
  const values = Object.entries(stored.values).flatMap(([namespace, entries]) =>
    Object.entries(entries).map(([key, value]): DataItem => {
      const owner = owners.get(namespace);
      const definition = owner?.settings.schema[key];
      const date = stored.changedAt.values[namespace]?.[key];
      return {
        key: `value:${namespace}.${key}`,
        title: owner && definition ? `${owner.feature.name} : ${definition.label}` : `${namespace}.${key}`,
        details: [valueText(definition, value)],
        ...(date !== undefined && { date }),
        bytes: jsonSize({ [key]: value }),
      };
    }),
  );
  return [...choices, ...values];
}

/**
 * Les réglages, dans la fenêtre Mémoire : listés et exportés, jamais supprimés d'ici (demande de l'utilisateur : pas
 * de retour « comme à l'installation »). Noms lus dans les fonctionnalités du catalogue.
 */
export function settingsData(catalog: FeatureCatalog): DataSet {
  return {
    id: 'settings',
    name: 'Réglages',
    tab: 'Réglages',
    description: 'Ce que la fenêtre Paramètres enregistre : fonctionnalités allumées ou éteintes, valeurs changées.',
    storage: [SETTINGS_KEY],
    list: () => Promise.resolve(settingsItems(catalog.list().map((entry) => entry.feature))),
    transfer: {
      dump: () => Promise.resolve(readSettings()),
      merge: (raw, apply) => Promise.resolve(importSettings(raw, apply)),
    },
  };
}
