import { beforeAll, describe, expect, it } from 'vitest';
import { NETWORK_ERROR, siteRequest } from '@/site/api';
import { connectFakeSite } from '../../support';

/** Réponses du faux site, par chemin ; absente : pas de réponse du tout (erreur réseau). */
const replies = new Map<string, () => Response>();
const sent: RequestInit[] = [];

beforeAll(() => {
  connectFakeSite('https://www.wiki-masters.com/collection', (url, init) => {
    sent.push(init ?? {});
    return replies.get(url.pathname)?.();
  });
});

describe('siteRequest', () => {
  const parse = (raw: unknown) => (raw && typeof raw === 'object' ? raw : undefined);

  it('réponse lue par `parse`, cookies de la session joints', async () => {
    replies.set('/api/ok', () => Response.json({ balance: 12 }));
    await expect(siteRequest('/api/ok', { method: 'POST' }, parse)).resolves.toEqual({ balance: 12 });
    expect(sent.at(-1)).toMatchObject({ method: 'POST', credentials: 'include' });
  });

  it('refus : message et code du site', async () => {
    replies.set('/api/refus', () => Response.json({ error: 'Impossible de défausser', code: 'last_copy' }, { status: 400 }));
    await expect(siteRequest('/api/refus', {}, parse)).rejects.toMatchObject({
      message: 'Impossible de défausser',
      status: 400,
      code: 'last_copy',
    });
  });

  it('refus sans message : le statut ; pas de réponse : erreur réseau ; réponse illisible', async () => {
    replies.set('/api/panne', () => new Response('<html>', { status: 502 }));
    await expect(siteRequest('/api/panne', {}, parse)).rejects.toMatchObject({ message: 'Erreur 502 du site.', status: 502 });
    await expect(siteRequest('/api/coupure', {}, parse)).rejects.toMatchObject({ message: NETWORK_ERROR, status: 0 });
    replies.set('/api/vide', () => Response.json(null));
    await expect(siteRequest('/api/vide', {}, parse)).rejects.toMatchObject({ message: 'Réponse inattendue du site.' });
  });
});
