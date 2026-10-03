import { isPlainClick } from '@/core/dom';
import { navigateTo } from '@/site/router';
import { RESALE_ROUTE } from '@/site/routes';
import { cx } from '@/ui/cx';
import { Icon } from '@/ui/icons';
import { siteClass } from '@/ui/site';

/**
 * Lien du menu latéral, à l'allure des siens, et le trait qui le sépare de la suite. Navigation du site sans
 * recharger ; Ctrl, Maj, clic du milieu laissés au navigateur.
 */
export function ResaleLink({ active }: { readonly active: boolean }) {
  return (
    <>
      <a
        href={RESALE_ROUTE}
        class={cx(siteClass.navLink, active ? siteClass.navLinkActive : siteClass.navLinkIdle)}
        onClick={(event) => {
          if (!isPlainClick(event)) return;
          event.preventDefault();
          navigateTo(RESALE_ROUTE);
        }}
      >
        <span class={siteClass.navLinkIconBox}>
          <Icon name="coins" size={24} class={siteClass.navLinkIcon} />
        </span>
        Revente
        {active && <div class={siteClass.navLinkDot} />}
      </a>
      <div class={siteClass.navSeparator} />
    </>
  );
}
