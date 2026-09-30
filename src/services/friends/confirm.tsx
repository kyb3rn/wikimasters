import { openConfirm } from '@/ui/modal';

/** Confirmation du retrait d'un ami, la même partout (liste des amis, profil du joueur). */
export function confirmUnfriend(username: string, onConfirm: () => Promise<unknown> | void, signal: AbortSignal): void {
  openConfirm({
    title: 'Retirer cet ami ?',
    message: (
      <>
        <strong>{username}</strong> ne fera plus partie de vos amis.
      </>
    ),
    confirmLabel: 'Retirer',
    onConfirm,
    signal,
  });
}
