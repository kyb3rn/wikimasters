import { expect, test, type Page, type Route } from '@playwright/test';
import { expectDomIdle, openSite, sitePage } from './support/site';

/**
 * /guild sans guilde (code du 01/10/2026) : carte « Vous n'êtes dans aucune guilde », que React remplace au clic par
 * son formulaire « Créer une guilde » (ici `#site-form`, qui ne doit jamais s'ouvrir). Après une création, le site
 * relit sa guilde par le chargeur de la page (`useCallback`, imité dans l'état du composant), qui remplace la carte.
 * Avec `?sans-chargeur`, l'état de la page ne l'a pas.
 */
const SCRIPT = `
const page = document.querySelector('#page');
const card = document.createElement('div');
card.className = 'card-frame p-8 text-center space-y-6 animate-fade-in-up';
card.innerHTML = '<div class="space-y-2"><div class="flex justify-center"><svg class="lucide lucide-castle size-14"></svg></div>'
  + '<p class="text-lg font-semibold">Vous n\\'êtes dans aucune guilde</p></div>'
  + '<button class="px-6 py-3 rounded-xl bg-[var(--color-accent)] text-[var(--color-accent-foreground)] font-semibold">Créer une guilde</button>';
card.querySelector('button').addEventListener('click', () => {
  card.remove();
  page.insertAdjacentHTML('beforeend', '<div id="site-form" class="card-frame p-6 space-y-4">Formulaire du site</div>');
});
page.append(card);
const loadGuild = async (options) => {
  const response = await fetch("/api/guilds");
  if (!response.ok) return;
  const body = await response.json();
  if (!body.guild) return;
  card.remove();
  page.insertAdjacentHTML('beforeend', '<h1 id="guild-home">' + body.guild.name + (options?.seedHome ? ' (accueil)' : '') + '</h1>');
};
if (!location.search.includes('sans-chargeur')) {
  const [first] = kit.chain([{ memoizedState: false, queue: { dispatch() {} } }, { memoizedState: [loadGuild, []], queue: null }]);
  kit.fiber(card, {}, kit.fiber(null, {}, null, { memoizedState: first }));
}
`;

const HTML = sitePage('<div id="page" class="flex-1 p-4 md:p-6 space-y-6"><h1>Guildes</h1></div>', SCRIPT);

type Reply = (route: Route) => Promise<void>;

/**
 * Page /guild dont les créations reçoivent, dans l'ordre, les réponses données (sinon la guilde est créée) ; corps
 * des créations et nombre de chargements de la page relevés.
 */
async function openGuild(page: Page, replies: Reply[] = [], path = '/guild') {
  const bodies: unknown[] = [];
  const loads = { count: 0 };
  let created: string | undefined;
  await openSite(page, path, {
    html: HTML,
    handle: async (route, url) => {
      if (route.request().resourceType() === 'document') loads.count++;
      if (url.pathname !== '/api/guilds') return false;
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: { guild: created ? { id: 'g1', name: created } : null, membership: null, member_count: 1, home: null } });
        return true;
      }
      const body = route.request().postDataJSON() as { name: string };
      bodies.push(body);
      const reply = replies.shift();
      if (reply) {
        await reply(route);
        return true;
      }
      created = body.name;
      await route.fulfill({ json: { guild: { id: 'g1', name: body.name } } });
      return true;
    },
  });
  await expect(page.getByRole('button', { name: 'Créer une guilde' })).toBeVisible();
  return { bodies, loads };
}

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Créer une guilde' });
const nameField = (page: Page) => dialog(page).getByPlaceholder('Les Conquérants');
const descriptionField = (page: Page) => dialog(page).getByPlaceholder('Décrivez votre guilde…');

async function openModal(page: Page) {
  await page.getByRole('button', { name: 'Créer une guilde' }).click();
  await expect(dialog(page)).toBeVisible();
}

test('« Créer une guilde » ouvre notre fenêtre par-dessus la page, sans le formulaire du site', async ({ page }) => {
  await openGuild(page);
  await openModal(page);
  await expect(page.locator('#site-form')).toHaveCount(0);
  await expect(page.locator('main')).toContainText("Vous n'êtes dans aucune guilde");
  await expect(nameField(page)).toBeFocused();
  // Champs standard (`textField`).
  await expect(nameField(page)).toHaveClass(/(^| )py-2\.5( |$)/);
  await expect(descriptionField(page)).toHaveClass(/(^| )py-2\.5( |$)/);
});

