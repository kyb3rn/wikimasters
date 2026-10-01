import { blockSounds } from '@/core/audio';
import { childController } from '@/core/async';
import type { Feature } from '@/core/runtime';
import { onSettingsChange } from '@/core/settings';
import { pullsSoundSettings } from '@/services/pulls-sound';
import { enableSiteSound, isSiteSoundOff } from '@/site/sound';

/**
 * Le site ne relit son réglage qu'au chargement : on le laisse toujours actif et on coupe nous-mêmes,
 * pour que le changement soit immédiat. Un « off » trouvé au chargement vient du réglage du site
 * (on ne l'y met jamais) : il devient le nôtre.
 */
export const pullsSound: Feature = {
  id: 'pulls-sound',
  name: 'Son',
  description: "À l'ouverture d'un paquet, puis à chaque carte tournée dans le carrousel (pas en grille).",
  category: 'Paquets',
  routes: 'all',
  required: true,
  settings: pullsSoundSettings,
  mount(ctx) {
    if (isSiteSoundOff()) pullsSoundSettings.set('enabled', false);
    enableSiteSound();
    let muted: AbortController | undefined;
    const apply = () => {
      const off = !pullsSoundSettings.get('enabled');
      if (off && !muted) {
        muted = childController(ctx.signal);
        blockSounds(() => true, { signal: muted.signal });
      } else if (!off && muted) {
        muted.abort();
        muted = undefined;
      }
    };
    apply();
    onSettingsChange(apply, { signal: ctx.signal });
  },
};
