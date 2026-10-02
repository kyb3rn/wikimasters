import { useEffect, useState } from 'preact/hooks';
import { onSalesRateChange, SALES_PER_MINUTE, salesRate } from '@/services/market';
import { onServerSecond, preciseServerNow } from '@/site/clock';
import { alpha, layers, palette, tokens } from '@/ui/theme';
import { TOAST_BOTTOM_VAR } from '@/ui/toast';
import { rateLevel, secondsLeft, type RateLevel } from './level';

export const GAUGE = 'wm-sales-limit';

const EDGE = 16;
/** Hauteur fixe (deux lignes de 16 px, la barre, les écarts, la marge, le bord) : les toasts du bas se posent dessus. */
const HEIGHT = 70;
/** Écart entre deux toasts de la pile, repris au-dessus de l'encart. */
const TOAST_GAP = 10;

const COLORS: Record<RateLevel, { readonly text: string; readonly bar: string }> = {
  ok: { text: palette.emerald[400], bar: palette.emerald[500] },
  warn: { text: palette.amber[400], bar: palette.amber[500] },
  danger: { text: palette.red[400], bar: palette.red[500] },
};

// Bas à droite, dans le contenu de la page (pas sur la barre latérale du site, demande de l'utilisateur). Encart
// d'information seulement : il laisse passer les clics vers les annonces dessous.
export const gaugeCss = () => `
body:has(> .${GAUGE}) { ${TOAST_BOTTOM_VAR}: ${EDGE + HEIGHT + TOAST_GAP}px; }
.${GAUGE} { position: fixed; right: ${EDGE}px; bottom: ${EDGE}px; z-index: ${layers.widget}; pointer-events: none; }
.${GAUGE}-box { width: 200px; height: ${HEIGHT}px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px;
  font-size: 12px; line-height: 16px;
  background: ${tokens.surface}; border: 1px solid ${tokens.border}; border-radius: 12px; box-shadow: 0 12px 32px -8px rgb(0 0 0 / 60%); }
${(Object.keys(COLORS) as RateLevel[])
  .map((level) => `.${GAUGE}-box[data-level="${level}"] { --wm-gauge-text: ${COLORS[level].text}; --wm-gauge-bar: ${COLORS[level].bar}; }`)
  .join('\n')}
.${GAUGE}-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.${GAUGE}-label { color: ${alpha(tokens.foreground, 60)}; }
.${GAUGE}-count { font-weight: 600; font-variant-numeric: tabular-nums; color: var(--wm-gauge-text); }
.${GAUGE}-track { height: 4px; border-radius: 999px; background: ${alpha(tokens.foreground, 10)}; overflow: hidden; }
.${GAUGE}-fill { height: 100%; border-radius: inherit; background: var(--wm-gauge-bar); transition: width 0.2s ease-out; }
.${GAUGE}-reset { color: ${alpha(tokens.foreground, 50)}; font-variant-numeric: tabular-nums; }
`;

/** Redessine à chaque seconde du serveur et à chaque requête de ventes de cet onglet. */
function useTick(): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const tick = () => setTick((value) => value + 1);
    onServerSecond(tick, { signal: controller.signal });
    onSalesRateChange(tick, { signal: controller.signal });
    return () => controller.abort();
  }, []);
}

/** Historiques chargés dans la minute du serveur, sur les 30 que le site accepte, et temps avant la remise à zéro. */
export function SalesGauge() {
  useTick();
  const rate = salesRate();
  const count = rate.blocked ? SALES_PER_MINUTE : Math.min(rate.count, SALES_PER_MINUTE);
  const seconds = secondsLeft(rate, preciseServerNow());
  return (
    <div class={`${GAUGE}-box`} data-level={rateLevel(rate)}>
      <div class={`${GAUGE}-head`}>
        <span class={`${GAUGE}-label`}>Historiques</span>
        <span class={`${GAUGE}-count`}>{rate.blocked ? 'Bloqué' : `${count} / ${SALES_PER_MINUTE}`}</span>
      </div>
      <div class={`${GAUGE}-track`}>
        <div class={`${GAUGE}-fill`} style={{ width: `${(count / SALES_PER_MINUTE) * 100}%` }} />
      </div>
      <span class={`${GAUGE}-reset`}>{`${rate.blocked ? 'Débloqué' : 'Remis à zéro'} dans ${seconds} s`}</span>
    </div>
  );
}
