import { describe, expect, it } from 'vitest';
import { withLeaving, withoutToast, type ShownToast } from '@/ui/toast/leaving';
import type { Toast } from '@/ui/toast/store';

const toast = (id: number): Toast => ({ id, message: `t${id}`, variant: 'info', position: 'bottom-right' });
const ids = (shown: readonly ShownToast[]) => shown.map((item) => `${item.toast.id}${item.leaving ? ' (sortie)' : ''}`);

describe('toasts affichés pendant une sortie', () => {
  it('garde un toast retiré de la file à sa place, en sortie, et ajoute les nouveaux au bout', () => {
    let shown = withLeaving([], [toast(1), toast(2), toast(3)], true);
    shown = withLeaving(shown, [toast(1), toast(3), toast(4)], true);
    expect(ids(shown)).toEqual(['1', '2 (sortie)', '3', '4']);
    // Toujours en sortie au changement suivant, jusqu'à la fin de son animation.
    shown = withLeaving(shown, [toast(3), toast(4)], true);
    expect(ids(shown)).toEqual(['1 (sortie)', '2 (sortie)', '3', '4']);
    expect(ids(withoutToast(shown, 2))).toEqual(['1 (sortie)', '3', '4']);
  });

  it('sans animation, un toast retiré disparaît aussitôt', () => {
    const shown = withLeaving([], [toast(1), toast(2)], false);
    expect(ids(withLeaving(shown, [toast(2)], false))).toEqual(['2']);
  });

  it('la fin de sortie ne retire pas un toast encore dans la file', () => {
    const shown = withLeaving([], [toast(1)], true);
    expect(ids(withoutToast(shown, 1))).toEqual(['1']);
  });
});
