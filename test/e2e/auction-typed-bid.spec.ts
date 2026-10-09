import { expect, test, type Page } from '@playwright/test';
import { expectDomIdle, nextFrame, openSite, presetSettings, sitePage } from './support/site';

const AUCTION = '44066a16-2aec-447e-98a4-5186f3d3e32a';

/**
 * Formulaire de mise de la page d'une enchère (capture et code du site du 01/10/2026) : champ contrôlé comme celui
 * de React (la valeur affichée est celle de l'état ; la frappe la change), « Diminuer » arrêté à la mise minimum.
 * Le site y réécrit sa mise minimum : `window.site.bid(montant)` (mise reçue en direct, minimum suivant :
 * `max(⌈1,1 × montant⌉, montant + 1)`, en flottants : 221 après 200), `refresh()` (enchère relue, même minimum),
 * `tooLow(minimum)` (refus `bid_too_low` : le minimum du refus, sans relire l'enchère).
 */
const HTML = sitePage(
  '<div id="auction"></div>',
  `
  let min = 165;
  let value = '165';
  const frame = kit.el('div', 'card-frame p-4 space-y-3');
  const minLabel = kit.el('span');
  const field = kit.el('div', 'relative flex items-stretch rounded-lg overflow-hidden flex-1');
  const input = kit.el('input', 'flex-1 min-w-0 px-3 py-2.5 bg-transparent outline-none text-sm tabular-nums text-center');
  input.type = 'number';
  input.step = '1';
  input.setAttribute('inputmode', 'numeric');
  input.setAttribute('aria-label', 'Montant de la mise');
  const step = (label, delta) => {
    const button = kit.button('flex items-center justify-center px-2.5', label === 'Diminuer' ? '−' : '+', () => {
      value = String(Math.max(min, Number(value) + delta));
      render();
    });
    button.type = 'button';
    button.tabIndex = -1;
    button.setAttribute('aria-label', label);
    return button;
  };
  const minus = step('Diminuer', -1);
  field.append(minus, input, step('Augmenter', 1));
  const row = kit.el('div', 'flex gap-2');
  row.append(field, kit.button('px-5 py-2.5 rounded-lg text-sm font-semibold', 'Miser'));
  frame.append(minLabel, row);
  document.getElementById('auction').append(frame);
  function render() {
    minLabel.textContent = 'Mise minimum : ' + min;
    input.min = String(min);
    if (input.value !== value) input.value = value;
    minus.disabled = Number(value) <= min;
  }
  input.addEventListener('input', () => { value = input.value; render(); });
  const next = (amount) => Math.max(Math.ceil(1.1 * amount), amount + 1);
  window.site = {
    bid(amount) { min = next(amount); value = String(min); render(); },
    refresh() { value = String(min); render(); },
    tooLow(floor) { value = String(floor); render(); },
  };
  render();
  `,
);

type Site = Record<'bid' | 'refresh' | 'tooLow', (amount?: number) => void>;

const site = (page: Page, action: keyof Site, amount?: number) =>
  page.evaluate(([name, value]) => (window as unknown as { site: Site }).site[name](value), [action, amount] as const);

async function openAuction(page: Page) {
  await openSite(page, `/marketplace/${AUCTION}`, { html: HTML });
  const input = page.getByRole('spinbutton', { name: 'Montant de la mise' });
  await expect(input).toHaveValue('165');
  return input;
}

test('nouvelle mise sous le montant saisi : il reste, focus compris ; au-dessus : la mise minimum le remplace', async ({ page }) => {
  const input = await openAuction(page);
  await input.fill('300');
  await site(page, 'bid', 200);
  await nextFrame(page);
  await expect(page.getByText('Mise minimum : 221')).toBeVisible();
  await expect(input).toHaveValue('300');
  await expect(input).toBeFocused();

  await site(page, 'bid', 300);
  await expect(input).toHaveValue('330');
  // Remplacé par le site : sa valeur suit de nouveau sa mise minimum.
  await site(page, 'bid', 331);
  await expect(input).toHaveValue('365');
  await expectDomIdle(page);
});

test('montant saisi égal à la nouvelle mise minimum : il reste', async ({ page }) => {
  const input = await openAuction(page);
  await input.fill('221');
  await site(page, 'bid', 200);
  await nextFrame(page);
  await expect(input).toHaveValue('221');
});

test('enchère relue (temps réel rejoint, fin du compte à rebours) : le montant saisi reste', async ({ page }) => {
  const input = await openAuction(page);
  await input.fill('250');
  await site(page, 'refresh');
  await nextFrame(page);
  await expect(input).toHaveValue('250');
});

test('refus « mise trop basse » avec un minimum plus haut que celui affiché : le minimum du refus le remplace', async ({ page }) => {
  const input = await openAuction(page);
  await input.fill('300');
  await site(page, 'tooLow', 400);
  await expect(input).toHaveValue('400');
});

test('montant choisi aux boutons du champ : gardé comme un montant tapé', async ({ page }) => {
  const input = await openAuction(page);
  const plus = page.getByRole('button', { name: 'Augmenter' });
  await plus.click();
  await plus.click();
  await expect(input).toHaveValue('167');
  await nextFrame(page);
  await site(page, 'refresh');
  await nextFrame(page);
  await expect(input).toHaveValue('167');
});

test('champ laissé tel quel : la mise minimum du site le suit', async ({ page }) => {
  const input = await openAuction(page);
  await site(page, 'bid', 200);
  await expect(input).toHaveValue('221');
});

test('désactivée : le site remplace le montant saisi comme d’habitude', async ({ page }) => {
  await presetSettings(page, { features: { 'auction-typed-bid': false }, values: {} });
  const input = await openAuction(page);
  await input.fill('300');
  await site(page, 'bid', 200);
  await expect(input).toHaveValue('221');
});
