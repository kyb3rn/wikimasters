import { defineSettings } from '@/core/settings';

export const settings = defineSettings('player-search', {
  whileTyping: {
    type: 'boolean',
    label: 'Rechercher pendant la frappe',
    description: 'Sinon, la recherche part avec Entrée ou son bouton.',
    default: true,
    primary: true,
  },
});
