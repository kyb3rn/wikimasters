import { useEffect, useState } from 'preact/hooks';
import { onServerSecond, serverNow } from '@/site/clock';
import { OWN_TIME } from '@/site/marketplace';
import { siteClass } from '@/ui/site';
import { formatPreciseRemaining, formatShortRemaining, remainingState } from './time';

/** Heure du serveur, remise à jour à chaque changement de seconde. */
function useServerSecond(): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const controller = new AbortController();
    onServerSecond(() => setNow(serverNow()), { signal: controller.signal });
    return () => controller.abort();
  }, []);
  return now;
}

const STATE_CLASS = { running: siteClass.tileTime, soon: siteClass.tileTimeSoon, ended: siteClass.tileTimeEnded } as const;

/**
 * Temps restant d'une annonce (carte standardisée du marché) : court (« 2h », « 15min », « 9s »), précis au survol de
 * la vignette (« 2:07:28 »), « Terminée » à zéro ; sur l'horloge du serveur.
 */
export function AuctionTime({ endAt }: { readonly endAt: number }) {
  const ms = endAt - useServerSecond();
  const state = remainingState(ms);
  return (
    <span class={`${STATE_CLASS[state]} ${OWN_TIME}`} data-state={state}>
      {state === 'ended' ? (
        formatShortRemaining(ms)
      ) : (
        <>
          <span class={`${OWN_TIME}-short`}>{formatShortRemaining(ms)}</span>
          <span class={`${OWN_TIME}-precise`}>{formatPreciseRemaining(ms)}</span>
        </>
      )}
    </span>
  );
}
