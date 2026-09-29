import { defineSettings } from '@/core/settings';

/** Son des paquets (ouverture, cartes, légendaires) : réglé dans les paramètres ou depuis la page des paquets. */
export const pullsSoundSettings = defineSettings('pulls-sound', {
  enabled: {
    type: 'boolean',
    label: 'Jouer les sons des paquets',
    default: true,
    primary: true,
  },
});
