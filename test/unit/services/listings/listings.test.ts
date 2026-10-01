import { beforeAll, describe, expect, it, vi } from 'vitest';
import { net } from '@/core/net';
import { isTitleListed, listedCardTitle, listingOf, onListingsChange, trackListings } from '@/services/listings';
import { connectFakeSite, flush } from '../../support';

/** Modales de carte ouvertes : seule compte celle qui a « Mettre aux enchères ». */
const modals = vi.hoisted(() => ({ open: [] as { title: string; auctionButton?: object }[] }));
vi.mock('@/site/cards', async (original) => ({ ...(await original<object>()), findCardModals: () => modals.open }));

/** Réponse du site à la prochaine mise aux enchères ; `undefined` : pas de réponse. */
let creation: () => Response | undefined;
let siteFetch: typeof fetch;

beforeAll(() => {
  siteFetch = connectFakeSite('https://www.wiki-masters.com/collection', (url, init) =>
    url.pathname === '/api/marketplace' && init?.method === 'POST' ? creation() : Response.json({ success: true }),
  );
  trackListings();
});

/** Mise aux enchères de l'exemplaire par le site, la modale de `title` ouverte ; attend ses observateurs. */
async function list(userCardId: string, title: string): Promise<void> {
  modals.open = [{ title: 'Autre carte' }, { title, auctionButton: {} }];
  const body = JSON.stringify({ card_id: userCardId, base_amount: 50, duration_minutes: 10 });
  const pending = siteFetch('/api/marketplace', { method: 'POST', body });
  // Le titre est lu au départ de la requête : la modale peut se fermer avant la réponse.
  modals.open = [];
  await pending.catch(() => undefined);
  await flush();
  await flush();
}

describe('listedCardTitle', () => {
  it('titre de la modale qui a « Mettre aux enchères », normalisé ; aucune : vide', () => {
    modals.open = [{ title: 'Paris' }, { title: '  Tour\n Eiffel ', auctionButton: {} }];
    expect(listedCardTitle()).toBe('Tour Eiffel');
    modals.open = [{ title: 'Paris' }];
    expect(listedCardTitle()).toBe('');
  });
});

describe('exemplaires mis aux enchères', () => {
  it('mise en vente réussie : exemplaire suivi avec le titre de sa carte et son enchère, abonnés prévenus', async () => {
    let changes = 0;
    const controller = new AbortController();
    onListingsChange(() => changes++, { signal: controller.signal });
    creation = () => Response.json({ auction_id: 'a1' });
    await list('u1', 'Tour Eiffel');
    expect(listingOf('u1')).toEqual({ userCardId: 'u1', title: 'Tour Eiffel', auctionId: 'a1' });
    expect(isTitleListed(' Tour  Eiffel ')).toBe(true);
    expect(isTitleListed('Paris')).toBe(false);
    expect(isTitleListed(undefined)).toBe(false);
    expect(changes).toBe(1);
    controller.abort();
  });

  it('refusée ou sans réponse : rien de suivi', async () => {
    creation = () => Response.json({ error: 'Carte déjà en vente' }, { status: 409 });
    await list('u2', 'Paris');
    creation = () => undefined;
    await list('u3', 'Lyon');
    expect(listingOf('u2')).toBeUndefined();
    expect(listingOf('u3')).toBeUndefined();
    expect(isTitleListed('Paris')).toBe(false);
  });

  it('pas les mises en vente du script', async () => {
    creation = () => Response.json({ auction_id: 'a9' });
    await net.fetch('/api/marketplace', { method: 'POST', body: JSON.stringify({ card_id: 'u9' }) });
    await flush();
    await flush();
    expect(listingOf('u9')).toBeUndefined();
  });

  it('annonce retirée : l’exemplaire n’est plus en vente', async () => {
    creation = () => Response.json({ auction_id: 'a4' });
    await list('u4', 'Marseille');
    await siteFetch('/api/marketplace/a4', { method: 'DELETE' });
    await flush();
    expect(listingOf('u4')).toBeUndefined();
    expect(isTitleListed('Marseille')).toBe(false);
    expect(listingOf('u1')).toBeDefined();
  });
});
