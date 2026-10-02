import { expect, test, type Locator, type Page } from '@playwright/test';
import { openSite, rect, sitePage } from './support/site';

const BALANCE = 'button[aria-label="Ouvrir la boutique WikiBidous"]:visible';

/** Cadre du solde affiché (boîte ordinateur ou rangée mobile), une fois nos boutons posés dedans. */
async function openBar(page: Page): Promise<Locator> {
  await openSite(page, '/pulls', { html: sitePage() });
  const bar = page.locator(BALANCE).locator('..');
  await expect(bar.getByRole('button', { name: 'Paramètres WikiMasters' })).toBeVisible();
  await expect(bar.locator('.wm-notifications-bell')).toBeVisible();
  return bar;
}

const center = async (locator: Locator) => {
  const box = await rect(locator);
  return box.y + box.height / 2;
};

/** Marges du cadre en haut et à droite de la fenêtre. */
async function margins(page: Page, bar: Locator): Promise<{ top: number; right: number }> {
  const box = await rect(bar);
  const width = await page.evaluate(() => document.documentElement.clientWidth);
  return { top: Math.round(box.y), right: Math.round(width - box.x - box.width) };
}

test('ordinateur : solde, cloche et engrenage sur un fond foncé arrondi, même marge en haut et à droite', async ({ page }) => {
  const bar = await openBar(page);
  await expect(bar).toHaveCSS('border-top-left-radius', '9999px');
  await expect(bar).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.7)');
  await expect(bar).toHaveCSS('backdrop-filter', 'blur(8px)');
  expect(await margins(page, bar)).toEqual({ top: 12, right: 12 });

  // Alignés au milieu du fond, à 6 px de ses bords : 30 px de boutons, 42 px de fond.
  const box = await rect(bar);
  expect(Math.round(box.height)).toBe(42);
  const middle = box.y + box.height / 2;
  const gear = bar.getByRole('button', { name: 'Paramètres WikiMasters' });
  const bell = bar.locator('.wm-notifications-bell');
  const balance = page.locator(BALANCE);
  for (const item of [gear, bell, balance]) expect(await center(item)).toBeCloseTo(middle, 0);
  expect(Math.round((await rect(gear)).x - box.x)).toBe(6);
  const right = await rect(balance);
  expect(Math.round(box.x + box.width - right.x - right.width)).toBe(6);
});

test('un clic sur le fond, entre deux boutons, ne traverse pas jusqu’à la page', async ({ page }) => {
  const bar = await openBar(page);
  const gear = await rect(bar.getByRole('button', { name: 'Paramètres WikiMasters' }));
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.tagName, [gear.x + gear.width + 2, gear.y + gear.height / 2]);
  expect(hit).toBe('DIV');
});

test('mobile : la rangée de la barre réduite à son contenu, même marge en haut et à droite', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 });
  const bar = await openBar(page);
  await expect(bar).toHaveClass(/h-11/);
  await expect(bar).toHaveCSS('border-top-left-radius', '9999px');
  expect(await margins(page, bar)).toEqual({ top: 6, right: 6 });
  const box = await rect(bar);
  // Dépasse à peine de la barre du site (44 px).
  expect(Math.round(box.y + box.height)).toBe(48);
  // La boîte ordinateur reste cachée.
  await expect(page.locator('button[aria-label="Ouvrir la boutique WikiBidous"]')).toHaveCount(2);
  await expect(page.locator(BALANCE)).toHaveCount(1);
});
