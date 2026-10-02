import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Capture } from '@/features/debug';
import { collectLogs, injectScript, openSite, VERSION } from './support/site';

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

test('le script démarre et expose ses commandes', async ({ page }) => {
  const logs = collectLogs(page);
  await openSite(page, '/pulls');

  const wm = await page.evaluate(() => ({
    version: window.wm?.version,
    dev: window.wm?.dev,
    features: window.wm?.features?.list().map((f) => [f.id, f.state]),
  }));
  expect(wm).toEqual({
    version: VERSION,
    dev: true,
    features: [
      ['settings', 'mounted'],
      ['header-bar', 'mounted'],
      ['disabled-cursor', 'mounted'],
      ['page-spinner', 'mounted'],
      ['site-modals', 'mounted'],
      ['site-fields', 'mounted'],
      ['site-buttons', 'mounted'],
      ['site-tabs', 'mounted'],
      ['card-faces', 'mounted'],
      ['card-modal-layout', 'mounted'],
      ['quick-discard', 'mounted'],
      ['pulls-grid', 'mounted'],
      ['pulls-sound', 'mounted'],
      ['pulls-discard-next', 'mounted'],
      ['pulls-auction', 'mounted'],
      ['card-modal-stats', 'mounted'],
      ['card-modal-stay', 'mounted'],
      ['card-modal-discard', 'mounted'],
      ['pulls-keyboard', 'mounted'],
      ['pulls-remaining', 'mounted'],
      ['pulls-center', 'mounted'],
      ['pulls-human-check', 'mounted'],
      ['pulls-open-label', 'mounted'],
      ['pulls-bar', 'mounted'],
      ['pulls-pro', 'mounted'],
      ['auction-modal-layout', 'mounted'],
      ['auction-stay', 'mounted'],
      ['collection-stay', 'idle'],
      ['collection-memory', 'idle'],
      ['collection-search', 'idle'],
      ['collection-search-delay', 'idle'],
      ['collection-pagination', 'idle'],
      ['tag-manager', 'idle'],
      ['collection-filters', 'idle'],
      ['collection-selection', 'idle'],
      ['collection-selection-key', 'idle'],
      ['collection-bulk-tags', 'idle'],
      ['collection-prices', 'idle'],
      ['profile-header', 'idle'],
      ['profile-unfriend', 'idle'],
      ['profile-not-found', 'idle'],
      ['profile-card-picker', 'idle'],
      ['friends-layout', 'idle'],
      ['player-search', 'idle'],
      ['guild-create-modal', 'idle'],
      ['guild-layout', 'idle'],
      ['dms-layout', 'idle'],
      ['dms-groups', 'mounted'],
      ['guild-chat', 'idle'],
      ['guild-chat-tab', 'idle'],
      ['collection-card-display', 'idle'],
      ['trades-card-display', 'mounted'],
      ['trades-tab-line', 'idle'],
      ['trade-filters', 'mounted'],
      ['trade-wikibidous', 'mounted'],
      ['trade-cards-error', 'mounted'],
      ['trade-friend-picker', 'idle'],
      ['trade-summary', 'mounted'],
      ['trade-selection', 'mounted'],
      ['marketplace-memory', 'idle'],
      ['marketplace-search', 'idle'],
      ['marketplace-search-delay', 'idle'],
      ['marketplace-filters', 'idle'],
      ['market', 'mounted'],
      ['auction-market', 'mounted'],
      ['auction-report', 'idle'],
      ['auction-result', 'idle'],
      ['auction-not-found', 'idle'],
      ['marketplace-tiles', 'idle'],
      ['marketplace-prices', 'idle'],
      ['auction-live', 'idle'],
      // Éteinte par défaut.
      ['sales-limit', 'off'],
      ['player-links', 'mounted'],
      ['owned-badge', 'idle'],
      ['marketplace-card-display', 'idle'],
      ['profile-collection-search', 'idle'],
      ['profile-collection-search-delay', 'idle'],
      ['profile-collection-pagination', 'idle'],
      ['profile-collection-filters', 'idle'],
      ['profile-card-display', 'idle'],
      ['global-collection-memory', 'idle'],
      ['global-collection-search', 'idle'],
      ['global-collection-search-delay', 'idle'],
      ['global-collection-pagination', 'idle'],
      ['global-collection-filters', 'idle'],
      ['global-collection-friends', 'idle'],
      ['global-collection-card-display', 'idle'],
      ['guild-card-display', 'idle'],
      ['notifications', 'mounted'],
      ['debug', 'mounted'],
      ['showcase', 'idle'],
      ['market-search', 'idle'],
    ],
  });
  expect(logs).toContainEqual({
    type: 'info',
    text: `[WM] v${VERSION} (dev) · actives ici : settings, header-bar, disabled-cursor, page-spinner, site-modals, site-fields, site-buttons, site-tabs, card-faces, card-modal-layout, quick-discard, pulls-grid, pulls-sound, pulls-discard-next, pulls-auction, card-modal-stats, card-modal-stay, card-modal-discard, pulls-keyboard, pulls-remaining, pulls-center, pulls-human-check, pulls-open-label, pulls-bar, pulls-pro, auction-modal-layout, auction-stay, dms-groups, trades-card-display, trade-filters, trade-wikibidous, trade-cards-error, trade-summary, trade-selection, market, auction-market, player-links, notifications, debug`,
  });
  expect(logs.filter((l) => l.type === 'error')).toEqual([]);
});

