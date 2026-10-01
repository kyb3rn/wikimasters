import { isPlainClick } from '@/core/dom';
import { navigateTo } from '@/site/router';
import { MARKETPLACE_ROUTE } from '@/site/routes';
import { Icon } from '@/ui/icons';
import { siteClass } from '@/ui/site';

/** Icône et lien de retour de « Profil introuvable » (cadenas, « ← Retour aux amis »), version enchère. */
export function NotFoundExtras() {
  return (
    <>
      <Icon name="gavel" size={48} class={`${siteClass.notFoundIcon} wm-not-found-icon`} />
      <a
        href={MARKETPLACE_ROUTE}
        class={siteClass.notFoundLink}
        onClick={(event) => {
          if (!isPlainClick(event)) return;
          event.preventDefault();
          navigateTo(MARKETPLACE_ROUTE);
        }}
      >
        ← Retour au marché
      </a>
    </>
  );
}
