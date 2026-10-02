import { beforeAll, describe, expect, it, vi } from 'vitest';
import { net } from '@/core/net';
import { listedCardTitle, listingOf, onListingsChange, trackListings } from '@/services/listings';
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

/** Mise aux enchères de l'exemplaire par le site ; attend ses observateurs. */
async function list(userCardId: string): Promise<void> {
  const body = JSON.stringify({ card_id: userCardId, base_amount: 50, duration_minutes: 10 });
  await siteFetch('/api/marketplace', { method: 'POST', body }).catch(() => undefined);
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
  it('mise en vente réussie : exemplaire suivi avec son enchère, abonnés prévenus', async () => {
    let changes = 0;
    const controller = new AbortController();
    onListingsChange(() => changes++, { signal: controller.signal });
    creation = () => Response.json({ auction_id: 'a1' });
    await list('u1');
    expect(listingOf('u1')).toEqual({ userCardId: 'u1', auctionId: 'a1' });
    expect(changes).toBe(1);
    controller.abort();
  });

  it('refusée ou sans réponse : rien de suivi', async () => {
    creation = () => Response.json({ error: 'Carte déjà en vente' }, { status: 409 });
    await list('u2');
    creation = () => undefined;
    await list('u3');
    expect(listingOf('u2')).toBeUndefined();
    expect(listingOf('u3')).toBeUndefined();
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
    await list('u4');
    await siteFetch('/api/marketplace/a4', { method: 'DELETE' });
    await flush();
    expect(listingOf('u4')).toBeUndefined();
    expect(listingOf('u1')).toBeDefined();
  });
});
