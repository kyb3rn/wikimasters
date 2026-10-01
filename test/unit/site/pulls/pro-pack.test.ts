import { afterEach, describe, expect, it, vi } from 'vitest';
import { findProDailyStates, proClaimDate, type ProPack } from '@/site/pulls';
import { fakeStorage, stateComponent } from '../../support';

afterEach(() => vi.unstubAllGlobals());

describe('proClaimDate', () => {
  it('jour retenu par le site, s’il est lisible', () => {
    const stored = (value: string) => vi.stubGlobal('localStorage', fakeStorage({ 'wikimasters:pro-daily-claimed': value }));
    stored('{"userId":"u1","date":"2026-09-30"}');
    expect(proClaimDate()).toBe('2026-09-30');
    stored('{"userId":"u1","date":"30/09/2026"}');
    expect(proClaimDate()).toBeUndefined();
    stored('pas du json');
    expect(proClaimDate()).toBeUndefined();
    vi.stubGlobal('localStorage', fakeStorage());
    expect(proClaimDate()).toBeUndefined();
  });

  it('stockage refusé : inconnu', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloqué');
      },
    });
    expect(proClaimDate()).toBeUndefined();
  });
});

describe('findProDailyStates', () => {
  /** Page /pulls (code du site) : profil, utilisateur, plateforme, disponible, déjà réclamé, ouverture en cours. */
  const page = (eligible: unknown, claimed: unknown) => stateComponent({}, { packs_remaining: 3 }, 'u1', 'web', eligible, claimed, false, null);
  /** Cadre du pack sous la page : bouton « Ouvrir » ou phrase « Déjà réclamé ». */
  const frame = (pulls: ReturnType<typeof page>, shown: { button?: boolean; claimed?: boolean }): ProPack => ({
    root: { nodeType: 1, contains: () => false, __reactFiber$x: { memoizedProps: {}, return: pulls.fiber } } as unknown as HTMLElement,
    button: shown.button ? ({} as HTMLButtonElement) : undefined,
    claimed: shown.claimed ?? false,
  });

  it('disponible et déjà réclamé : les deux booléens après la plateforme, changés comme par le site', () => {
    const pulls = page(false, true);
    const states = findProDailyStates(frame(pulls, { claimed: true }));
    expect(states?.claimed.value).toBe(true);
    states?.eligible.set(true);
    expect(pulls.calls[3]).toEqual([true]);
    expect(findProDailyStates(frame(page(true, false), { button: true }))?.eligible.value).toBe(true);
  });

  it('états qui ne disent pas ce que montre le cadre, ou forme inattendue : rien', () => {
    expect(findProDailyStates(frame(page(true, false), {}))).toBeUndefined();
    expect(findProDailyStates(frame(page(false, true), {}))).toBeUndefined();
    expect(findProDailyStates(frame(page('oui', false), { button: true }))).toBeUndefined();
    const noPlatform = stateComponent({}, { packs_remaining: 3 }, true, false, false);
    expect(findProDailyStates(frame(noPlatform, { button: true }))).toBeUndefined();
  });
});
