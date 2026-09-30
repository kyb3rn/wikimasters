import { expect, test, type Locator, type Page } from '@playwright/test';
import { openFriendsPage } from './support/friends';

const friendRows = (page: Page) => page.locator('#friends-section > [data-friend]');
const row = (page: Page, name: string) => page.locator(`[data-friend="${name}"]`);
const confirmDialog = (page: Page) => page.getByRole('alertdialog', { name: 'Retirer cet ami ?' });

/** Lignes sur la première rangée de la grille, et largeur d'une ligne. */
async function columns(rows: Locator): Promise<{ count: number; width: number }> {
  const boxes = await rows.evaluateAll((all) => all.map((el) => el.getBoundingClientRect()));
  const first = boxes[0];
  if (!first) throw new Error('aucune ligne affichée');
  return { count: boxes.filter((box) => Math.abs(box.top - first.top) < 1).length, width: first.width };
}

test('liste des amis : trois colonnes tant que chaque ami a 510 px, puis deux, puis une seule', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await openFriendsPage(page);
  await expect(friendRows(page)).toHaveCount(4);
  await expect.poll(async () => (await columns(friendRows(page))).count).toBe(3);
  expect((await columns(friendRows(page))).width).toBeGreaterThanOrEqual(510);

  await page.setViewportSize({ width: 1200, height: 900 });
  await expect.poll(async () => (await columns(friendRows(page))).count).toBe(2);

  await page.setViewportSize({ width: 900, height: 900 });
  await expect.poll(async () => (await columns(friendRows(page))).count).toBe(1);
  const section = await page.locator('#friends-section').boundingBox();
  expect((await columns(friendRows(page))).width).toBeCloseTo(section?.width ?? 0, 0);

  // Titre et recherche sur toute la largeur.
  const search = await page.locator('#friends-section > .relative').boundingBox();
  expect(search?.width).toBeCloseTo(section?.width ?? 0, 0);
});

test('demandes en attente en colonnes, comme les amis ; titres et « Tout accepter » sur toute la largeur', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await openFriendsPage(page);
  const sent = page.locator('#sent-section > [data-request]');
  const received = page.locator('#incoming-section > [data-incoming]');
  await expect(sent).toHaveCount(3);
  await expect(received).toHaveCount(2);
  await expect.poll(async () => (await columns(sent)).count).toBe(3);
  await expect.poll(async () => (await columns(received)).count).toBe(2);
  expect((await columns(received)).width).toBeCloseTo((await columns(friendRows(page))).width, 0);
  const section = await page.locator('#incoming-section').boundingBox();
  const header = await page.locator('#incoming-section > div').first().boundingBox();
  expect(header?.width).toBeCloseTo(section?.width ?? 0, 0);

  await page.setViewportSize({ width: 1200, height: 900 });
  await expect.poll(async () => (await columns(sent)).count).toBe(2);
  await page.setViewportSize({ width: 900, height: 900 });
  await expect.poll(async () => (await columns(sent)).count).toBe(1);
});

test('une fenêtre ouverte depuis une ligne ne décale pas la grille', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await openFriendsPage(page);
  const before = await friendRows(page).evaluateAll((rows) => rows.map((el) => el.getBoundingClientRect().left));
  await row(page, 'aelonka').getByRole('button', { name: 'Message' }).click();
  await expect(page.locator('.site-dm')).toHaveCount(1);
  expect(await friendRows(page).evaluateAll((rows) => rows.map((el) => el.getBoundingClientRect().left))).toEqual(before);
});

