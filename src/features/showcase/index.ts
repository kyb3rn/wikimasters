import { h } from 'preact';
import { watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { createSlot } from '@/ui/mount';
import { Showcase } from './Showcase';
import { css } from './style';

/**
 * Adresse que le site n'a pas : il y rend sa page 404 nue (ni en-tête ni solde), mais dans sa mise en page
 * commune, feuilles de style et thème chargés. La vitrine la recouvre.
 */
export const SHOWCASE_PATH = '/wm-ui';

export const showcase: Feature = {
  id: 'showcase',
  name: 'Vitrine',
  description: 'Tous les contrôles du script, dans tous leurs états, sur une page à part.',
  category: 'Développement',
  routes: [SHOWCASE_PATH],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    if (!(await ctx.ready())) return;
    ctx.style(css());
    // Posée dès <body> : React la retire quand il y affiche la page (hydratation), elle est alors reposée.
    const slot = createSlot(signal);
    watchDom(() => {
      if (slot.ui?.element.parentElement !== document.body) {
        slot.render(h(Showcase, { signal }), { parent: document.body, className: 'wm-showcase' });
      }
    }, { signal });
  },
};
