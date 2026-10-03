import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';

/** « Échanger » vert en contour, comme sur la page Amis ; roue pendant le chargement de la fenêtre. */
export function TradeButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      class={buttonClass('standard', { tone: 'accent', size: 'sm' })}
      disabled={busy}
      aria-busy={busy}
      onClick={onClick}
    >
      <Icon name="handshake" busy={busy} size={14} />
      Échanger
    </button>
  );
}
