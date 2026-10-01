import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectDomIdle, openSite, sitePage } from './support/site';

/**
 * Conversation privée imitée d'après le code du site (29/09/2026) : modale en portail, messages groupés par jour,
 * une ligne `div.group.mb-1.5` par message (clé React = id), photo de l'interlocuteur à côté de ses messages, heure
 * sous la bulle, échanges en encarts. L'état React de la conversation (`messages`, avec `created_at`) est sur le
 * fiber de son composant. `window.renderChat(messages)` la (re)dessine comme le ferait React.
 */
interface Message {
  readonly id: string;
  readonly own: boolean;
  /** Secondes après 00:17:00 (UTC). */
  readonly at: number;
  readonly trade?: boolean;
}

const HTML = sitePage(
  `<h1>Messages</h1>`,
  `const iso = (seconds) => new Date(Date.UTC(2026, 8, 26, 0, 17, seconds)).toISOString();
  window.renderChat = (messages) => {
    const chat = { memoizedProps: { peer: { id: 'p1', username: 'aelonka' }, currentUserId: 'me', onClose() {} }, return: null,
      memoizedState: { memoizedState: true, queue: null, next: {
        memoizedState: messages.filter((m) => !m.trade).map((m) => ({ id: m.id, sender_id: m.own ? 'me' : 'p1', content: m.id, created_at: iso(m.at) })),
        queue: { dispatch() {} }, next: { memoizedState: [], queue: { dispatch() {} }, next: null } } } };
    let overlay = document.getElementById('chat');
    if (!overlay) {
      document.body.insertAdjacentHTML('beforeend',
        '<div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70" id="chat">' +
          '<div class="w-full sm:max-w-md flex flex-col card-frame overflow-hidden" style="width:448px">' +
            '<div class="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0">' +
              '<div class="w-9 h-9 rounded-full overflow-hidden"><span>AE</span></div>' +
              '<div class="flex-1 min-w-0"><p class="font-semibold text-sm truncate">aelonka</p></div>' +
              '<button class="p-1.5 rounded-lg" aria-label="Fermer"><svg class="w-4 h-4" viewBox="0 0 24 24"></svg></button>' +
            '</div>' +
            '<div class="flex-1 overflow-y-auto px-4 py-3 space-y-1" id="list"></div>' +
          '</div>' +
        '</div>');
      overlay = document.getElementById('chat');
    }
    const list = document.getElementById('list');
    list['__reactFiber$test'] = { memoizedProps: {}, return: chat };
    const day = document.createElement('div');
    day.innerHTML = '<div class="flex items-center gap-2 my-3"><span>26 sept.</span></div>';
    for (const m of messages) {
      const row = document.createElement('div');
      const time = '<span class="text-[10px] opacity-0">' + iso(m.at).slice(11, 16) + '</span>';
      if (m.trade) {
        row.className = 'flex justify-center mb-2';
        row.innerHTML = '<div class="group flex flex-col items-center gap-1"><div class="rounded-xl">Échange</div>' + time + '</div>';
      } else {
        row.className = 'group mb-1.5';
        row.dataset.id = m.id;
        const avatar = m.own ? '' : '<div class="h-8 w-8 shrink-0 rounded-full overflow-hidden" style="width:32px;height:32px"><span>AE</span></div>';
        row.innerHTML =
          '<div class="flex gap-2 items-end ' + (m.own ? 'flex-row-reverse' : 'flex-row') + '" style="display:flex;gap:8px;align-items:flex-end;flex-direction:' + (m.own ? 'row-reverse' : 'row') + '">' +
            avatar + '<div class="max-w-[75%] min-w-0 rounded-2xl ' + (m.own ? 'rounded-br-sm' : 'rounded-bl-sm') + ' px-3 py-2">' + m.id + '</div>' +
          '</div>' +
          '<div class="mt-0.5 flex gap-2">' + (m.own ? '' : '<div class="h-8 w-8 shrink-0" aria-hidden="true"></div>') + time + '</div>';
        row['__reactFiber$test'] = { key: m.id, memoizedProps: {}, return: chat };
      }
      day.append(row);
    }
    list.replaceChildren(day);
  };`,
);

type ChatPage = Window & { renderChat: (messages: Message[]) => void };

