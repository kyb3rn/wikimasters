import type { RealtimeLink } from '@/site/realtime';
import { buttonClass, type ButtonTone } from '@/ui/button';
import { Icon } from '@/ui/icons';

const TONES: Readonly<Record<RealtimeLink, ButtonTone>> = { live: 'accent', connecting: 'neutral', down: 'danger' };

const HINTS: Readonly<Record<RealtimeLink, string>> = {
  live: 'En direct : les nouvelles mises s’affichent dès qu’elles sont placées',
  connecting: 'Connexion au direct…',
  down: 'Direct coupé : les nouvelles mises ne s’affichent plus. Cliquer pour reconnecter',
};

export interface LiveButtonProps {
  readonly link: RealtimeLink;
  readonly onReconnect: () => void;
}

/** Carré à côté de « Vue du marché » : vert et inactif en direct, roue pendant la connexion, rouge et cliquable coupé. */
export function LiveButton({ link, onReconnect }: LiveButtonProps) {
  const connecting = link === 'connecting';
  return (
    <button
      type="button"
      class={buttonClass('square', { tone: TONES[link] })}
      aria-label="Mises en direct"
      title={HINTS[link]}
      disabled={link !== 'down'}
      aria-busy={connecting}
      data-wm-link={link}
      onClick={onReconnect}
    >
      <Icon name={link === 'live' ? 'wifi' : 'wifi-off'} busy={connecting} size={18} />
    </button>
  );
}