test('une seule copie démarre si le script est installé deux fois', async ({ page }) => {
  const logs = collectLogs(page);
  await injectScript(page);
  await openSite(page, '/');

  expect(logs.filter((l) => l.text.startsWith(`[WM] v${VERSION}`))).toHaveLength(1);
  expect(logs).toContainEqual({
    type: 'warning',
    text: `[WM] déjà chargé (v${VERSION} dev) : cette copie ne démarre pas`,
  });
});

test('les requêtes du site passent par le script sans changer leur réponse', async ({ page }) => {
  await openSite(page, '/marketplace', { api: { '/api/marketplace': { auctions: [{ id: 'a1' }] } } });

  const body = await page.evaluate(async () => (await fetch('/api/marketplace?page=1')).json() as Promise<unknown>);
  expect(body).toEqual({ auctions: [{ id: 'a1' }] });
  await expect
    .poll(() => page.evaluate(() => window.wm?.debug?.exchanges().map((e) => e.url)))
    .toEqual(['https://www.wiki-masters.com/api/marketplace?page=1']);
});

test('un son chargé par le site est enregistré intact', async ({ page }) => {
  const mp3 = Buffer.from(Array.from({ length: 50_000 }, (_, i) => (i * 13) % 256));
  await openSite(page, '/pulls', { files: { '/audio/pack-rip.mp3': { contentType: 'audio/mpeg', body: mp3 } } });

  await page.evaluate(async () => {
    await (await fetch('/audio/pack-rip.mp3')).arrayBuffer();
  });
  await expect.poll(() => page.evaluate(() => window.wm?.debug?.exchanges().length)).toBe(1);

  const recorded = await page.evaluate(() => window.wm?.debug?.exchanges()[0]);
  expect(recorded?.bodyEncoding).toBe('base64');
  expect(Buffer.from(recorded?.body ?? '', 'base64').equals(mp3)).toBe(true);
});

test('le temps réel (WebSocket) est enregistré, dans les deux sens, secrets masqués', async ({ page }) => {
  // Faux serveur Supabase Realtime : répond à l'abonnement par une nouvelle mise.
  await page.routeWebSocket('wss://x.supabase.co/**', (ws) => {
    ws.onMessage(() => {
      ws.send(JSON.stringify([null, null, 'realtime:auction:a1', 'broadcast', { event: 'BID', payload: { bid: { amount: 120 } } }]));
    });
  });
  await openSite(page, '/marketplace/a1');

  await page.evaluate(() => {
    const ws = new WebSocket('wss://x.supabase.co/realtime/v1/websocket?apikey=cle-anon&vsn=2.0.0');
    ws.onopen = () => ws.send(JSON.stringify(['1', '1', 'realtime:auction:a1', 'phx_join', { access_token: 'jeton', config: {} }]));
  });
  await expect.poll(() => page.evaluate(() => window.wm?.debug?.sockets().length)).toBe(3);

  const events = await page.evaluate(() => window.wm?.debug?.sockets());
  expect(events?.map((e) => [e.type, e.direction])).toEqual([
    ['open', undefined],
    ['message', 'out'],
    ['message', 'in'],
  ]);
  expect(events?.[0]?.url).toBe('wss://x.supabase.co/realtime/v1/websocket?apikey=[masqué]&vsn=2.0.0');
  expect(events?.[1]?.data).toContain('"access_token":"[masqué]"');
  expect(events?.[2]?.data).toContain('"amount":120');
});

test('Alt+Maj+C capture l’onglet affiché et le confirme à l’écran', async ({ page }) => {
  await openSite(page, '/profile/joueur');

  const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Alt+Shift+KeyC')]);
  expect(download.suggestedFilename()).toMatch(/^wm-capture-profile-joueur-\d{8}-\d{6}\.json$/);
  const confirmation = page.getByRole('status');
  await expect(confirmation).toContainText('Capture enregistrée');
  await expect(confirmation).toContainText('/profile/joueur · 0 échanges, 0 événements temps réel');
});

test('wm.debug.capture() télécharge la page et les échanges, secrets masqués', async ({ page }) => {
  await openSite(page, '/marketplace/a1', {
    api: { '/api/profile': { pseudo: 'mamzet', access_token: JWT, email: 'moi@exemple.fr' } },
  });
  await page.evaluate(async (jwt) => {
    await fetch('/api/profile', { headers: { authorization: `Bearer ${jwt}` } });
  }, JWT);
  await expect.poll(() => page.evaluate(() => window.wm?.debug?.exchanges().length)).toBe(1);

  const [download] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => window.wm?.debug?.capture())]);
  expect(download.suggestedFilename()).toMatch(/^wm-capture-marketplace-a1-\d{8}-\d{6}\.json$/);

  const text = await readFile(await download.path(), 'utf8');
  const capture = JSON.parse(text) as Capture;
  expect(capture).toMatchObject({
    format: 'wm-capture',
    version: 2,
    sockets: [],
    script: { version: VERSION, dev: true },
    page: { path: '/marketplace/a1', title: 'WikiMasters (test)' },
  });
  expect(capture.html).toContain('<h1>Page de test</h1>');
  const [exchange] = capture.exchanges;
  expect(exchange?.requestHeaders.authorization).toBe('[masqué]');
  expect(JSON.parse(exchange?.body ?? '')).toEqual({
    pseudo: 'mamzet',
    access_token: '[masqué]',
    email: '[e-mail masqué]',
  });
  expect(text).not.toContain(JWT);
});
