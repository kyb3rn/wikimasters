import { describe, expect, it } from 'vitest';
import { applySearchPlaceholder, SEARCH_PLACEHOLDER } from '@/services/list-search';

/** Champ du site imité : texte d'aide (écritures comptées), `data-*`, présence dans la page. */
function field(placeholder: string) {
  const state = { placeholder, writes: 0, isConnected: true, dataset: {} as Record<string, string | undefined> };
  const input = {
    get placeholder() {
      return state.placeholder;
    },
    set placeholder(value: string) {
      state.writes++;
      state.placeholder = value;
    },
    dataset: state.dataset,
    get isConnected() {
      return state.isConnected;
    },
  };
  return { input: input as unknown as HTMLInputElement, state };
}

describe('applySearchPlaceholder', () => {
  it('pose notre texte d’aide, idempotent, et remet celui du site à l’interruption', () => {
    const { input, state } = field('Rechercher...');
    const controller = new AbortController();
    applySearchPlaceholder(input, controller.signal);
    applySearchPlaceholder(input, controller.signal);
    expect(input.placeholder).toBe(SEARCH_PLACEHOLDER);
    expect(state.writes).toBe(1);
    controller.abort();
    expect(input.placeholder).toBe('Rechercher...');
    expect(state.dataset.wmPlaceholder).toBeUndefined();
  });

  it('texte réécrit par React : repris comme nouvel original', () => {
    const { input, state } = field('Rechercher...');
    const controller = new AbortController();
    applySearchPlaceholder(input, controller.signal);
    state.placeholder = 'Chercher une carte';
    applySearchPlaceholder(input, controller.signal);
    controller.abort();
    expect(input.placeholder).toBe('Chercher une carte');
  });

  it('chaque fonctionnalité remet ses champs, pas ceux des autres ; rien après l’interruption', () => {
    const first = field('A');
    const second = field('B');
    const one = new AbortController();
    const two = new AbortController();
    applySearchPlaceholder(first.input, one.signal);
    applySearchPlaceholder(second.input, two.signal);
    one.abort();
    expect(first.input.placeholder).toBe('A');
    expect(second.input.placeholder).toBe(SEARCH_PLACEHOLDER);
    applySearchPlaceholder(first.input, one.signal);
    expect(first.input.placeholder).toBe('A');
    two.abort();
  });
});
