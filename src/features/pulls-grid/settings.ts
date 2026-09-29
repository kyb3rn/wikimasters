import { defineSettings } from '@/core/settings';

export const settings = defineSettings('pulls-grid', {
  waveMs: {
    type: 'number',
    label: 'Délai entre deux cartes',
    description: "L'effet de vague à l'arrivée des cartes.",
    default: 80,
    min: 0,
    max: 500,
    step: 10,
    unit: 'ms',
  },
});
