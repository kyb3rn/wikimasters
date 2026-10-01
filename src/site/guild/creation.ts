import type { NetRequest } from '@/core/net';
import { textOf } from '@/core/text';
import { SITE_OVERLAY } from '@/site/modals';

/*
 * /guild sans guilde (code du 30/09/2026) : dans la page, sous les onglets, la carte « Vous n'êtes dans aucune
 * guilde » (`card-frame p-8`, château lucide `size-14`, bouton « Créer une guilde »), remplacée par React, au clic,
 * par le formulaire « Créer une guilde » (`card-frame p-6 space-y-4`) : en-tête (`h2`, « Annuler » en texte), nom
 * (`input maxlength=30`), description (`textarea maxlength=200`), compteurs, erreur (`p` rouge, message de l'API),
 * bouton pleine largeur « Créer la guilde » (`POST /api/guilds`), désactivé si le nom a moins de 2 caractères ou
 * pendant la requête (« Création… »). Réussite : formulaire fermé, page de la guilde chargée. « Annuler » garde
 * les valeurs saisies pour la prochaine ouverture ; une requête en échec réseau ne montre rien.
 */

export interface GuildCreationForm {
  readonly root: HTMLElement;
  readonly nameInput: HTMLInputElement;
  readonly descriptionInput: HTMLTextAreaElement;
  readonly submitButton: HTMLButtonElement;
  readonly cancelButton: HTMLButtonElement;
  /** Message d'erreur du site, affiché dans le formulaire. */
  readonly error: string | undefined;
  /** Requête de création en cours. */
  readonly sending: boolean;
}

/**
 * Cadres de la page : pas ceux d'une modale (« Modifier la guilde »), ni une copie inerte posée par le script (la
 * carte « Vous n'êtes dans aucune guilde » gardée derrière sa fenêtre).
 */
const pageFrames = (doc: Document) =>
  [...doc.querySelectorAll<HTMLElement>('main div.card-frame')].filter((frame) => !frame.closest(`${SITE_OVERLAY}, [inert]`));

/** Carte « Vous n'êtes dans aucune guilde » et son bouton « Créer une guilde ». */
export function findNoGuildCard(doc: Document = document): { root: HTMLElement; createButton: HTMLButtonElement } | undefined {
  for (const root of pageFrames(doc)) {
    const createButton = root.querySelector<HTMLButtonElement>(':scope > button');
    if (createButton && root.querySelector(':scope > div svg.lucide-castle')) return { root, createButton };
  }
  return undefined;
}

/** Formulaire « Créer une guilde », quand il est ouvert. */
export function findGuildCreationForm(doc: Document = document): GuildCreationForm | undefined {
  for (const root of pageFrames(doc)) {
    const nameInput = root.querySelector<HTMLInputElement>('input[maxlength]');
    const descriptionInput = root.querySelector<HTMLTextAreaElement>('textarea');
    const cancelButton = root.querySelector<HTMLButtonElement>(':scope > div > h2 ~ button');
    const submitButton = root.querySelector<HTMLButtonElement>(':scope > button');
    if (!nameInput || !descriptionInput || !cancelButton || !submitButton) continue;
    const error = textOf(root.querySelector(':scope > p'));
    return {
      root,
      nameInput,
      descriptionInput,
      submitButton,
      cancelButton,
      error: error || undefined,
      // Le site ne désactive le bouton, nom assez long, que pendant la requête.
      sending: submitButton.disabled && nameInput.value.trim().length >= 2,
    };
  }
  return undefined;
}

/** Requête de création d'une guilde. */
export const isGuildCreation = (request: NetRequest): boolean => request.method === 'POST' && request.url.pathname === '/api/guilds';