test('Inviter et « Ajouter un ami » à droite, la recherche réduite à gauche ; ils déclenchent ceux du site', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await openFriendsPage(page);
  const box = page.locator('#friends-section > .relative');
  const invite = box.getByRole('button', { name: 'Inviter' });
  const add = box.getByRole('button', { name: '+ Ajouter un ami' });
  await expect(invite).toBeVisible();
  await expect(add).toBeVisible();
  await expect(page.locator('#site-header-actions')).toBeHidden();
  // Le bouton du site est renommé lui aussi (il reste dans l'en-tête quand la page n'a pas de recherche).
  await expect(page.locator('#site-add')).toHaveText('+ Ajouter un ami');

  // Mesures prises dans la même image : la page peut encore bouger d'un pixel (boutons du site rhabillés au-dessus).
  const [frame, field, inviteBox, addBox] = await page.evaluate(() => {
    const rect = (element: Element | null | undefined) => {
      if (!element) throw new Error('recherche introuvable');
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    };
    const search = document.querySelector('#friends-section > .relative');
    const buttons = [...(search?.querySelectorAll('button') ?? [])];
    return [
      rect(search),
      rect(document.getElementById('friend-list-search')),
      rect(buttons.find((button) => button.textContent?.includes('Inviter'))),
      rect(buttons.find((button) => button.textContent?.includes('Ajouter un ami'))),
    ];
  });
  expect(field.x).toBeCloseTo(frame.x, 0);
  expect(field.width).toBeLessThanOrEqual(400.5);
  expect(addBox.x + addBox.width).toBeCloseTo(frame.x + frame.width, 0);
  expect(inviteBox.x).toBeGreaterThan(field.x + field.width + 100);
  expect(inviteBox.y).toBeCloseTo(field.y, 0);
  // Croix d'effacement du site : dans le champ, à sa droite.
  const clear = await page.locator('#site-clear').boundingBox();
  expect(clear && clear.x + clear.width).toBeLessThanOrEqual(field.x + field.width);
  expect(clear && clear.x).toBeGreaterThan(field.x + field.width - 40);

  await add.click();
  await invite.click();
  expect(await page.evaluate(() => (window as unknown as { __friends: { clicks: object } }).__friends.clicks)).toMatchObject({
    invite: 1,
    add: 1,
  });
  await expect(box.getByRole('button', { name: 'Copié !' })).toBeVisible();
  await expect(box.getByRole('button', { name: 'Inviter' })).toBeVisible({ timeout: 4000 });
});

test('au repos, le script ne resynchronise plus la page', async ({ page }) => {
  await openFriendsPage(page);
  await expect(page.getByRole('button', { name: '+ Ajouter un ami' })).toBeVisible();
  await expect(row(page, 'AlakazM').getByRole('button', { name: 'Retirer des amis' })).toBeVisible();
  const domSyncs = () => page.evaluate(() => window.wm?.debug?.domSyncs() ?? -1);
  await page.waitForTimeout(300);
  const before = await domSyncs();
  await page.waitForTimeout(600);
  expect(await domSyncs()).toBe(before);
});

test('mobile : les boutons passent sous la recherche, à droite', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 800 });
  await openFriendsPage(page);
  const field = await page.locator('#friend-list-search').boundingBox();
  const add = await page.getByRole('button', { name: '+ Ajouter un ami' }).boundingBox();
  const frame = await page.locator('#friends-section > .relative').boundingBox();
  if (!field || !add || !frame) throw new Error('recherche introuvable');
  expect(field.width).toBeCloseTo(frame.width, 0);
  expect(add.y).toBeGreaterThan(field.y + field.height);
  expect(add.x + add.width).toBeCloseTo(frame.x + frame.width, 0);
});

test('Message (bleu) et Échanger (vert) : boutons standard en contour, qui déclenchent ceux du site (cachés)', async ({ page }) => {
  await openFriendsPage(page);
  const friend = row(page, 'Poloz30');
  await expect(friend.locator('.site-message')).toBeHidden();
  await expect(friend.locator('.site-trade')).toBeHidden();
  const message = friend.getByRole('button', { name: 'Message' });
  const trade = friend.getByRole('button', { name: 'Échanger' });
  await expect(message).toHaveClass(/wm-tone-info/);
  await expect(trade).toHaveClass(/wm-tone-accent/);
  await expect(message).not.toHaveClass(/wm-solid|wm-ghost/);
  await expect(trade).not.toHaveClass(/wm-solid|wm-ghost/);
  await expect(message).toHaveAttribute('title', 'Envoyer un message');
  // Le site ouvre la conversation par-dessus la page : Échanger d'abord.
  await trade.click();
  await message.click();
  expect(await page.evaluate(() => (window as unknown as { __friends: { clicks: object } }).__friends.clicks)).toMatchObject({
    message: ['Poloz30'],
    trade: ['Poloz30'],
  });
});

