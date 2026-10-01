import { expect, test, type Locator, type Page } from '@playwright/test';
import { openFriendsPage } from './support/friends';
import { expectDomIdle, rect } from './support/site';

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
  const section = await rect(page.locator('#friends-section'));
  expect((await columns(friendRows(page))).width).toBeCloseTo(section.width, 0);

  // Titre et recherche sur toute la largeur.
  expect((await rect(page.locator('#friends-section > .relative'))).width).toBeCloseTo(section.width, 0);
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
  const section = await rect(page.locator('#incoming-section'));
  expect((await rect(page.locator('#incoming-section > div').first())).width).toBeCloseTo(section.width, 0);

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
  const clear = await rect(page.locator('#site-clear'));
  expect(clear.x + clear.width).toBeLessThanOrEqual(field.x + field.width);
  expect(clear.x).toBeGreaterThan(field.x + field.width - 40);

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
  await expectDomIdle(page);
});

test('mobile : les boutons passent sous la recherche, à droite', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 800 });
  await openFriendsPage(page);
  const field = await rect(page.locator('#friend-list-search'));
  const add = await rect(page.getByRole('button', { name: '+ Ajouter un ami' }));
  const frame = await rect(page.locator('#friends-section > .relative'));
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

test('« Annuler » d’une demande envoyée : bouton rouge, roue pendant la requête, demande retirée sans relecture', async ({ page }) => {
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
  await expect(page.locator('#sent-section > h2')).toHaveText('Demandes envoyées (2)');
  expect(server.deleted).toEqual(['s1']);
  // La relecture du site est servie par le script (la page de test a ses amitiés dès le départ).
  expect(server.listed).toBe(0);
});

test('demandes reçues : fond des autres lignes, Accepter (vert) et Refuser (rouge) en boutons standard comme « Annuler »', async ({ page }) => {
  await openFriendsPage(page);
  const request = page.locator('[data-incoming="Mastonin"]');
  await expect(request).toHaveClass(/wm-friends-incoming/);
  await expect(request.locator('.site-accept')).toBeHidden();
  await expect(request.locator('.site-decline')).toBeHidden();
  const accept = request.getByRole('button', { name: 'Accepter' });
  const decline = request.getByRole('button', { name: 'Refuser' });
  await expect(accept).toHaveClass(/wm-button-standard/);
  await expect(accept).toHaveClass(/wm-tone-accent/);
  await expect(decline).toHaveClass(/wm-tone-danger/);
  for (const button of [accept, decline]) {
    await expect(button).toHaveClass(/wm-button-md/);
    await expect(button).not.toHaveClass(/wm-solid|wm-ghost/);
  }
  const cancel = page.locator('[data-request="Goatman!"]').getByRole('button', { name: 'Annuler' });
  expect((await rect(accept)).height).toBeCloseTo((await rect(cancel)).height, 0);
});

test('Accepter : roue pendant la requête, Refuser désactivé ; l’ami rejoint la liste sans relecture', async ({ page }) => {
  let release: () => void = () => {};
  const answered = new Promise<void>((resolve) => (release = resolve));
  const server = await openFriendsPage(page, {
    answer: async (route, id) => {
      await answered;
      const index = server.friendships.findIndex((f) => f.id === id);
      const found = server.friendships[index];
      if (found) server.friendships[index] = { ...found, status: 'accepted' };
      await route.fulfill({ json: { status: 'accepted' } });
    },
  });
  const request = page.locator('[data-incoming="Mastonin"]');
  const accept = request.getByRole('button', { name: 'Accepter' });
  await accept.click();
  await expect(accept).toBeDisabled();
  await expect(accept).toHaveAttribute('aria-busy', 'true');
  await expect(request.getByRole('button', { name: 'Refuser' })).toBeDisabled();
  await expect(request.getByRole('button', { name: 'Refuser' })).toHaveAttribute('aria-busy', 'false');
  release();
  await expect(request).toHaveCount(0);
  await expect(row(page, 'Mastonin')).toHaveCount(1);
  await expect(page.locator('#friends-section > h2')).toHaveText('Amis (5)');
  await expect(page.locator('#incoming-section h2')).toHaveText('Demandes reçues (1)');
  expect(server.answered).toEqual([{ id: 'r1', action: 'accept' }]);
  expect(server.listed).toBe(0);
});

test('Refuser : refus du site en toast, la demande reste et ses boutons reviennent, sans relecture', async ({ page }) => {
  const server = await openFriendsPage(page, {
    answer: (route) => route.fulfill({ status: 403, json: { error: 'Demande introuvable' } }),
  });
  const request = page.locator('[data-incoming="el_lokomotiv"]');
  await request.getByRole('button', { name: 'Refuser' }).click();
  await expect(page.getByRole('alert')).toContainText('Demande introuvable');
  await expect(request.getByRole('button', { name: 'Refuser' })).toBeEnabled();
  await expect(request.getByRole('button', { name: 'Accepter' })).toBeEnabled();
  expect(server.answered).toEqual([{ id: 'r2', action: 'decline' }]);
  expect(server.listed).toBe(0);
});

