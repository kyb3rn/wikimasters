import { beforeAll, describe, expect, it } from 'vitest';
import { fetchUntaggedCopies, OWNED_COPIES_BATCH, parseOwnedCopy, trackSupabaseSession } from '@/site/api';
import { connectFakeSite } from '../../support';

const SB = 'https://x.supabase.co';
const JWT = `entete.${Buffer.from(JSON.stringify({ sub: 'u1' })).toString('base64url')}.signature`;

/** Ligne de `user_cards` telle que la rend la requête (carte jointe, sans étiquette). */
function row(id: string, extra: Record<string, unknown> = {}, card: Record<string, unknown> = {}) {
  return {
    id,
    card_id: `card-${id}`,
    starred: false,
    is_shiny: false,
    obtained_at: '2026-10-01T10:00:00.123456+00:00',
    snapshot_rarity: null,
    snapshot_atk: null,
    snapshot_def: null,
    card: { wikipedia_title: ` Titre ${id} `, category: 'Pays', image_url: `https://img/${id}.png`, hide_image: false, rarity: 'R', atk: 100, def: 200, ...card },
    user_card_tags: [],
    ...extra,
  };
}

describe('exemplaire lu dans Supabase', () => {
  it('aux valeurs de l’exemplaire : rareté, ATK et DEF de son obtention, sinon celles de la carte', () => {
    expect(parseOwnedCopy(row('a'))).toEqual({
      id: 'a',
      cardId: 'card-a',
      title: 'Titre a',
      category: 'Pays',
      image: 'https://img/a.png',
      rarity: 'R',
      shiny: false,
      atk: 100,
      def: 200,
      starred: false,
      obtainedAt: Date.parse('2026-10-01T10:00:00.123Z'),
      // La carte pour la face et la modale du site, aux valeurs de l'exemplaire.
      siteCard: {
        wikipedia_title: ' Titre a ',
        category: 'Pays',
        image_url: 'https://img/a.png',
        hide_image: false,
        id: 'card-a',
        rarity: 'R',
        atk: 100,
        def: 200,
        is_shiny: false,
      },
    });
    expect(parseOwnedCopy(row('b', { snapshot_rarity: 'UR', snapshot_atk: 5, snapshot_def: 0 }))).toMatchObject({ rarity: 'UR', atk: 5, def: 0 });
  });

  it('shiny : une L seulement, comme la face du site', () => {
    expect(parseOwnedCopy(row('a', { is_shiny: true, snapshot_rarity: 'L' }))?.shiny).toBe(true);
    expect(parseOwnedCopy(row('b', { is_shiny: true, snapshot_rarity: 'UR' }))?.shiny).toBe(false);
  });

  it('image cachée (images sensibles) : aucune', () => {
    expect(parseOwnedCopy(row('a', {}, { hide_image: true }))?.image).toBeUndefined();
  });

  it('écarte une ligne sans carte ou sans rareté lisible', () => {
    expect(parseOwnedCopy(row('a', { card: null }))).toBeUndefined();
    expect(parseOwnedCopy(row('b', { snapshot_rarity: 'X' }, { rarity: 'Z' }))).toBeUndefined();
    expect(parseOwnedCopy('x')).toBeUndefined();
  });
});

describe('lecture des exemplaires sans étiquette', () => {
  const requests: URL[] = [];
  let total = 0;

  beforeAll(async () => {
    const siteFetch = connectFakeSite('https://www.wiki-masters.com/collection', (url) => {
      if (url.origin !== SB) return undefined;
      requests.push(url);
      const offset = Number(url.searchParams.get('offset'));
      const limit = Number(url.searchParams.get('limit'));
      const rows = Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) => row(String(offset + i)));
      return Response.json(rows);
    });
    trackSupabaseSession();
    await siteFetch(`${SB}/rest/v1/profiles?id=eq.u1`, { headers: { apikey: 'cle', authorization: `Bearer ${JWT}` } });
  });

  it('colonnes utiles, sans étiquette (jointure exigée par le filtre), sans comptage', async () => {
    requests.length = 0;
    total = 3;
    const { copies } = await fetchUntaggedCopies();
    expect(copies.map((copy) => copy.id)).toEqual(['0', '1', '2']);
    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request?.pathname).toBe('/rest/v1/user_cards');
    expect(request?.searchParams.get('select')).toBe(
      'id,card_id,starred,is_shiny,obtained_at,snapshot_rarity,snapshot_atk,snapshot_def,' +
        'card:cards(wikipedia_title,wikipedia_url,category,image_url,hide_image,rarity,atk,def,q_score,pageviews),user_card_tags(tag_id)',
    );
    expect(request?.searchParams.get('user_id')).toBe('eq.u1');
    expect(request?.searchParams.get('user_card_tags')).toBe('is.null');
  });

  it('par tranches de 1 000 jusqu’à une tranche incomplète', async () => {
    requests.length = 0;
    total = OWNED_COPIES_BATCH * 2;
    const { copies } = await fetchUntaggedCopies();
    expect(copies).toHaveLength(OWNED_COPIES_BATCH * 2);
    // Deux pleines, puis une vide : la fin est sûre.
    expect(requests.map((url) => url.searchParams.get('offset'))).toEqual(['0', '1000', '2000']);
  });
});
