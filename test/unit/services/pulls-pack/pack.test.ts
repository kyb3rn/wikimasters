import { beforeAll, describe, expect, it } from 'vitest';
import { net } from '@/core/net';
import { currentPack, markDiscarded, onPackChange, trackPack } from '@/services/pulls-pack';
import { flush } from '../../support';

const SITE = 'https://www.wiki-masters.com';
const SB = 'https://x.supabase.co/rest/v1';

const CARDS = [
  { id: 'c1', wikipedia_title: 'Tour Eiffel', rarity: 'C' },
  { id: 'c2', wikipedia_title: 'Musée du Louvre', rarity: 'R', is_shiny: true },
];
const COPIES = [
  { id: 'u1', card_id: 'c1', starred: false, is_shiny: false, user_card_tags: [] },
  { id: 'u2', card_id: 'c2', starred: false, is_shiny: false, user_card_tags: [] },
  { id: 'u3', card_id: 'c2', starred: false, is_shiny: true, user_card_tags: [] },
];

/** Réponses du faux site, par chemin. */
const responses = new Map<string, unknown>();

async function call(url: string, init: RequestInit = {}): Promise<void> {
  await net.fetch(url, init);
  await flush();
  await flush();
}

beforeAll(() => {
  net.connect(
    (input) => {
      const url = new URL(input instanceof Request ? input.url : String(input), SITE);
      return Promise.resolve(Response.json(responses.get(url.pathname) ?? {}));
    },
    () => `${SITE}/pulls`,
  );
  trackPack();
});

describe('paquet ouvert sur /pulls', () => {
  it("lit les cartes et l'exemplaire que le site associe à chacune (shiny d'abord)", async () => {
    responses.set('/api/packs/open', { cards: CARDS, owned_copies: COPIES });
    await call('/api/packs/open', { method: 'POST' });
    const pack = currentPack();
    expect(pack?.cards.map((card) => card.title)).toEqual(['Tour Eiffel', 'Musée du Louvre']);
    expect(pack?.chosen?.get('c1')).toBe('u1');
    expect(pack?.chosen?.get('c2')).toBe('u3');
    expect(pack?.discarded.size).toBe(0);
  });

  it('suit favori, étiquettes et défausses, et prévient ses abonnés', async () => {
    responses.set('/api/packs/open', { cards: CARDS, owned_copies: COPIES });
    await call('/api/packs/open', { method: 'POST' });
    let changes = 0;
    const controller = new AbortController();
    onPackChange(() => changes++, { signal: controller.signal });

    await call(`${SB}/user_cards?user_id=eq.x&card_id=eq.c1`, { method: 'PATCH', body: JSON.stringify({ starred: true }) });
    expect(currentPack()?.copies?.get('u1')?.starred).toBe(true);
    await call(`${SB}/user_card_tags`, { method: 'POST', body: JSON.stringify({ user_card_id: 'u3', tag_id: 't1' }) });
    expect(currentPack()?.copies?.get('u3')?.tags).toBe(1);
    await call('/api/user-cards/u3/discard', { method: 'POST' });
    expect([...(currentPack()?.discarded ?? [])]).toEqual([1]);
    expect(changes).toBe(3);

    controller.abort();
    markDiscarded('u1');
    expect([...(currentPack()?.discarded ?? [])].sort()).toEqual([0, 1]);
    expect(changes).toBe(3);
  });

  it('paquet PRO : les exemplaires arrivent par la requête Supabase du site', async () => {
    responses.set('/api/packs/pro-daily', { cards: CARDS, eligible: true });
    await call('/api/packs/pro-daily', { method: 'POST' });
    expect(currentPack()?.chosen).toBeUndefined();

    responses.set('/rest/v1/user_cards', COPIES);
    await call(`${SB}/user_cards?select=id,card_id&card_id=in.(c1,c2)`);
    expect(currentPack()?.chosen?.get('c2')).toBe('u3');
  });

  it("un nouveau paquet remplace l'ancien, défausses comprises", async () => {
    responses.set('/api/packs/open', { cards: CARDS, owned_copies: COPIES });
    await call('/api/packs/open', { method: 'POST' });
    markDiscarded('u1');
    await call('/api/packs/open', { method: 'POST' });
    expect(currentPack()?.discarded.size).toBe(0);
  });
});
