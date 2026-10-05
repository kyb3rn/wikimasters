import { formatNumber } from '@/services/market';
import { siteClass } from '@/ui/site';

/** Texte foncé du badge de rareté du site, sur sa couleur. */
const BADGE_TEXT = '#0d1117';

/** « +35 » dans le coin haut droit de la face, pendant du badge de rareté (couleur de la bonne affaire, même halo). */
export function GainBadge({ gain, color }: { readonly gain: number; readonly color: string }) {
  return (
    <span class={siteClass.faceBadgeEnd} style={{ backgroundColor: color, color: BADGE_TEXT, boxShadow: `0 0 10px ${color}99` }}>
      +{formatNumber(gain)}
    </span>
  );
}
