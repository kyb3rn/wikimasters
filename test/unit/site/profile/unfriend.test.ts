import { describe, expect, it } from 'vitest';
import { parseUnfriendConfirm } from '@/site/profile';

describe('confirmation « Retirer des amis » du profil', () => {
  it('lit le pseudo dans la question du site, espaces et apostrophes compris', () => {
    expect(parseUnfriendConfirm("Retirer aelonka de votre liste d'amis ?")).toBe('aelonka');
    expect(parseUnfriendConfirm("Retirer Sarah Vachol de votre liste d'amis ?")).toBe('Sarah Vachol');
    expect(parseUnfriendConfirm("Retirer l'Ami de votre liste d'amis ?")).toBe("l'Ami");
  });

  it('laisse passer les autres questions', () => {
    expect(parseUnfriendConfirm('Quitter la guilde ?')).toBeUndefined();
    expect(parseUnfriendConfirm(undefined)).toBeUndefined();
  });
});
