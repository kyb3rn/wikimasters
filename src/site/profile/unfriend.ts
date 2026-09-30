/**
 * « Retirer des amis » du profil d'un ami (code du site du 30/09/2026) : petit bouton `title="Retirer des amis"`
 * (lucide `user-minus`, texte « … » et désactivé pendant le retrait) en haut à droite de l'en-tête, à côté de
 * « Signaler ». Au clic, `window.confirm("Retirer <pseudo> de votre liste d'amis ?")`, puis
 * `DELETE /api/friends/<id>` (refus ignoré), relecture du profil : 403 (profil privé) → /friends.
 */
export function findUnfriendButton(doc: Document = document): HTMLButtonElement | undefined {
  return doc.querySelector<HTMLButtonElement>('main button[title="Retirer des amis"]:not(.wm-root *)') ?? undefined;
}

const QUESTION = /^Retirer (.+) de votre liste d'amis \?$/s;

/** Pseudo de la question de confirmation du site, si c'est elle. */
export function parseUnfriendConfirm(message: unknown): string | undefined {
  return typeof message === 'string' ? QUESTION.exec(message)?.[1] : undefined;
}
