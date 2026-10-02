import { callbackHooks, currentFiberAncestors } from '@/core/react';
import { SITE_OVERLAY } from '@/site/modals';

/*
 * /guild sans guilde (code du 01/10/2026) : dans la page, sous les onglets, la carte « Vous n'êtes dans aucune
 * guilde » (`card-frame p-8`, château lucide `size-14`, bouton « Créer une guilde »), remplacée par React, au clic,
 * par son formulaire « Créer une guilde ». Après une création, le site relit sa guilde par le chargeur de la page
 * (`useCallback` : `GET /api/guilds`, puis guilde, adhésion, membres et, avec `{ seedHome: true }`, l'Accueil), qui
 * remplace la carte par la guilde.
 */

/** Carte « Vous n'êtes dans aucune guilde » et son bouton « Créer une guilde » (pas dans une modale du site). */
export function findNoGuildCard(doc: Document = document): { root: HTMLElement; createButton: HTMLButtonElement } | undefined {
  for (const root of doc.querySelectorAll<HTMLElement>('main div.card-frame')) {
    if (root.closest(SITE_OVERLAY)) continue;
    const createButton = root.querySelector<HTMLButtonElement>(':scope > button');
    if (createButton && root.querySelector(':scope > div svg.lucide-castle')) return { root, createButton };
  }
  return undefined;
}

/** Le chargeur de la guilde : il demande `/api/guilds` et connaît l'option `seedHome`. */
const isGuildLoader = (callback: (...args: unknown[]) => unknown): boolean => {
  const source = Function.prototype.toString.call(callback);
  return /["'`]\/api\/guilds["'`]/.test(source) && source.includes('seedHome');
};

/**
 * Relit la guilde comme le site après une création : son chargeur, pris dans l'état de la page au-dessus de `node`.
 * `false` s'il est introuvable.
 */
export function reloadSiteGuild(node: Node): boolean {
  for (const fiber of currentFiberAncestors(node)) {
    const loader = callbackHooks(fiber).find(isGuildLoader);
    if (!loader) continue;
    void Promise.resolve()
      .then(() => loader({ seedHome: true }))
      .catch(() => undefined);
    return true;
  }
  return false;
}
