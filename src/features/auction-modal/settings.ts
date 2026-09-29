import { defineSettings } from '@/core/settings';

export const settings = defineSettings('auction-modal-layout', {
  defaultDuration: {
    type: 'choice',
    label: 'Durée par défaut',
    description: "Durée sélectionnée à l'ouverture.",
    primary: true,
    default: 10,
    // Les durées que propose le site.
    options: [
      { value: 10, label: '10 min' },
      { value: 30, label: '30 min' },
      { value: 60, label: '1 h' },
      { value: 180, label: '3 h' },
      { value: 360, label: '6 h' },
      { value: 720, label: '12 h' },
    ],
  },
});
