import type { NetRequest } from '@/core/net';

/**
 * Encart « Vérification rapide » sous le titre de `/pulls` (relevé le 29/09/2026). Le site l'affiche tant
 * que la dernière vérification a plus de 12 h (`pack_human_verified_at`) ou qu'une ouverture a répondu
 * `human_verification_required` ; « Ouvrir » reste désactivé jusque-là.
 *
 *   div.text-center.animate-fade-in-up          (titre de la page, animation « forwards » : garde un transform)
 *     h1 « Ouvrir un paquet »
 *     div.relative.mx-auto.max-w-lg…            (l'encart)
 *       label (hors écran) > input[name=website]  champ-piège pour robots, à laisser vide
 *       p « Vérification rapide » · p (explication)
 *       label > input[type=checkbox] + span « Je ne suis pas un robot »
 *       button « Continuer » (« Enregistrement... » pendant l'envoi, désactivé tant que la case est vide)
 *
 * Aucun contrôle côté page (pas d'`isTrusted`) : case et bouton envoient `POST /api/packs/verify-human`.
 * Son erreur ne s'affiche pas dans l'encart mais plus bas, sous le cadre des paquets.
 */
export function findHumanCheck(doc: Document = document): HTMLElement | undefined {
  for (const trap of doc.querySelectorAll('main input[name="website"]')) {
    const box = trap.closest('label')?.parentElement;
    if (box instanceof HTMLElement && box.querySelector('input[type="checkbox"]')) return box;
  }
  return undefined;
}

export function isHumanCheckRequest(request: NetRequest): boolean {
  return request.method === 'POST' && request.url.pathname === '/api/packs/verify-human';
}
