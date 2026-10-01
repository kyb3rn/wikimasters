import { describe, expect, it } from 'vitest';
import { parseRequesterLabel } from '@/site/guild';

describe('parseRequesterLabel', () => {
  it('pseudo seul', () => {
    expect(parseRequesterLabel('gasgot')).toEqual({ username: 'gasgot', status: undefined });
  });

  it('pseudo et état de la demande', () => {
    expect(parseRequesterLabel("flashito19 · reçu aujourd'hui")).toEqual({ username: 'flashito19', status: "reçu aujourd'hui" });
  });

  it('pseudo avec espaces et apostrophe', () => {
    expect(parseRequesterLabel("J'aime le magret")).toEqual({ username: "J'aime le magret", status: undefined });
  });

  it('vide : rien', () => {
    expect(parseRequesterLabel('  ')).toBeUndefined();
  });
});
