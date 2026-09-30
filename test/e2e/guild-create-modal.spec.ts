import { expect, test, type Page, type Route } from '@playwright/test';
import { openSite, sitePage } from './support/site';

/**
 * /guild sans guilde (code du 30/09/2026) : carte « Vous n'êtes dans aucune guilde », remplacée au clic par le
 * formulaire « Créer une guilde » (mêmes classes). Comme React : les valeurs saisies restent après « Annuler », le
 * bouton est désactivé tant que le nom a moins de 2 caractères ou pendant la requête (« Création… »), l'erreur de
 * l'API s'affiche au-dessus du bouton, une requête sans réponse ne montre rien.
 */
const SCRIPT = `
const page = document.querySelector('#page');
const card = document.createElement('div');
card.className = 'card-frame p-8 text-center space-y-6 animate-fade-in-up';
card.innerHTML = '<div class="space-y-2"><div class="flex justify-center"><svg class="lucide lucide-castle size-14"></svg></div>'
  + '<p class="text-lg font-semibold">Vous n\\'êtes dans aucune guilde</p></div>'
  + '<button class="px-6 py-3 rounded-xl bg-[var(--color-accent)] text-[var(--color-accent-foreground)] font-semibold">Créer une guilde</button>';
const form = document.createElement('div');
form.className = 'card-frame p-6 space-y-4 animate-fade-in-up';
form.innerHTML = '<div class="flex items-center justify-between"><h2 class="text-lg font-semibold">Créer une guilde</h2>'
  + '<button class="text-sm text-[var(--color-foreground)]/40">Annuler</button></div>'
  + '<div class="space-y-3"><div><label>Nom de la guilde</label><input id="site-name" maxlength="30" class="w-full mt-1 px-3 py-2 rounded-xl border" type="text"><p id="name-count">0/30</p></div>'
  + '<div><label>Description (optionnel)</label><textarea id="site-description" maxlength="200" rows="3"></textarea><p>0/200</p></div></div>'
  + '<button id="site-submit" disabled class="w-full py-3 rounded-xl bg-[var(--color-accent)] font-semibold">Créer la guilde</button>';
const [nameInput, submit] = [form.querySelector('input'), form.querySelector('#site-submit')];
let sending = false;
const sync = () => {
  form.querySelector('#name-count').textContent = nameInput.value.length + '/30';
  submit.disabled = sending || nameInput.value.trim().length < 2;
  submit.textContent = sending ? 'Création…' : 'Créer la guilde';
};
nameInput.addEventListener('input', sync);
page.append(card);
card.querySelector('button').addEventListener('click', () => { card.remove(); page.append(form); });
form.querySelector('h2 + button').addEventListener('click', () => {
  form.querySelector(':scope > p')?.remove();
  form.remove();
  page.append(card);
});
submit.addEventListener('click', async () => {
  form.querySelector(':scope > p')?.remove();
  sending = true; sync();
  try {
    const response = await fetch('/api/guilds', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameInput.value.trim(), description: form.querySelector('textarea').value.trim() || undefined }) });
    const body = await response.json();
    if (!response.ok) {
      const error = document.createElement('p');
      error.className = 'text-sm text-red-400';
      error.textContent = body.error;
      submit.before(error);
      return;
    }
    form.remove();
    page.insertAdjacentHTML('beforeend', '<h1 id="guild-home">' + body.guild.name + '</h1>');
  } finally { sending = false; sync(); }
});
`;

const HTML = sitePage('<div id="page" class="flex-1 p-4 md:p-6 space-y-6"><h1>Guildes</h1></div>', SCRIPT);

type Reply = (route: Route) => Promise<void>;

/** Page /guild dont les créations reçoivent, dans l'ordre, les réponses données ; corps des requêtes relevés. */
async function openGuild(page: Page, replies: Reply[] = []) {
  const bodies: unknown[] = [];
  await openSite(page, '/guild', {
    html: HTML,
    handle: async (route, url) => {
      if (url.pathname !== '/api/guilds' || route.request().method() !== 'POST') return false;
      bodies.push(route.request().postDataJSON());
      const reply = replies.shift();
      if (reply) await reply(route);
      else await route.fulfill({ json: { guild: { name: 'Les Conquérants' } } });
      return true;
    },
  });
  await expect(page.getByRole('button', { name: 'Créer une guilde' })).toBeVisible();
  return bodies;
}

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Créer une guilde' });

