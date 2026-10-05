import type { DataSet } from '@/core/data';
import type { FeatureCatalog } from '@/core/runtime';
import type { IconName } from '@/ui/icons';
import { settingsData } from './settings-data';

/** Premier onglet : ce que chaque donnée contient, l'export et l'import. */
export const OVERVIEW = "Vue d'ensemble";

/**
 * Onglets, un par type de donnée (choix de l'utilisateur), dans leur ordre, chacun avec son icône. Un onglet inconnu
 * passe à la fin, sans icône.
 */
export const MEMORY_TABS: Readonly<Record<string, IconName>> = {
  [OVERVIEW]: 'database',
  'Historique du marché': 'market',
  'Historique des mises en vente': 'gavel',
  // Version de dev seulement.
  ...(__DEV__ ? { 'Prix souhaités': 'coins' as const } : {}),
  Réglages: 'settings',
  Notifications: 'bell',
  'Filtres retenus': 'funnel',
  ...(__DEV__ ? { Technique: 'bug' as const } : {}),
};

/** Toutes les données gardées : les réglages, puis celles que déclarent les fonctionnalités, actives ou non. */
export function memorySets(catalog: FeatureCatalog): DataSet[] {
  return [settingsData(catalog), ...catalog.list().flatMap((entry) => entry.feature.data ?? [])];
}

/** Onglets des données présentes, « Vue d'ensemble » en tête. */
export function memoryTabs(sets: readonly DataSet[]): string[] {
  const present = new Set(sets.map((set) => set.tab));
  const known = Object.keys(MEMORY_TABS).filter((tab) => tab !== OVERVIEW && present.has(tab));
  const others = [...present].filter((tab) => !Object.hasOwn(MEMORY_TABS, tab));
  return [OVERVIEW, ...known, ...others];
}
