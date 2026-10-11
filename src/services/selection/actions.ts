import { later } from '@/core/async';
import { net, type Matcher } from '@/core/net';
import { textOf } from '@/core/text';
import { hasIcon } from '@/site/dom';
import type { SelectionBar } from '@/site/selection';
import type { IconName } from '@/ui/icons';
import type { SelectionAction } from './views';

/** Icônes lucide des boutons de la barre du site, et les nôtres. */
const SITE_ICONS: readonly (readonly [IconName, ...string[]])[] = [
  ['tag', 'tag'],
  ['star', 'star'],
  ['star-off', 'star-off'],
  ['bookmark-plus', 'bookmark-plus'],
  ['bookmark-minus', 'bookmark-minus'],
  ['bookmark', 'bookmark'],
  ['trash', 'trash-2', 'trash2'],
];

function siteIcon(button: HTMLButtonElement): IconName | undefined {
  return SITE_ICONS.find(([, ...names]) => hasIcon(button, ...names))?.[0];
}

/** « Tout sélectionner (page) » / « Désélectionner la page » du site, en un bouton de largeur stable. */
export function selectPageAction(bar: SelectionBar): SelectionAction | undefined {
  const button = bar.selectPage;
  return (
    button && {
      key: 'select-page',
      icon: 'select',
      label: 'Sélectionner toute la page',
      alternate: { icon: 'square', label: 'Désélectionner la page', shown: bar.pageSelected },
      disabled: button.disabled,
      onClick: () => clickSite(button),
    }
  );
}

/** Un bouton de la barre du site tel quel : son icône (s'il en a une connue), son texte, son état. */
export function siteAction(button: HTMLButtonElement, key: string, overrides: Partial<SelectionAction> = {}): SelectionAction {
  return { key, icon: siteIcon(button), label: textOf(button), disabled: button.disabled, onClick: () => clickSite(button), ...overrides };
}

function clickSite(button: HTMLButtonElement): void {
  if (button.isConnected && !button.disabled) button.click();
}

/** Le site traite la réponse un peu après la fin de la requête : la roue tient jusque-là (pas de bouton actif entre deux). */
const SETTLE_MS = 300;
/** Délai pour que la requête d'un clic parte (le client Supabase du site lit d'abord sa session). */
const START_MS = 2000;

export interface PressedRequests {
  /** Clic sur un bouton de la barre : la prochaine requête reconnue est la sienne. */
  press(key: string): void;
  /** Roue sur ce bouton : sa requête n'est pas finie (ou pas encore partie). */
  busy(key: string): boolean;
}

/**
 * Boutons de la barre qui lancent une requête du site (liste de souhaits, favoris) : roue et bouton désactivé de
 * notre clic à la fin de la requête qu'il déclenche (`match`, requêtes du site). Le site, lui, désactive tous ces
 * boutons sans dire lequel tourne.
 */
export function trackPressedRequests({ match, signal, onChange }: { readonly match: Matcher; readonly signal: AbortSignal; readonly onChange: () => void }): PressedRequests {
  let pressed: { readonly key: string; readonly at: number } | undefined;
  const running = new Map<string, number>();
  const waiting = () => pressed !== undefined && performance.now() - pressed.at <= START_MS;

  net.track(
    (request) => !request.own && match(request),
    () => {
      if (!pressed || !waiting()) return undefined;
      const { key } = pressed;
      pressed = undefined;
      running.set(key, (running.get(key) ?? 0) + 1);
      onChange();
      return () =>
        later(
          () => {
            const left = (running.get(key) ?? 1) - 1;
            if (left > 0) running.set(key, left);
            else running.delete(key);
            onChange();
          },
          SETTLE_MS,
          signal,
        );
    },
    { signal },
  );

  return {
    press(key) {
      pressed = { key, at: performance.now() };
      onChange();
      // Aucune requête partie (le site a refusé sans rien envoyer) : la roue s'arrête.
      later(onChange, START_MS + 50, signal);
    },
    busy: (key) => running.has(key) || (waiting() && pressed?.key === key),
  };
}
