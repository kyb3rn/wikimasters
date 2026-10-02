import { expect, test, type Page } from '@playwright/test';
import { expectDomIdle, letTimePass, openSettings, openSite, presetSettings, sitePage } from './support/site';

/** Heure du serveur figée en cours de minute : la remise à zéro est dans 50 s. */
const NOW = new Date('2026-10-02T12:37:10Z');

/**
 * Marché réduit à ses onglets (capture du 29/09/2026) : rangée `border-b`, « Parcourir » choisi (`border-b-2`), son
 * contenu en frère suivant ; « Mes ventes » change l'onglet choisi et le contenu. `loadSales(carte)` : le site demande
 * les ventes d'une carte, comme son « Vue du marché ».
 */
const HTML = sitePage(
  `<div class="flex-1 p-4 md:p-6 space-y-6">
    <div><h1>Marché</h1></div>
    <div class="flex overflow-x-auto border-b border-[var(--color-border)]" id="bar">
      <button class="px-4 py-3 text-sm border-b-2 border-[var(--color-accent)]">Parcourir</button>
      <button class="px-4 py-3 text-sm">Mes ventes (0/5)</button>
    </div>
    <div id="content">Annonces du site</div>
  </div>`,
  `
  const [browse, sales] = document.querySelectorAll('#bar > button');
  const choose = (chosen, text) => {
    for (const tab of [browse, sales]) tab.classList.toggle('border-b-2', tab === chosen);
    document.getElementById('content').textContent = text;
  };
  browse.onclick = () => choose(browse, 'Annonces du site');
  sales.onclick = () => choose(sales, 'Mes ventes du site');
  window.loadSales = (card) => fetch('/api/marketplace/cards/' + card + '/sales').then((response) => response.status);
  `,
);

const REFUSAL = { error: "Trop de requêtes automatisées. L'automatisation n'est pas autorisée — voir le règlement.", code: 'automation_limit' };

interface Server {
  /** Le site refuse les ventes (limite atteinte). */
  refuse: boolean;
  /** Heure de la page (figée), donnée par l'en-tête `Date` des réponses. */
  now: Date;
}

async function openMarket(page: Page, features: Record<string, boolean>): Promise<Server> {
  const server: Server = { refuse: false, now: NOW };
  await page.clock.setFixedTime(NOW);
  // Sans la recherche avancée (outil de dev, choisie d'office à l'arrivée), sauf demande.
  await presetSettings(page, { features: { 'market-search': false, ...features }, values: {} });
  await openSite(page, '/marketplace', {
    html: HTML,
    handle: async (route, url) => {
      if (!/^\/api\/marketplace\/cards\/[^/]+\/sales$/.test(url.pathname)) return false;
      const headers = { date: server.now.toUTCString() };
      await route.fulfill(server.refuse ? { status: 403, json: REFUSAL, headers } : { json: { wikipedia_title: 'Carte', sales: [], recent: [] }, headers });
      return true;
    },
  });
  await expect(page.locator('#bar')).toBeVisible();
  return server;
}

const gauge = (page: Page) => page.locator('.wm-sales-limit');
const box = (page: Page) => gauge(page).locator('.wm-sales-limit-box');

/** Le site demande les ventes de `count` cartes, l'une après l'autre ; rend le dernier statut. */
async function loadSales(page: Page, count = 1): Promise<number> {
  return page.evaluate(async (count) => {
    const load = (window as unknown as { loadSales: (card: string) => Promise<number> }).loadSales;
    let status = 0;
    for (let index = 0; index < count; index++) status = await load(`c${index}`);
    return status;
  }, count);
}

test('éteint par défaut ; activé dans les paramètres, le compteur s’affiche sur « Parcourir »', async ({ page }) => {
  await openMarket(page, {});
  await letTimePass(page, 300);
  await expect(gauge(page)).toHaveCount(0);

  const settings = await openSettings(page, 'Marché');
  const toggle = settings.getByRole('switch', { name: 'Afficher le compteur' });
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await expect(box(page)).toContainText('Historiques0 / 30');
});

test('compte les historiques de la minute, en bas à droite, seulement sur « Parcourir »', async ({ page }) => {
  await openMarket(page, { 'sales-limit': true });
  await expect(box(page)).toContainText('Historiques0 / 30');
  await expect(box(page)).toContainText('Remis à zéro dans 50 s');
  const position = await gauge(page).evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.position, style.right, style.bottom, style.pointerEvents];
  });
  expect(position).toEqual(['fixed', '16px', '16px', 'none']);
  // Les toasts du bas (notifications) se posent au-dessus de l'encart, 10 px plus haut.
  const toastBottom = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--wm-toast-bottom'));
  const height = await box(page).evaluate((element) => element.getBoundingClientRect().height);
  expect([toastBottom, height]).toEqual(['96px', 70]);

  expect(await loadSales(page, 2)).toBe(200);
  await expect(box(page)).toContainText('2 / 30');
  await expect(box(page)).toHaveAttribute('data-level', 'ok');
  await expectDomIdle(page);

  await page.getByRole('button', { name: 'Mes ventes (0/5)' }).click();
  await expect(gauge(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Parcourir' }).click();
  await expect(box(page)).toContainText('2 / 30');
});

test('orange dès 20, rouge dès 25 ; refus du site : bloqué jusqu’à la minute suivante', async ({ page }) => {
  const server = await openMarket(page, { 'sales-limit': true });
  await loadSales(page, 20);
  await expect(box(page)).toContainText('20 / 30');
  await expect(box(page)).toHaveAttribute('data-level', 'warn');
  await loadSales(page, 4);
  await expect(box(page)).toContainText('24 / 30');
  await expect(box(page)).toHaveAttribute('data-level', 'warn');
  await loadSales(page);
  await expect(box(page)).toContainText('25 / 30');
  await expect(box(page)).toHaveAttribute('data-level', 'danger');

  server.refuse = true;
  expect(await loadSales(page)).toBe(403);
  await expect(box(page)).toContainText('HistoriquesBloqué');
  await expect(box(page)).toContainText('Débloqué dans 50 s');
  const fill = await box(page).locator('.wm-sales-limit-fill').evaluate((element) => element.style.width);
  expect(fill).toBe('100%');

  // Minute suivante du serveur : compteur remis à zéro, sans requête.
  server.now = new Date('2026-10-02T12:38:01Z');
  await page.clock.setFixedTime(server.now);
  await expect(box(page)).toContainText('0 / 30');
  await expect(box(page)).toContainText('Remis à zéro dans 59 s');
  await expect(box(page)).toHaveAttribute('data-level', 'ok');
});

test('le compte de la minute reste après un rechargement de la page', async ({ page }) => {
  await openMarket(page, { 'sales-limit': true });
  await loadSales(page, 3);
  await expect(box(page)).toContainText('3 / 30');
  await page.reload();
  await expect(box(page)).toContainText('3 / 30');
});

test('affiché aussi sur la recherche avancée, même ouverte depuis un autre onglet du site', async ({ page }) => {
  await openMarket(page, { 'sales-limit': true, 'market-search': true });
  const advanced = page.getByRole('button', { name: 'Recherche avancée' });
  // Choisie d'office à l'arrivée.
  await expect(advanced).toHaveAttribute('aria-pressed', 'true');
  await expect(box(page)).toBeVisible();

  await page.getByRole('button', { name: 'Mes ventes (0/5)' }).click();
  await expect(gauge(page)).toHaveCount(0);
  await advanced.click();
  await expect(box(page)).toBeVisible();
  await page.getByRole('button', { name: 'Parcourir' }).click();
  await expect(box(page)).toBeVisible();
});
