import { expect, it } from 'vitest';
import { selectedLabel } from '@/features/collection-selection/label';

it('compte de la sélection', () => {
  expect(selectedLabel(0)).toBe('sélectionnée');
  expect(selectedLabel(1)).toBe('sélectionnée');
  expect(selectedLabel(2)).toBe('sélectionnées');
});
