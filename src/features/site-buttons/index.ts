import { watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { normalizeText } from '@/core/text';
import { isOwn } from '@/site/dom';
import { isBalanceButton } from '@/site/header';
import { applyButtonClass } from '@/ui/button';
import { classify, type SiteButton } from './rules';

/** Texte propre au bouton : celui d'une pastille posée dessus (compteur de notifications, `absolute`) n'en est pas. */
function hasText(button: HTMLButtonElement): boolean {
  const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (normalizeText(node.textContent) === '') continue;
    const badge = node.parentElement?.closest('.absolute');
    if (!badge || badge === button || !button.contains(badge)) return true;
  }
  return false;
}

function read(button: HTMLButtonElement): SiteButton {
  const lucide = button.querySelector('svg[class*="lucide-"]');
  const icon = lucide && [...lucide.classList].find((name) => name.startsWith('lucide-'));
  return {
    classes: new Set([...button.classList].filter((name) => !name.startsWith('wm-'))),
    text: hasText(button),
    graphic: button.querySelector('svg, img') !== null,
    icon: icon ? icon.slice('lucide-'.length) : undefined,
    role: button.getAttribute('role'),
    popup: button.hasAttribute('aria-haspopup'),
    balance: isBalanceButton(button),
  };
}

export const siteButtons: Feature = {
  id: 'site-buttons',
  name: 'Boutons',
  description: 'Tous les boutons du site ont la même allure que ceux du script : formes, couleurs et tailles standard.',
  category: 'Général',
  routes: 'all',
  required: true,
  hidden: true,
  async mount(ctx) {
    if (!(await ctx.ready())) return;

    // Classes de chaque bouton à son dernier passage : React ne les réécrit que si les siennes changent (les
    // nôtres disparaissent alors), un bouton inchangé n'est pas relu.
    const seen = new WeakMap<HTMLButtonElement, string>();
    watchDom(
      () => {
        for (const button of document.querySelectorAll('button')) {
          if (seen.get(button) === button.className) continue;
          if (!isOwn(button)) {
            const restyle = classify(read(button));
            applyButtonClass(button, restyle?.shape, restyle?.style);
          }
          seen.set(button, button.className);
        }
      },
      { signal: ctx.signal },
    );
    ctx.onDispose(() => {
      for (const button of document.querySelectorAll('button.wm-button')) {
        if (!isOwn(button)) applyButtonClass(button, undefined);
      }
    });
  },
};
