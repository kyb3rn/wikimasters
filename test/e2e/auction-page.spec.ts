import { expect, test } from '@playwright/test';
import { openSite, sitePage } from './support/site';

const AUCTION = '4196b6bd-8c8c-4d8f-ae1a-7fcdeeb982e3';

/**
 * Page d'une enchère (capture du 29/09/2026, code du site du 30/09) : carte et « Signaler l'image » dessous,
 * « Mis en vente par », « Meneur : », « Remportée par », historique des mises (« Joueur » : mise sans pseudo).
 * `window.bid(pseudo)` imite une mise reçue en temps réel (meneur changé sur place, ligne ajoutée en tête de
 * l'historique).
 */
const HTML = sitePage(
  `<div class="flex flex-col md:flex-row gap-6">
    <div class="flex-shrink-0 flex flex-col items-center gap-2">
      <div class="w-72 h-[420px] glow-sr relative rounded-2xl overflow-hidden" style="width:18rem;height:420px;position:relative;background:#555">
        <div class="absolute top-0 left-0 right-0 h-[45%] z-20" style="position:absolute;top:0;left:0;right:0;height:45%"></div>
        <h3>Alléluia</h3>
      </div>
      <div class="space-y-1.5 "><button type="button" aria-pressed="false" class="inline-flex items-center gap-1.5 text-xs"><svg class="lucide lucide-flag size-3.5"></svg>Signaler l'image</button></div>
    </div>
    <div class="flex-1 space-y-4">
      <h1>Alléluia</h1>
      <p class="text-sm mt-1">Mis en vente par <span class="text-[var(--color-accent)] font-medium">iftar</span></p>
      <p class="text-xs" id="leader">Meneur : <span class="text-[var(--color-foreground)]/80 font-medium">Vreeecht</span></p>
      <div class="card-frame p-4 text-sm" id="winner">Remportée par <span class="text-[var(--color-accent)] font-medium">evan_wiki</span> pour <span class="tabular-nums font-semibold">30</span> wikibidous.</div>
    </div>
  </div>
  <div class="space-y-3"><h2>Historique des mises (3)</h2><ul class="card-frame">
    <li class="flex items-center justify-between"><span class="text-[var(--color-foreground)]/80">Vreeecht</span><span>65</span></li>
    <li class="flex items-center justify-between"><span class="text-[var(--color-foreground)]/80">Latina_Wife</span><span>56</span></li>
    <li class="flex items-center justify-between" id="anonymous"><span class="text-[var(--color-foreground)]/80">Joueur</span><span>50</span></li>
  </ul></div>`,
  `window.reports = 0;
  document.querySelector('button[aria-pressed]').addEventListener('click', () => { window.reports++; });
  window.bid = (name) => {
    document.querySelector('#leader > span').firstChild.nodeValue = name;
    const li = document.querySelector('li').cloneNode(true);
    li.firstElementChild.textContent = name;
    document.querySelector('ul').prepend(li);
  };`,
);

test('page d’une enchère : vendeur, meneur et historique des mises mènent aux profils', async ({ page }) => {
  await openSite(page, `/marketplace/${AUCTION}`, { html: HTML });
  const main = page.locator('main');
  await expect(main.getByRole('link', { name: 'iftar' })).toHaveAttribute('href', '/profile/iftar');
  await expect(main.getByRole('link', { name: 'Vreeecht' })).toHaveCount(2);
  await expect(main.getByRole('link', { name: 'Latina_Wife' })).toHaveAttribute('href', '/profile/Latina_Wife');
  await expect(page.locator('#winner').getByRole('link', { name: 'evan_wiki' })).toHaveAttribute('href', '/profile/evan_wiki');
  await expect(page.locator('#winner')).toHaveText('Remportée par evan_wiki pour 30 wikibidous.', { useInnerText: true });
  // Mise sans pseudo : « Joueur » reste du texte.
  await expect(page.locator('#anonymous').getByRole('link')).toHaveCount(0);
  // Allure du pseudo du site reprise.
  await expect(main.getByRole('link', { name: 'iftar' })).toHaveClass(/font-medium/);
  await expect(page.locator('#leader')).toHaveText('Meneur : Vreeecht', { useInnerText: true });

  // Mise reçue : le meneur suit, la nouvelle ligne de l'historique a son lien.
  await page.evaluate(() => (window as unknown as { bid: (name: string) => void }).bid('eli!'));
  await expect(page.locator('#leader').getByRole('link')).toHaveAttribute('href', '/profile/eli!');
  await expect(page.locator('#leader')).toHaveText('Meneur : eli!', { useInnerText: true });
  await expect(page.locator('li').first().getByRole('link', { name: 'eli!' })).toBeVisible();

  await main.getByRole('link', { name: 'iftar' }).click();
  await expect(page).toHaveURL(/\/profile\/iftar$/);
});

test('page d’une enchère : « Signaler l’image » sur l’image de la carte', async ({ page }) => {
  await openSite(page, `/marketplace/${AUCTION}`, { html: HTML });
  const report = page.locator('.glow-sr .wm-report');
  await expect(report).toBeVisible();
  await expect(page.locator('div.space-y-1\\.5')).toBeHidden();

  const [button, image] = await Promise.all([report.boundingBox(), page.locator('.glow-sr > div').first().boundingBox()]);
  // En bas à droite de l'image.
  expect(button!.x + button!.width).toBeGreaterThan(image!.x + image!.width - 20);
  expect(button!.y + button!.height).toBeGreaterThan(image!.y + image!.height - 20);

  await report.click();
  expect(await page.evaluate(() => (window as unknown as { reports: number }).reports)).toBe(1);
});
