import { textOf } from '@/core/text';

const TITLE = 'Rechercher un joueur';

/**
 * Fenêtre « Rechercher un joueur » de la page Amis (code du site du 01/10/2026), rendue en fin de page (pas de
 * portail), ouverte par « Rechercher un joueur » de l'en-tête ou « Rechercher des joueurs » de la liste vide :
 *
 *   div.fixed.inset-0.z-50 (fond) › div.card-frame.w-full.max-w-md.p-6
 *     div.flex.items-center.justify-between.mb-5 › h2 « Rechercher un joueur », button[aria-label="Fermer"] (lucide `x`)
 *     input « Nom d'utilisateur... » (focus à l'ouverture) : recherche 350 ms après la dernière frappe, dès 2
 *       caractères sans les espaces du bout (`GET /api/friends/search?q=<texte tel quel>`)
 *     div.mt-4.h-[220px].overflow-y-auto.space-y-2 › roue pendant la recherche, ou p « Entrez au moins 2
 *       caractères… », p « Aucun joueur trouvé », ou lignes div.flex.items-center.gap-3.p-2.5.rounded-lg :
 *       photo, span pseudo, [button « Signaler <pseudo> » (lucide `flag`)], button « Ajouter » (`POST
 *       /api/friends`, « ... » pendant l'envoi) ou, désactivé, « Demande envoyée » / « Déjà amis » / « Demande reçue »
 *     [fenêtre « Signaler »]
 */
export interface PlayerSearch {
  /** Cadre de la fenêtre. */
  readonly frame: HTMLElement;
  readonly field: HTMLInputElement;
  /** Zone des résultats (roue, messages, lignes des joueurs). */
  readonly results: HTMLElement;
}

export function findPlayerSearch(doc: Document = document): PlayerSearch | undefined {
  const title = [...doc.querySelectorAll('main h2')].find((h2) => textOf(h2) === TITLE);
  const frame = title?.parentElement?.parentElement;
  const field = frame?.querySelector(':scope > input');
  const results = field?.nextElementSibling;
  if (!(frame instanceof HTMLElement) || !(field instanceof HTMLInputElement) || !(results instanceof HTMLElement)) return undefined;
  return { frame, field, results };
}
