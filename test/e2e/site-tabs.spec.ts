import { expect, test, type Page } from '@playwright/test';
import { openSite, sitePage } from './support/site';

const ICON = '<svg class="lucide lucide-castle size-4" width="16" height="16" viewBox="0 0 24 24"></svg>';
const ACTIVE = 'bg-[var(--color-accent)] text-[var(--color-accent-foreground)]';
const IDLE = 'text-[var(--color-foreground)]/50 hover:text-[var(--color-foreground)]';

/** Menus de /guild (code du 30/09/2026) : sans guilde (Guilde · Classement), dans une guilde (quatre onglets). */
const bar = (barClass: string, tabClass: string, labels: string[]) =>
  `<div class="${barClass}">` +
  labels
    .map(
      (label, i) =>
        `<button type="button" class="${tabClass} ${i === 0 ? ACTIVE : IDLE}">` +
        `<span class="inline-flex items-center justify-center gap-1.5">${ICON}${label}</span></button>`,
    )
    .join('') +
  '</div>';
const WITHOUT_GUILD = bar(
  'flex gap-1 bg-[var(--color-surface-light)] rounded-xl p-1 animate-fade-in-up',
  'flex-1 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer',
  ['Guilde', 'Classement'],
);
const IN_GUILD = bar(
  'flex gap-1 bg-[var(--color-surface-light)] rounded-xl p-1 flex-shrink-0 overflow-x-auto',
  'flex-1 min-w-[4.5rem] py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer',
  ['Accueil', 'Chat', 'Membres (2)', 'Classement'],
);
/** Changement d'onglet comme React : les classes des deux onglets réécrites. */
const SWITCH = `document.addEventListener('click', (event) => {
  const tab = event.target.closest('.rounded-xl.p-1 > button');
  if (!tab) return;
  for (const other of tab.parentElement.children) other.className = other.className.replace(${JSON.stringify(ACTIVE)}, ${JSON.stringify(IDLE)});
  tab.className = tab.className.replace(${JSON.stringify(IDLE)}, ${JSON.stringify(ACTIVE)});
});`;
/** Thème du site et remise à zéro des bordures de Tailwind (le faux site ne l'a pas). */
const THEME =
  '<style>:root { --color-accent: rgb(34, 197, 94); --color-border: rgb(48, 54, 61); } button { border: 0 solid; }</style>';

async function openGuild(page: Page, html: string) {
  await openSite(page, '/guild', { html: sitePage(THEME + html, SWITCH) });
  await expect(page.locator('.rounded-xl.p-1')).toHaveClass(/wm-site-tabs/);
}

for (const [label, html, count] of [
  ['sans guilde', WITHOUT_GUILD, 2],
  ['dans une guilde', IN_GUILD, 4],
] as const) {
  test(`/guild, ${label} : onglets soulignés comme ceux du marché`, async ({ page }) => {
    await openGuild(page, html);
    const menu = page.locator('.rounded-xl.p-1');
    await expect(menu).toHaveCSS('border-bottom', '1px solid rgb(48, 54, 61)');
    await expect(menu).toHaveCSS('padding-top', '0px');
    await expect(menu).toHaveCSS('border-top-left-radius', '0px');
    const tabs = menu.locator('> button');
    await expect(tabs).toHaveCount(count);
    await expect(tabs.first()).toHaveCSS('border-bottom', '2px solid rgb(34, 197, 94)');
    await expect(tabs.first()).toHaveCSS('color', 'rgb(34, 197, 94)');
    await expect(tabs.first()).toHaveCSS('padding-top', '12px');
    await expect(tabs.nth(1)).toHaveCSS('border-bottom-width', '0px');
    await expect(tabs.nth(1)).toHaveCSS('padding-top', '12px');

    // Autre onglet choisi : le trait le suit.
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveCSS('border-bottom', '2px solid rgb(34, 197, 94)');
    await expect(tabs.first()).toHaveCSS('border-bottom-width', '0px');
  });
}

test('rangée de boutons ordinaire : pas touchée', async ({ page }) => {
  await openSite(page, '/guild', {
    html: sitePage(
      THEME +
        '<div id="row" class="flex gap-1 rounded-xl p-1"><button class="px-3 py-1.5 rounded-lg">Inviter</button>' +
        '<button class="px-3 py-1.5 rounded-lg">Modifier</button></div>' +
        WITHOUT_GUILD,
    ),
  });
  await expect(page.locator('.animate-fade-in-up')).toHaveClass(/wm-site-tabs/);
  await expect(page.locator('#row')).not.toHaveClass(/wm-site-tabs/);
});
