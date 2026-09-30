import { h } from 'preact';
import { injectStyle, whenBody } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { mountUi } from '@/ui/mount';
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
  async mount({ signal }) {
    await whenBody();
    if (signal.aborted) return;
    injectStyle('showcase', css());
    mountUi(h(Showcase, { signal }), { signal, className: 'wm-showcase' });
  },
};
