import { defineSettings } from '@/core/settings';

export const settings = defineSettings('pulls-discard-next', {
  delayMs: {
    type: 'number',
    label: 'Délai avant la carte suivante',
    description: 'Le temps de voir la carte défaussée.',
    default: 600,
    min: 0,
    max: 3000,
    step: 100,
    unit: 'ms',
  },
});