test('Refuser sans réponse du site : erreur réseau en toast, la demande reste et ses boutons reviennent', async ({ page }) => {
  await openFriendsPage(page, { answer: (route) => route.abort() });
  const request = page.locator('[data-incoming="el_lokomotiv"]');
  await request.getByRole('button', { name: 'Refuser' }).click();
  await expect(page.getByRole('alert')).toContainText("Le site n'a pas répondu (erreur réseau).");
  await expect(request.getByRole('button', { name: 'Refuser' })).toBeEnabled();
  await expect(request.getByRole('button', { name: 'Accepter' })).toBeEnabled();
});

test('Refuser : la demande disparaît sans relecture', async ({ page }) => {
  const server = await openFriendsPage(page);
  await page.locator('[data-incoming="el_lokomotiv"]').getByRole('button', { name: 'Refuser' }).click();
  await expect(page.locator('[data-incoming="el_lokomotiv"]')).toHaveCount(0);
  await expect(page.locator('#incoming-section h2')).toHaveText('Demandes reçues (1)');
  await expect(friendRows(page)).toHaveCount(4);
  expect(server.answered).toEqual([{ id: 'r2', action: 'decline' }]);
  expect(server.listed).toBe(0);
});

test('« Tout accepter » : petit bouton vert, roue pendant la requête, demandes acceptées sans relecture', async ({ page }) => {
  let release: () => void = () => {};
  const answered = new Promise<void>((resolve) => (release = resolve));
  const server = await openFriendsPage(page, {
    acceptAll: async (route) => {
      await answered;
      for (const [index, f] of server.friendships.entries()) {
        if (f.status === 'pending' && f.addressee_id === 'me') server.friendships[index] = { ...f, status: 'accepted' };
      }
      await route.fulfill({ json: { success: true } });
    },
  });
  await expect(page.locator('#site-accept-all')).toBeHidden();
  const all = page.locator('#incoming-section').getByRole('button', { name: 'Tout accepter' });
  await expect(all).toHaveClass(/wm-button-sm/);
  await expect(all).toHaveClass(/wm-tone-accent/);
  await all.click();
  await expect(all).toBeDisabled();
  await expect(all).toHaveAttribute('aria-busy', 'true');
  release();
  await expect(all).toBeEnabled();
  await expect(page.locator('#incoming-section > [data-incoming]')).toHaveCount(0);
  await expect(friendRows(page)).toHaveCount(6);
  await expect(page.locator('#friends-section > h2')).toHaveText('Amis (6)');
  expect(server.listed).toBe(0);
});

test('« Ajouter » de la recherche de joueurs : la demande apparaît dans les demandes envoyées, sans relecture', async ({ page }) => {
  const server = await openFriendsPage(page);
  await expect(page.locator('#sent-section > [data-request]')).toHaveCount(3);
  await page.evaluate(() => (window as unknown as { __friends: { sendRequest: (q: string, id: string) => Promise<void> } }).__friends.sendRequest('zorg', 'u20'));
  await expect(page.locator('[data-request="Zorglub"]')).toHaveCount(1);
  await expect(page.locator('#sent-section > h2')).toHaveText('Demandes envoyées (4)');
  expect(server.listed).toBe(0);
});

test('« Ajouter » refusé : toast, rien d’ajouté, sans relecture', async ({ page }) => {
  const server = await openFriendsPage(page, {
    send: (route) => route.fulfill({ status: 400, json: { error: 'Demande déjà envoyée' } }),
  });
  await page.evaluate(() => (window as unknown as { __friends: { sendRequest: (q: string, id: string) => Promise<void> } }).__friends.sendRequest('zorg', 'u20'));
  await expect(page.getByRole('alert')).toContainText('Demande déjà envoyée');
  await expect(page.locator('#sent-section > [data-request]')).toHaveCount(3);
  expect(server.listed).toBe(0);
});

test('réponse de « Ajouter » illisible : la relecture du site part au réseau', async ({ page }) => {
  const server = await openFriendsPage(page, {
    send: async (route) => {
      server.friendships.push({ id: 's-u20', status: 'pending', requester_id: 'me', addressee_id: 'u20', addressee: { id: 'u20', username: 'Zorglub' } });
      await route.fulfill({ status: 201, json: { ok: true } });
    },
  });
  await page.evaluate(() => (window as unknown as { __friends: { sendRequest: (q: string, id: string) => Promise<void> } }).__friends.sendRequest('zorg', 'u20'));
  await expect(page.locator('[data-request="Zorglub"]')).toHaveCount(1);
  expect(server.listed).toBe(1);
});