test('retirer un ami : confirmation, puis la ligne et le compte suivent sans recharger', async ({ page }) => {
  const server = await openFriendsPage(page);
  const loadedAt = await page.evaluate(() => (window as unknown as { __loadedAt: number }).__loadedAt);
  const remove = row(page, 'Poloz30').getByRole('button', { name: 'Retirer des amis' });

  await remove.click();
  await expect(confirmDialog(page)).toContainText('Poloz30 ne fera plus partie de vos amis.');
  await confirmDialog(page).getByRole('button', { name: 'Annuler' }).click();
  await expect(confirmDialog(page)).toBeHidden();
  await remove.click();
  await expect(confirmDialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(confirmDialog(page)).toBeHidden();
  expect(server.deleted).toEqual([]);

  await remove.click();
  await confirmDialog(page).getByRole('button', { name: 'Retirer' }).click();
  await expect(confirmDialog(page)).toBeHidden();
  expect(server.deleted).toEqual(['f2']);
  await expect(row(page, 'Poloz30')).toHaveCount(0);
  await expect(friendRows(page)).toHaveCount(3);
  await expect(page.locator('#friends-section > h2')).toHaveText('Amis (3)');
  expect(await page.evaluate(() => (window as unknown as { __loadedAt: number }).__loadedAt)).toBe(loadedAt);
});

test('retirer un ami : roue pendant la requête ; refus du site en toast, ami gardé', async ({ page }) => {
  let release: () => void = () => {};
  const answered = new Promise<void>((resolve) => (release = resolve));
  await openFriendsPage(page, {
    remove: async (route) => {
      await answered;
      await route.fulfill({ status: 403, json: { error: 'Action impossible pour le moment' } });
    },
  });
  await row(page, 'aelonka').getByRole('button', { name: 'Retirer des amis' }).click();
  const confirm = confirmDialog(page).getByRole('button', { name: 'Retirer' });
  await confirm.click();
  await expect(confirm).toBeDisabled();
  await expect(confirm).toHaveAttribute('aria-busy', 'true');
  await expect(confirmDialog(page).getByRole('button', { name: 'Annuler' })).toBeDisabled();
  release();
  await expect(confirmDialog(page)).toBeHidden();
  await expect(page.getByRole('alert')).toContainText('Action impossible pour le moment');
  await expect(row(page, 'aelonka')).toHaveCount(1);
});

test('« Annuler » d’une demande envoyée : bouton rouge, roue jusqu’à la relecture de la liste', async ({ page }) => {
  let release: () => void = () => {};
  const answered = new Promise<void>((resolve) => (release = resolve));
  const server = await openFriendsPage(page, {
    remove: async (route, id) => {
      await answered;
      const index = server.friendships.findIndex((f) => f.id === id);
      if (index >= 0) server.friendships.splice(index, 1);
      await route.fulfill({ json: { success: true } });
    },
  });
  const request = page.locator('[data-request="Goatman!"]');
  await expect(request.locator('.site-cancel')).toBeHidden();
  const cancel = request.getByRole('button', { name: 'Annuler' });
  await expect(cancel).toHaveClass(/wm-tone-danger/);
  await cancel.click();
  await expect(cancel).toBeDisabled();
  await expect(cancel).toHaveAttribute('aria-busy', 'true');
  release();
  await expect(request).toHaveCount(0);
  expect(server.deleted).toEqual(['s1']);
});