const MESSAGES: Message[] = [
  { id: 'a1', own: false, at: 21 },
  { id: 'a2', own: false, at: 25 },
  { id: 'a3', own: false, at: 27 },
  { id: 'm1', own: true, at: 60 },
  { id: 'm2', own: true, at: 119 },
  // Plus d'une minute après m2 : nouveau groupe.
  { id: 'm3', own: true, at: 180 },
  { id: 'a4', own: false, at: 200 },
  { id: 't1', own: false, at: 205, trade: true },
  // Un échange coupe le groupe.
  { id: 'a5', own: false, at: 210 },
];

const render = (page: Page, messages: Message[]) =>
  page.evaluate((list) => (window as unknown as ChatPage).renderChat(list), messages);

const message = (page: Page, id: string) => page.locator(`#chat [data-id="${id}"]`);

/** Coins de la bulle (haut gauche, haut droit, bas droit, bas gauche) : `R` arrondi, `r` réduit. */
async function corners(row: Locator): Promise<string> {
  const radii = await row.locator('div.rounded-2xl').evaluate((bubble) => {
    const style = getComputedStyle(bubble);
    return [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius];
  });
  return radii.map((radius) => (radius === '16px' ? 'R' : radius === '4px' ? 'r' : radius)).join('');
}

const avatarHidden = (row: Locator) => row.locator('div.rounded-full').evaluate((avatar) => getComputedStyle(avatar).visibility === 'hidden');
const marginBottom = (row: Locator) => row.evaluate((element) => getComputedStyle(element).marginBottom);

test('messages envoyés à moins d’une minute d’intervalle groupés, coins et photos comme Instagram', async ({ page }) => {
  await openSite(page, '/dms', { html: HTML });
  await render(page, MESSAGES);

  // Interlocuteur : trois messages groupés, coins réduits à gauche là où les bulles se touchent.
  await expect.poll(() => corners(message(page, 'a1'))).toBe('RRRr');
  expect(await corners(message(page, 'a2'))).toBe('rRRr');
  expect(await corners(message(page, 'a3'))).toBe('rRRR');
  // Photo au dernier du groupe seulement.
  expect(await avatarHidden(message(page, 'a1'))).toBe(true);
  expect(await avatarHidden(message(page, 'a2'))).toBe(true);
  expect(await avatarHidden(message(page, 'a3'))).toBe(false);
  // Serrés dans le groupe, écartés entre les groupes.
  expect(await marginBottom(message(page, 'a1'))).toBe('2px');
  expect(await marginBottom(message(page, 'a3'))).toBe('12px');

  // Soi : coins réduits à droite ; 61 s plus tard, nouveau message seul.
  expect(await corners(message(page, 'm1'))).toBe('RRrR');
  expect(await corners(message(page, 'm2'))).toBe('RrRR');
  expect(await corners(message(page, 'm3'))).toBe('RRRR');

  // Un échange entre deux messages coupe le groupe.
  expect(await corners(message(page, 'a4'))).toBe('RRRR');
  expect(await corners(message(page, 'a5'))).toBe('RRRR');
  expect(await avatarHidden(message(page, 'a4'))).toBe(false);

  // L'heure du site, sous la bulle, est cachée : elle s'affiche à côté de la bulle au survol.
  await expect(message(page, 'a1').locator('div.mt-0\\.5')).toBeHidden();
  await expect(message(page, 'a1').locator('div.items-end')).toHaveAttribute('data-wm-time', '00:17');

  // Au repos, le script ne resynchronise plus la page.
  await expectDomIdle(page);
});

test('un message arrivé ensuite rejoint le groupe du précédent', async ({ page }) => {
  await openSite(page, '/dms', { html: HTML });
  await render(page, MESSAGES);
  await expect.poll(() => corners(message(page, 'a5'))).toBe('RRRR');

  await render(page, [...MESSAGES, { id: 'a6', own: false, at: 250 }]);
  await expect.poll(() => corners(message(page, 'a5'))).toBe('RRRr');
  expect(await corners(message(page, 'a6'))).toBe('rRRR');
  expect(await avatarHidden(message(page, 'a5'))).toBe(true);
});

test('la photo à côté d’un message mène au profil de l’interlocuteur', async ({ page }) => {
  await openSite(page, '/dms', { html: HTML });
  await render(page, MESSAGES);

  const links = page.locator('#list').getByRole('link', { name: 'Profil de aelonka' });
  // Une par message de l'interlocuteur, cachée avec la photo au milieu d'un groupe : a3, a4, a5.
  await expect(links).toHaveCount(3);
  const link = message(page, 'a3').getByRole('link');
  await expect(link).toHaveAttribute('href', '/profile/aelonka');
  await link.click();
  await expect(page).toHaveURL(/\/profile\/aelonka$/);
});
