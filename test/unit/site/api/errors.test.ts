import { beforeAll, describe, expect, it } from 'vitest';
import { net } from '@/core/net';
import { NETWORK_ERROR, SiteApiError, siteErrorMessage, siteErrorText, watchSiteRefusal } from '@/site/api';
import { connectFakeSite, flush } from '../../support';

/** Réponses du faux site, par chemin ; absente : pas de réponse du tout (erreur réseau). */
const replies = new Map<string, () => Response>();

beforeAll(() => {
  connectFakeSite('https://www.wiki-masters.com/collection', (url) => replies.get(url.pathname)?.());
});

describe('siteErrorMessage', () => {
  it('le message du site, sinon son statut', () => {
    expect(siteErrorMessage({ error: 'Impossible de défausser' }, 400)).toBe('Impossible de défausser');
    expect(siteErrorMessage({ error: '  ' }, 500)).toBe('Erreur 500 du site.');
    expect(siteErrorMessage({ message: 'x' }, 503)).toBe('Erreur 503 du site.');
    expect(siteErrorMessage(undefined, 404)).toBe('Erreur 404 du site.');
  });
});

describe('siteErrorText', () => {
  it('le texte d’une SiteApiError, en phrase : majuscule, point final', () => {
    expect(siteErrorText(new SiteApiError('session du site introuvable : recharger la page', 0))).toBe(
      'Session du site introuvable : recharger la page.',
    );
    expect(siteErrorText(new SiteApiError('Erreur 500 du site.', 500))).toBe('Erreur 500 du site.');
    expect(siteErrorText(new SiteApiError('Déjà fait !', 409))).toBe('Déjà fait !');
    expect(siteErrorText(new SiteApiError(NETWORK_ERROR, 0))).toBe("Le site n'a pas répondu (erreur réseau).");
  });

  it('toute autre erreur : inattendue', () => {
    expect(siteErrorText(new Error('boum'))).toBe('Erreur inattendue.');
    expect(siteErrorText(new SiteApiError('', 500))).toBe('Erreur inattendue.');
    expect(siteErrorText(undefined)).toBe('Erreur inattendue.');
  });
});

describe('watchSiteRefusal', () => {
  it('prévient des réponses en erreur et des requêtes sans réponse, pas des autres', async () => {
    const refusals: [string, number | undefined][] = [];
    const controller = new AbortController();
    watchSiteRefusal(
      (request) => request.url.pathname.startsWith('/api/action'),
      (message, status) => refusals.push([message, status]),
      { signal: controller.signal },
    );
    replies.set('/api/action/ok', () => Response.json({ ok: true }));
    replies.set('/api/action/refus', () => Response.json({ error: 'Trop tard' }, { status: 409 }));
    replies.set('/api/action/panne', () => new Response('', { status: 500 }));
    replies.set('/api/autre', () => new Response('', { status: 500 }));

    // Chacune attendue jusqu'à ses observateurs (tâche suivante), pour l'ordre des refus.
    for (const path of ['/api/action/ok', '/api/action/refus', '/api/action/panne', '/api/autre', '/api/action/coupure']) {
      await net.fetch(path).catch(() => undefined);
      await flush();
      await flush();
    }
    expect(refusals).toEqual([
      ['Trop tard', 409],
      ['Erreur 500 du site.', 500],
      [NETWORK_ERROR, undefined],
    ]);

    controller.abort();
    await net.fetch('/api/action/refus');
    await flush();
    expect(refusals).toHaveLength(3);
  });
});
