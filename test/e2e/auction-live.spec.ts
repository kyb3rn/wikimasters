import { expect, test, type Page } from '@playwright/test';
import { expectDomIdle, openSite, sitePage } from './support/site';

const AUCTION = '44066a16-2aec-447e-98a4-5186f3d3e32a';

/**
 * Page d'une enchère : titre et « Vue du marché » dans `div.flex.items-start.gap-2` (capture du 01/10/2026) ; client
 * Supabase du site dans une référence (`useRef`) du composant de la page, son temps réel imité (realtime-js
 * 2.99.2 : état de la WebSocket, canal de l'enchère, minuterie de nouvel essai). `window.live.calls` : appels du
 * script ; `window.live.set(socket, state)` : le client change d'état (connexion, réponse du serveur).
 */
const html = (socket: string, state: string) =>
  sitePage(
    '<div id="auction"></div>',
    `
  const calls = [];
  const channel = {
    topic: 'realtime:auction:${AUCTION}',
    state: '${state}',
    rejoinTimer: { reset() { calls.push('rejoinTimer.reset'); } },
    _rejoin() { calls.push('_rejoin'); channel.state = 'joining'; },
  };
  const realtime = {
    socket: '${socket}',
    channels: [{ topic: 'realtime:notifications:u0', state: 'joined' }, channel],
    connectionState() { return realtime.socket; },
    connect() { calls.push('connect'); realtime.socket = 'connecting'; },
  };
  window.live = { calls, set(socket, state) { realtime.socket = socket; channel.state = state; } };
  const row = kit.el('div', 'flex items-start gap-2');
  const market = kit.button('relative shrink-0 flex h-9 w-9 items-center justify-center rounded-lg border', kit.icon('chart-line', 'size-[18px]', 18));
  market.setAttribute('aria-label', 'Vue du marché');
  row.append(kit.el('h1', 'text-2xl font-bold flex-1 min-w-0', 'MrBeast'), market);
  document.getElementById('auction').append(row);
  const refs = { memoizedState: { current: { auth: {}, realtime } }, queue: null, next: null };
  kit.fiber(market, {}, kit.fiber(null, {}, null, { memoizedState: refs }));
  `,
  );

interface Live {
  calls: string[];
  set(socket: string, state: string): void;
}

const calls = (page: Page) => page.evaluate(() => (window as unknown as { live: Live }).live.calls);
const setLink = (page: Page, socket: string, state: string) =>
  page.evaluate(([s, c]) => (window as unknown as { live: Live }).live.set(s, c), [socket, state] as const);

async function openAuction(page: Page, socket: string, state: string) {
  await openSite(page, `/marketplace/${AUCTION}`, { html: html(socket, state) });
  const button = page.getByRole('button', { name: 'Mises en direct' });
  await expect(button).toBeVisible();
  return button;
}

test('en direct : carré vert inactif, juste après « Vue du marché »', async ({ page }) => {
  const button = await openAuction(page, 'open', 'joined');
  await expect(button).toHaveClass(/wm-button-square/);
  await expect(button).toHaveClass(/wm-button-md/);
  await expect(button).toHaveClass(/wm-tone-accent/);
  await expect(button).toBeDisabled();
  await expect(button.locator('svg')).not.toHaveClass(/wm-spin/);
  await expect(button).toHaveAttribute('title', /^En direct/);
  const afterMarket = await button.evaluate((node) => node.closest('.wm-root')?.previousElementSibling?.getAttribute('aria-label'));
  expect(afterMarket).toBe('Vue du marché');
  await expectDomIdle(page);
});

test('WebSocket fermée : rouge et cliquable ; le clic la relance avec le canal, roue jusqu’à l’abonnement, puis vert', async ({ page }) => {
  const button = await openAuction(page, 'closed', 'errored');
  await expect(button).toHaveClass(/wm-tone-danger/);
  await expect(button).toBeEnabled();
  await expect(button).toHaveAttribute('title', /Cliquer pour reconnecter/);
  await expectDomIdle(page);

  await button.click();
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute('aria-busy', 'true');
  await expect(button.locator('svg')).toHaveClass(/wm-spin/);
  // Minuterie du canal arrêtée avant l'abonnement : son essai suivant tomberait pendant le nôtre.
  expect(await calls(page)).toEqual(['connect', 'rejoinTimer.reset', '_rejoin']);

  await setLink(page, 'open', 'joined');
  await expect(button).toHaveClass(/wm-tone-accent/);
  await expect(button).toBeDisabled();
  await expect(button).not.toHaveAttribute('aria-busy', 'true');
});

test('abonnement refusé (serveur saturé) : seul le canal est relancé ; refusé de nouveau, rouge et cliquable', async ({ page }) => {
  const button = await openAuction(page, 'open', 'errored');
  await expect(button).toHaveClass(/wm-tone-danger/);
  await button.click();
  await expect(button).toHaveAttribute('aria-busy', 'true');
  expect(await calls(page)).toEqual(['rejoinTimer.reset', '_rejoin']);

  await setLink(page, 'open', 'errored');
  await expect(button).toHaveClass(/wm-tone-danger/);
  await expect(button).toBeEnabled();
});

test('le site retente seul : roue pendant son essai, vert s’il aboutit', async ({ page }) => {
  const button = await openAuction(page, 'closed', 'errored');
  await expect(button).toHaveClass(/wm-tone-danger/);
  await setLink(page, 'connecting', 'errored');
  await expect(button).toHaveAttribute('aria-busy', 'true');
  await setLink(page, 'open', 'joined');
  await expect(button).toHaveClass(/wm-tone-accent/);
  expect(await calls(page)).toEqual([]);
});
