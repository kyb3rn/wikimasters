import type { FeatureContext } from '@/core/runtime';
import type { SelectionMode } from '@/site/selection';
import { topSiteModal } from '@/site/modals';
import { isModalOpen } from '@/ui/modal';
import { createCtrlTap } from './tap';

/** Un appui sur Ctrl, seul, entre dans le mode sélection de la page ou en sort (`findMode` : son mode). */
export function toggleSelectionWithCtrl(ctx: FeatureContext, findMode: () => SelectionMode | undefined): void {
  const { signal, log } = ctx;
  const tap = createCtrlTap();
  const cancel = () => tap.cancel();

  window.addEventListener('keydown', (event) => tap.keydown(event, performance.now()), { capture: true, signal });
  window.addEventListener(
    'keyup',
    (event) => {
      if (!tap.keyup(event, performance.now())) return;
      // Une modale ouverte (carte, étiquetage de la sélection…) : quitter la sélection la viderait dessous.
      if (isModalOpen() || topSiteModal()) return;
      const mode = findMode();
      if (!mode || (mode.disabled && !mode.active)) return;
      log.debug(mode.active ? 'sélection quittée (Ctrl)' : 'sélection activée (Ctrl)');
      mode.toggle();
    },
    { capture: true, signal },
  );
  for (const type of ['pointerdown', 'wheel'] as const) window.addEventListener(type, cancel, { capture: true, passive: true, signal });
  window.addEventListener('blur', cancel, { signal });
}
