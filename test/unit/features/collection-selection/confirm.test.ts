import { describe, expect, it } from 'vitest';
import { CONFIRM_ACTIVE_MS, CONFIRM_DELAY_MS, confirmStage, selectedLabel } from '@/features/collection-selection/confirm';

describe('« Défausser tout » en deux clics', () => {
  it('sans premier clic : « Défausser tout »', () => {
    expect(confirmStage(undefined, 1000)).toBe('idle');
  });

  it('juste après le premier clic : « Confirmer ? » inactif', () => {
    expect(confirmStage(1000, 1000)).toBe('waiting');
    expect(confirmStage(1000, 1000 + CONFIRM_DELAY_MS - 1)).toBe('waiting');
  });

  it('puis actif, un temps', () => {
    expect(confirmStage(1000, 1000 + CONFIRM_DELAY_MS)).toBe('asking');
    expect(confirmStage(1000, 1000 + CONFIRM_DELAY_MS + CONFIRM_ACTIVE_MS - 1)).toBe('asking');
  });

  it('puis de nouveau « Défausser tout » ; une horloge qui recule aussi', () => {
    expect(confirmStage(1000, 1000 + CONFIRM_DELAY_MS + CONFIRM_ACTIVE_MS)).toBe('idle');
    expect(confirmStage(1000, 999)).toBe('idle');
  });
});

it('compte de la sélection', () => {
  expect(selectedLabel(0)).toBe('sélectionnée');
  expect(selectedLabel(1)).toBe('sélectionnée');
  expect(selectedLabel(2)).toBe('sélectionnées');
});