test('bouton actif à partir de 2 caractères, compteurs', async ({ page }) => {
  await openGuild(page);
  await openModal(page);
  const submit = dialog(page).getByRole('button', { name: 'Créer la guilde' });
  await expect(submit).toBeDisabled();
  await nameField(page).fill('L');
  await expect(submit).toBeDisabled();
  await nameField(page).fill('Les Conquérants');
  await descriptionField(page).fill('Une description');
  await expect(dialog(page)).toContainText('15/30');
  await expect(dialog(page)).toContainText('15/200');
  await expect(submit).toBeEnabled();
});

test('erreur du site dans la fenêtre, puis création : fenêtre fermée, guilde relue par le site', async ({ page }) => {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  const { bodies } = await openGuild(page, [
    async (route) => {
      await held;
      await route.fulfill({ status: 400, json: { error: 'Ce nom de guilde est déjà pris' } });
    },
  ]);
  await openModal(page);
  await nameField(page).fill('  Les Conquérants ');
  await descriptionField(page).fill('Une description');
  const submit = dialog(page).getByRole('button', { name: 'Créer la guilde' });
  await submit.click();
  // Pendant la requête : roue, tout désactivé, la fenêtre ne se ferme pas.
  await expect(submit).toBeDisabled();
  await expect(submit).toHaveAttribute('aria-busy', 'true');
  await expect(nameField(page)).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeVisible();
  release();
  await expect(dialog(page)).toContainText('Ce nom de guilde est déjà pris');
  await expect(submit).toBeEnabled();
  // Le nom reprend le focus : Entrée relance la création.
  await expect(nameField(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#guild-home')).toHaveText('Les Conquérants (accueil)');
  await expect(dialog(page)).toBeHidden();
  await expect(page.locator('#site-form')).toHaveCount(0);
  expect(bodies).toEqual([
    { name: 'Les Conquérants', description: 'Une description' },
    { name: 'Les Conquérants', description: 'Une description' },
  ]);
});

test('description vide : absente de la requête', async ({ page }) => {
  const { bodies } = await openGuild(page);
  await openModal(page);
  await nameField(page).fill('Les Conquérants');
  await descriptionField(page).fill('   ');
  await dialog(page).getByRole('button', { name: 'Créer la guilde' }).click();
  await expect(page.locator('#guild-home')).toBeVisible();
  expect(bodies).toEqual([{ name: 'Les Conquérants' }]);
});

test('requête sans réponse : message dans la fenêtre', async ({ page }) => {
  await openGuild(page, [(route) => route.abort()]);
  await openModal(page);
  await nameField(page).fill('Les Conquérants');
  await dialog(page).getByRole('button', { name: 'Créer la guilde' }).click();
  await expect(dialog(page)).toContainText("Le site n'a pas répondu (erreur réseau).");
});

test('chargeur de la guilde introuvable : la page est rechargée après la création', async ({ page }) => {
  const { loads } = await openGuild(page, [], '/guild?sans-chargeur');
  await openModal(page);
  await nameField(page).fill('Les Conquérants');
  await dialog(page).getByRole('button', { name: 'Créer la guilde' }).click();
  await expect.poll(() => loads.count).toBe(2);
});

for (const [label, close] of [
  ['la croix', (page: Page) => dialog(page).getByRole('button', { name: 'Fermer' }).click()],
  ['Échap', (page: Page) => page.keyboard.press('Escape')],
] as const) {
  test(`fermée par ${label} : la page n'a pas bougé, valeurs gardées`, async ({ page }) => {
    await openGuild(page);
    await openModal(page);
    await nameField(page).fill('Mes amis');
    await close(page);
    await expect(dialog(page)).toBeHidden();
    await expect(page.locator('#site-form')).toHaveCount(0);
    await expect(page.locator('main')).toContainText("Vous n'êtes dans aucune guilde");
    await openModal(page);
    await expect(nameField(page)).toHaveValue('Mes amis');
  });
}

test('au repos, fenêtre ouverte, le script ne touche plus à la page', async ({ page }) => {
  await openGuild(page);
  await openModal(page);
  await expectDomIdle(page);
});