async function openModal(page: Page) {
  await page.getByRole('button', { name: 'Créer une guilde' }).click();
  await expect(dialog(page)).toBeVisible();
}

test('« Créer une guilde » : le formulaire s’ouvre en fenêtre, la page reste derrière', async ({ page }) => {
  await openGuild(page);
  await openModal(page);
  // Formulaire du site caché, copie inerte de la carte à sa place.
  await expect(page.locator('#site-submit')).toBeHidden();
  const copy = page.locator('.wm-guild-card-copy');
  await expect(copy).toBeVisible();
  await expect(copy).toContainText("Vous n'êtes dans aucune guilde");
  await expect(dialog(page).getByPlaceholder('Les Conquérants')).toBeFocused();
});

test('les champs écrivent dans le formulaire du site ; bouton actif à partir de 2 caractères', async ({ page }) => {
  await openGuild(page);
  await openModal(page);
  const submit = dialog(page).getByRole('button', { name: 'Créer la guilde' });
  await expect(submit).toBeDisabled();
  await dialog(page).getByPlaceholder('Les Conquérants').fill('L');
  await expect(submit).toBeDisabled();
  await dialog(page).getByPlaceholder('Les Conquérants').fill('Les Conquérants');
  await dialog(page).getByPlaceholder('Décrivez votre guilde…').fill('Une description');
  await expect(dialog(page)).toContainText('15/30');
  await expect(dialog(page)).toContainText('15/200');
  await expect(page.locator('#site-name')).toHaveValue('Les Conquérants');
  await expect(page.locator('#site-description')).toHaveValue('Une description');
  await expect(submit).toBeEnabled();
});

test('erreur du site dans la fenêtre, puis création : fenêtre fermée, guilde affichée', async ({ page }) => {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  const bodies = await openGuild(page, [
    async (route) => {
      await held;
      await route.fulfill({ status: 400, json: { error: 'Ce nom de guilde est déjà pris' } });
    },
  ]);
  await openModal(page);
  await dialog(page).getByPlaceholder('Les Conquérants').fill('Les Conquérants');
  await dialog(page).getByPlaceholder('Décrivez votre guilde…').fill('Une description');
  const submit = dialog(page).getByRole('button', { name: 'Créer la guilde' });
  await submit.click();
  // Pendant la requête : roue, tout désactivé, la fenêtre ne se ferme pas.
  await expect(submit).toBeDisabled();
  await expect(submit).toHaveAttribute('aria-busy', 'true');
  await expect(dialog(page).getByPlaceholder('Les Conquérants')).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeVisible();
  release();
  await expect(dialog(page)).toContainText('Ce nom de guilde est déjà pris');
  await expect(submit).toBeEnabled();
  // Le nom reprend le focus : Entrée relance la création.
  await expect(dialog(page).getByPlaceholder('Les Conquérants')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#guild-home')).toHaveText('Les Conquérants');
  await expect(dialog(page)).toBeHidden();
  await expect(page.locator('.wm-guild-card-copy')).toHaveCount(0);
  expect(bodies).toEqual([
    { name: 'Les Conquérants', description: 'Une description' },
    { name: 'Les Conquérants', description: 'Une description' },
  ]);
});

test('requête sans réponse : message dans la fenêtre', async ({ page }) => {
  await openGuild(page, [(route) => route.abort()]);
  await openModal(page);
  await dialog(page).getByPlaceholder('Les Conquérants').fill('Les Conquérants');
  await dialog(page).getByRole('button', { name: 'Créer la guilde' }).click();
  await expect(dialog(page)).toContainText('Le site n’a pas répondu. Réessayez.');
});

for (const [label, close] of [
  ['la croix', (page: Page) => dialog(page).getByRole('button', { name: 'Fermer' }).click()],
  ['Échap', (page: Page) => page.keyboard.press('Escape')],
] as const) {
  test(`fermée par ${label} : formulaire du site annulé, carte revenue, valeurs gardées`, async ({ page }) => {
    await openGuild(page);
    await openModal(page);
    await dialog(page).getByPlaceholder('Les Conquérants').fill('Mes amis');
    await close(page);
    await expect(dialog(page)).toBeHidden();
    await expect(page.locator('#site-submit')).toHaveCount(0);
    await expect(page.locator('.wm-guild-card-copy')).toHaveCount(0);
    await openModal(page);
    await expect(dialog(page).getByPlaceholder('Les Conquérants')).toHaveValue('Mes amis');
  });
}
