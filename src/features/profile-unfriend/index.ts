import { net, type NetRequest } from '@/core/net';
import type { Feature } from '@/core/runtime';
import { confirmUnfriend } from '@/services/friends';
import { isFriendshipDelete, watchSiteRefusal } from '@/site/api';
import { findUnfriendButton, parseUnfriendConfirm } from '@/site/profile';
import { PROFILE_ROUTE } from '@/site/routes';
import { toast } from '@/ui/toast';

const bySite = (request: NetRequest) => isFriendshipDelete(request) && !request.own;

/**
 * « Retirer des amis » (profil d'un ami) demande confirmation par `window.confirm` : le script lui répond
 * « non » et ouvre sa propre confirmation ; accepté, il reclique le bouton du site et répond « oui » à cette
 * seconde demande. Le site fait alors tout le reste lui-même (requête, relecture du profil, retour à /friends
 * si le profil devient privé).
 */
export const profileUnfriend: Feature = {
  id: 'profile-unfriend',
  name: 'Retirer un ami',
  description: 'Retirer un ami depuis son profil demande confirmation dans une fenêtre du site plutôt que celle du navigateur.',
  category: 'Profil',
  routes: [PROFILE_ROUTE],
  required: true,
  hidden: true,
  mount(ctx) {
    const { signal } = ctx;
    /** Retraits confirmés dont la requête du site est en cours → fin de notre fenêtre. */
    const waiting: (() => void)[] = [];
    let accept = false;

    net.track(
      bySite,
      () => {
        const done = waiting.splice(0);
        return () => done.forEach((resolve) => resolve());
      },
      { signal },
    );
    // Le site ne montre pas ses refus : rien ne changerait, sans explication.
    watchSiteRefusal(bySite, (message) => toast.error(message, { title: 'Amis' }), { signal });

    function confirmAgain(): Promise<void> {
      const button = findUnfriendButton();
      if (!button || button.disabled) return Promise.resolve();
      return new Promise((resolve) => {
        waiting.push(resolve);
        accept = true;
        // Le site demande confirmation, puis lance sa requête, pendant le clic même : sinon, rien à attendre.
        try {
          button.click();
        } finally {
          accept = false;
          const index = waiting.indexOf(resolve);
          if (index >= 0) {
            waiting.splice(index, 1);
            resolve();
          }
        }
      });
    }

    const original = window.confirm.bind(window);
    const replacement = (message?: string): boolean => {
      const username = parseUnfriendConfirm(message);
      if (username === undefined) return original(message);
      if (accept) {
        accept = false;
        return true;
      }
      confirmUnfriend(username, confirmAgain, signal);
      return false;
    };
    window.confirm = replacement;
    ctx.onDispose(() => {
      if (window.confirm === replacement) window.confirm = original;
    });
  },
};
