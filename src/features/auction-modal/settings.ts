import { defineSettings } from '@/core/settings';

export const settings = defineSettings('auction-modal-layout', {
  defaultDuration: {
    type: 'choice',
    label: 'Durée par défaut',
    description: "Durée sélectionnée à l'ouverture, quand aucune mise en vente n'est reprise.",
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
  showHistory: {
    type: 'boolean',
    label: "Afficher l'historique",
    description: 'Les trois dernières mises en vente de la carte, et toutes les autres sur demande.',
    default: true,
  },
  reuseLast: {
    type: 'boolean',
    label: 'Reprendre la dernière mise en vente',
    description: 'Mise et durée de la dernière mise en vente de la carte dans la même rareté.',
    default: true,
    enabledBy: 'showHistory',
  },
});
