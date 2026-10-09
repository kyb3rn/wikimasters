import { expect, test } from '@playwright/test';
import { openSite, rect, sitePage } from './support/site';

/**
 * Conversation privée de /dms (captures du 29/09/2026 et du 09/10/2026) : modale en portail dans `body`, en-tête
 * (lien du site vers le profil : photo ou initiales, pseudo), croix ; un message de l'interlocuteur, avec sa photo.
 * `window.openChat(pseudo, photo)` ouvre une conversation, `window.closeChat()` la ferme.
 */
const HTML = sitePage(
  `<h1>Messages</h1>`,
  `window.openChat = (name, photo) => {
    window.closeChat();
    const avatar = photo
      ? '<img alt="' + name + '" class="w-full h-full object-cover" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">'
      : '<span>' + name.slice(0, 2).toUpperCase() + '</span>';
    document.body.insertAdjacentHTML('beforeend',
      '<div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70" id="chat" style="position:fixed;inset:0">' +
        '<div class="w-full sm:max-w-2xl lg:max-w-4xl flex flex-col card-frame rounded-t-2xl sm:rounded-2xl overflow-hidden">' +
          '<div class="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] flex-shrink-0" style="display:flex;gap:12px">' +
            '<a class="hover:underline flex flex-1 min-w-0 items-center gap-3 rounded-lg text-inherit" title="Voir le profil de ' + name + '" href="/profile/' + encodeURIComponent(name) + '" style="display:flex;flex:1;gap:12px">' +
              '<div class="w-9 h-9 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center flex-shrink-0 overflow-hidden" style="width:36px;height:36px;display:flex">' + avatar + '</div>' +
              '<span class="min-w-0 font-semibold text-sm truncate">' + name + '</span>' +
            '</a>' +
            '<button class="p-1.5 rounded-lg" aria-label="Fermer"><svg class="w-4 h-4" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"></path></svg></button>' +
          '</div>' +
          '<div class="flex-1 overflow-y-auto px-4 py-3 space-y-1"><div>' +
            '<div class="flex items-center gap-2 my-3"><span>9 oct.</span></div>' +
            '<div class="group mb-1.5">' +
              '<div class="flex gap-2 items-end flex-row" style="display:flex;gap:8px">' +
                '<div class="h-8 w-8 shrink-0 rounded-full overflow-hidden" id="message-photo" style="width:32px;height:32px">' + avatar + '</div>' +
                '<div class="max-w-[75%] min-w-0 rounded-2xl rounded-bl-sm px-3 py-2">Salut !</div>' +
              '</div>' +
              '<div class="mt-0.5 flex gap-2 flex-row"><div class="h-8 w-8 shrink-0" aria-hidden="true"></div><span>20:41</span></div>' +
            '</div>' +
          '</div></div>' +
        '</div>' +
      '</div>');
    document.querySelector('#chat button[aria-label="Fermer"]').addEventListener('click', window.closeChat);
  };
  window.closeChat = () => document.getElementById('chat')?.remove();`,
);

type ChatWindow = Window & { openChat: (name: string, photo: boolean) => void };

test('conversation de /dms : en-tête lié par le site, photos des messages liées au profil de l’interlocuteur', async ({ page }) => {
  await openSite(page, '/dms', { html: HTML });
  await page.evaluate(() => (window as unknown as ChatWindow).openChat('Sarah Vachol', true));

  // L'en-tête garde le lien du site, seul : rien de posé dedans.
  const chat = page.locator('#chat');
  const header = chat.locator('div.border-b');
  await expect(header.getByRole('link')).toHaveCount(1);
  await expect(header.getByRole('link')).toHaveAttribute('href', '/profile/Sarah%20Vachol');
  await expect(header.locator('span.font-semibold')).toBeVisible();

  // La photo du message reste celle du site, notre lien la recouvre.
  const photo = chat.getByRole('link', { name: 'Profil de Sarah Vachol', exact: true });
  await expect(photo).toHaveAttribute('href', '/profile/Sarah%20Vachol');
  await expect(chat.locator('#message-photo img')).toBeVisible();
  const [link, avatar] = await Promise.all([rect(photo), rect(chat.locator('#message-photo'))]);
  expect(link).toEqual(avatar);

  // Autre conversation, sans photo : initiales, même lien.
  await page.evaluate(() => (window as unknown as ChatWindow).openChat('AlakazM', false));
  await expect(chat.getByRole('link', { name: 'Profil de AlakazM', exact: true })).toHaveCount(1);
  await expect(header.getByRole('link')).toHaveCount(1);

  await chat.getByRole('link', { name: 'Profil de AlakazM', exact: true }).click();
  await expect(page).toHaveURL(/\/profile\/AlakazM$/);
});
