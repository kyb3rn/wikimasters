import { describe, expect, it } from 'vitest';
import { isListChange, searchStatus } from '@/features/collection-search/state';
import { readCollectionQuery } from '@/site/collection';

const read = (search: string) => readCollectionQuery(new URL(`https://www.wiki-masters.com/api/my-collection${search}`));

describe('recherche de la collection', () => {
  it('ne retient que les changements d’étiquette, de tri ou de raretés', () => {
    const shown = read('?sort=rarity&page=2&stats=0');
    // Choix dans une liste ou une rareté : la page revient à 0.
    expect(isListChange(read('?sort=name&page=0&stats=0'), shown)).toBe(true);
    expect(isListChange(read('?sort=rarity&tag_id=t1&page=0&stats=0'), shown)).toBe(true);
    expect(isListChange(read('?sort=rarity&rarity=L&page=0&stats=0'), shown)).toBe(true);
    // Actualisation, autre page, recherche : ça charge.
    expect(isListChange(read('?sort=rarity&page=2&stats=0'), shown)).toBe(false);
    expect(isListChange(read('?sort=rarity&page=3&stats=0'), shown)).toBe(false);
    expect(isListChange(read('?sort=name&q=tour&page=0&stats=0'), shown)).toBe(false);
    // Premier chargement.
    expect(isListChange(read('?sort=rarity&page=0&stats=0'), undefined)).toBe(false);
  });

  it('bouton : recherche si les choix ont changé, sinon rechargement, roue pendant le chargement', () => {
    const shown = read('?sort=rarity&page=0');
    expect(searchStatus({ loading: false, requested: read('?sort=name&page=0'), shown })).toBe('search');
    expect(searchStatus({ loading: false, requested: read('?sort=rarity&rarity=C&page=0'), shown })).toBe('search');
    expect(searchStatus({ loading: false, requested: read('?sort=rarity&page=1'), shown })).toBe('reload');
    expect(searchStatus({ loading: true, requested: read('?sort=name&page=0'), shown })).toBe('loading');
    expect(searchStatus({ loading: false, requested: undefined, shown: undefined })).toBe('reload');
  });
});
