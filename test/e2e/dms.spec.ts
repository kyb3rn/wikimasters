import { expect, test } from '@playwright/test';
import { openSite, rect, sitePage } from './support/site';

/**
 * Conversation privée de /dms (capture du 29/09/2026) : modale en portail dans `body`, en-tête photo (ou
 * initiales), pseudo, croix. `window.openChat(pseudo, photo)` ouvre une conversation, `window.closeChat()` la ferme.
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
        '<div class="w-full sm:max-w-md flex flex-col card-frame rounded-t-2xl sm:rounded-2xl overflow-hidden">' +
          '<div class="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] flex-shrink-0" style="display:flex;gap:12px">' +
            '<div class="w-9 h-9 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center flex-shrink-0 overflow-hidden" style="width:36px;height:36px;display:flex">' + avatar + '</div>' +
            '<div class="flex-1 min-w-0" style="flex:1"><p class="font-semibold text-sm truncate">' + name + '</p></div>' +
            '<button class="p-1.5 rounded-lg" aria-label="Fermer"><svg class="w-4 h-4" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"></path></svg></button>' +
          '</div>' +
          '<div class="flex-1 overflow-y-auto px-4 py-3 space-y-1"><p>Salut !</p></div>' +
        '</div>' +
      '</div>');
    document.querySelector('#chat button[aria-label="Fermer"]').addEventListener('click', window.closeChat);
  };
  window.closeChat = () => document.getElementById('chat')?.remove();`,
);

type ChatWindow = Window & { openChat: (name: string, photo: boolean) => void };

test('conversation de /dms : pseudo et photo mènent au profil de l’interlocuteur', async ({ page }) => {
  await openSite(page, '/dms', { html: HTML });
  await page.evaluate(() => (window as unknown as ChatWindow).openChat('Sarah Vachol', true));

  const chat = page.locator('#chat');
  const name = chat.getByRole('link', { name: 'Sarah Vachol', exact: true });
  await expect(name).toHaveAttribute('href', '/profile/Sarah%20Vachol');
  await expect(name).toHaveClass(/font-semibold/);
  await expect(chat.locator('p.font-semibold')).toBeHidden();

  // La photo reste celle du site, notre lien la recouvre.
  const photo = chat.getByRole('link', { name: 'Profil de Sarah Vachol' });
  await expect(chat.locator('img')).toBeVisible();
  const [link, avatar] = await Promise.all([rect(photo), rect(chat.locator('div.w-9.h-9'))]);
  expect(link).toEqual(avatar);

  // Autre conversation, sans photo : initiales, même lien.
  await page.evaluate(() => (window as unknown as ChatWindow).openChat('AlakazM', false));
  await expect(chat.getByRole('link', { name: 'AlakazM', exact: true })).toHaveAttribute('href', '/profile/AlakazM');
  await expect(chat.getByRole('link', { name: 'Profil de AlakazM' })).toHaveCount(1);

  await chat.getByRole('link', { name: 'Profil de AlakazM' }).click();
  await expect(page).toHaveURL(/\/profile\/AlakazM$/);
});
