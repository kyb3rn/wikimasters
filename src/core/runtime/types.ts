import type { Logger } from '@/core/log';
import type { Settings } from '@/core/settings';

export interface FeatureContext {
  /** Journal préfixé `[WM <id>]`. */
  readonly log: Logger;
  /** Interrompu au démontage : à passer à chaque écouteur, observateur, minuterie. */
  readonly signal: AbortSignal;
  /** Toutes les fonctionnalités et leur état (sert à la fenêtre de paramètres). */
  readonly catalog: FeatureCatalog;
  /** Action à faire au démontage (retirer un élément, rétablir un style…). */
  onDispose(action: () => void): void;
  /**
   * Attend `<body>` (le montage commence à `document-start`) ; faux si la fonctionnalité a été démontée
   * entre-temps : `if (!(await ctx.ready())) return;`
   */
  ready(): Promise<boolean>;
  /**
   * Feuille de style de la fonctionnalité (`<style id="wm-style-<id>[-<name>]">`), retirée au démontage. Posée tout
   * de suite, ou dès `<body>` si `<head>` n'existe pas encore. Un nouvel appel du même nom remplace son contenu.
   */
  style(css: string, name?: string): void;
  /** Masque un élément pour cette fonctionnalité, ou le rend (`hidden` faux) : `setHidden`. Tous rendus au démontage. */
  hide(element: Element, hidden?: boolean): void;
}

export interface Feature {
  /** Identifiant stable en kebab-case : clé des réglages et préfixe des journaux. */
  readonly id: string;
  /**
   * Nom du concept (« Défaussage rapide ») : titre de sa section dans les paramètres, console, journaux.
   * Dans une même catégorie, les fonctionnalités de même nom partagent une section.
   */
  readonly name: string;
  /** Ce que fait la fonctionnalité, en une phrase simple (pas où se trouve le bouton). */
  readonly description: string;
  /** Libellé de l'interrupteur, sous le titre (« Afficher le bouton ») ; par défaut le nom. */
  readonly toggleLabel?: string;
  /** Catégorie de la fenêtre de paramètres (« Paquets », « Marché »…). */
  readonly category: string;
  /**
   * Pages où la fonctionnalité tourne : motifs de `matchRoute`, ou `'all'`.
   * Un changement de paramètres (autre annonce, autre profil) la démonte puis la remonte.
   */
  readonly routes: 'all' | readonly string[];
  /** Toujours active, sans interrupteur (la fenêtre de paramètres elle-même). */
  readonly required?: boolean;
  /** Absente de la fenêtre de paramètres. */
  readonly hidden?: boolean;
  /** Réglages affichés dans la fenêtre de paramètres, sous le nom de la fonctionnalité. */
  readonly settings?: Settings;
  /**
   * Démarre la fonctionnalité. Au chargement d'une page, appelé dès `document-start` :
   * le DOM n'existe pas encore, l'attendre si besoin (`ctx.ready()`). Tout ce qui est posé doit être
   * lié à `ctx.signal` ou à `ctx.onDispose`.
   */
  mount(ctx: FeatureContext): void | Promise<void>;
}

/**
 * - `off` : désactivée par l'utilisateur ;
 * - `idle` : active, mais pas sur cette page ;
 * - `mounted` : tourne ;
 * - `failed` : son démarrage a échoué sur cette page (nouvel essai à la prochaine page).
 */
export type FeatureState = 'off' | 'idle' | 'mounted' | 'failed';

export interface FeatureStatus {
  readonly id: string;
  readonly name: string;
  readonly state: FeatureState;
  readonly error?: string;
}

export interface FeatureEntry {
  readonly feature: Feature;
  readonly enabled: boolean;
  readonly state: FeatureState;
  readonly error?: string;
}

export interface FeatureCatalog {
  list(): readonly FeatureEntry[];
  /** Sans effet sur une fonctionnalité obligatoire. */
  setEnabled(id: string, enabled: boolean): void;
  /** Prévenu quand une fonctionnalité change d'état (activée, montée, en échec…). */
  onChange(listener: () => void, options?: { signal?: AbortSignal }): void;
}
