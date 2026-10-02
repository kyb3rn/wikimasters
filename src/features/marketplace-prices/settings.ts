import { defineSettings } from '@/core/settings';

export const settings = defineSettings('marketplace-prices', {
  highlight: {
    type: 'boolean',
    label: 'Colorer les bonnes affaires',
    description:
      "Couleur selon l'intérêt de l'annonce : gain estimé à la revente, moins le temps qu'elle occupera un slot. Vert, puis bleu, puis rose. Cadre en tirets si l'estimation est peu sûre (peu de ventes récentes).",
    default: true,
  },
  gain: {
    type: 'boolean',
    label: 'Afficher le gain estimé',
    description: 'Sur la carte des bonnes affaires : revente estimée moins la mise actuelle (« +35 »).',
    default: true,
  },
  slotHour: {
    type: 'number',
    label: "Valeur d'une heure de slot",
    description:
      'Ce que rapporte un slot de vente en une heure. Plus elle est haute, plus les cartes qui se revendent vite passent devant.',
    default: 3,
    min: 0,
    max: 100,
    step: 1,
    unit: 'wikibidous',
  },
});
