import { describe, expect, it } from 'vitest';
import {
  addPending,
  doneMessage,
  isPendingName,
  removePending,
  submitLabel,
  withCreatedIds,
  type PendingTag,
} from '@/features/collection-bulk-tags/pending';

const rare: PendingTag = { id: 't1', name: 'rare', chipStyle: '' };
const fresh: PendingTag = { name: 'Été', color: '#60a5fa', chipStyle: '' };

describe('étiquettes choisies', () => {
  it('une étiquette existante ne se choisit qu’une fois (par son id)', () => {
    const list = addPending(addPending([], rare), { ...rare, name: 'autre nom' });
    expect(list).toEqual([rare]);
  });

  it('une étiquette nouvelle ne se choisit qu’une fois (nom sans accents ni casse)', () => {
    const list = addPending(addPending([rare], fresh), { name: '  ete ', color: '#000000', chipStyle: '' });
    expect(list).toEqual([rare, fresh]);
    expect(isPendingName(list, 'ÉTÉ')).toBe(true);
    expect(isPendingName(list, 'rare')).toBe(false);
    expect(isPendingName(list, '  ')).toBe(false);
  });

  it('une étiquette nouvelle et une existante de même nom restent distinctes', () => {
    expect(addPending([{ id: 't9', name: 'Été', chipStyle: '' }], fresh)).toHaveLength(2);
  });

  it('enlever une étiquette choisie', () => {
    expect(removePending([rare, fresh], fresh)).toEqual([rare]);
    expect(removePending([rare, fresh], rare)).toEqual([fresh]);
  });

  it('les étiquettes créées reçoivent leur id, par leur nom', () => {
    const list = withCreatedIds([rare, fresh], [{ id: 'n1', name: 'Été', color: '#60a5fa' }]);
    expect(list).toEqual([rare, { ...fresh, id: 'n1' }]);
  });
});

describe('textes', () => {
  it('bouton d’envoi', () => {
    expect(submitLabel('add', 0)).toBe('Ajouter les étiquettes');
    expect(submitLabel('add', 1)).toBe('Ajouter 1 étiquette');
    expect(submitLabel('add', 3)).toBe('Ajouter 3 étiquettes');
    expect(submitLabel('remove', 2)).toBe('Retirer 2 étiquettes');
  });

  it('notification', () => {
    expect(doneMessage('add', 1, 1)).toBe('1 étiquette ajoutée à 1 carte.');
    expect(doneMessage('add', 3, 12)).toBe('3 étiquettes ajoutées à 12 cartes.');
    expect(doneMessage('remove', 2, 5)).toBe('2 étiquettes retirées de 5 cartes.');
  });
});
