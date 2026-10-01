import { h } from 'preact';
import { childController, waitUntil } from '@/core/async';
import { SITE_LIKE_CLASS, watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { supabaseUserId } from '@/site/api';
import { findChatWindows, findDmsPage } from '@/site/dms';
import { myGuild, type MyGuild } from '@/site/guild';
import { DMS_ROUTE } from '@/site/routes';
import { createSlot } from '@/ui/mount';
import { GUILD_CHAT_CSS, GuildChat } from './GuildChat';
import { GuildRow } from './GuildRow';

/**
 * Chat de la guilde dans /dms (demande de l'utilisateur ; l'onglet Chat de /guild est caché par guild-chat-tab) :
 * conversation épinglée en tête de la liste, puis un trait, seulement dans une guilde (`myGuild` : retenue, vérifiée
 * au plus toutes les 4 heures). Elle s'ouvre comme une conversation du site, à sa place : celle du site affichée est
 * d'abord fermée par sa croix.
 */
export const guildChat: Feature = {
  id: 'guild-chat',
  name: 'Chat de guilde',
  description: 'Le chat de la guilde est une conversation épinglée en tête des messages.',
  category: 'Messages',
  routes: [DMS_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    if (!(await ctx.ready())) return;
    // Session du site : vue à sa première requête Supabase, au chargement.
    if (!(await waitUntil(() => supabaseUserId() !== undefined, { signal, timeoutMs: 30_000 }))) {
      if (!signal.aborted) ctx.log.warn('session du site introuvable : pas de chat de guilde');
      return;
    }
    const me = supabaseUserId();
    const guild = await myGuild();
    if (signal.aborted || !me) return;
    if (guild === undefined) ctx.log.warn('guilde illisible : pas de chat de guilde');
    if (!guild) return;
    const found: MyGuild = guild;
    const meId: string = me;

    ctx.style(GUILD_CHAT_CSS);
    const row = createSlot(signal);
    const chat = createSlot(signal);
    /** Fermeture de la conversation du site en cours, avant d'ouvrir celle de la guilde. */
    let opening: AbortController | undefined;

    const rowView = () => h(GuildRow, { guild: found, active: chat.ui !== undefined, busy: opening !== undefined, onOpen: () => void open() });
    const refreshRow = () => row.ui?.update(rowView());

    function closeChat(): void {
      if (!chat.ui) return;
      chat.clear();
      refreshRow();
    }

    async function open(): Promise<void> {
      if (chat.ui || opening) return;
      const site = findChatWindows().find((window) => !window.guild);
      if (site) {
        const controller = childController(signal);
        opening = controller;
        refreshRow();
        site.close.click();
        const closed = await waitUntil(() => !site.overlay.isConnected, { signal: controller.signal, timeoutMs: 3000 });
        if (opening === controller) opening = undefined;
        refreshRow();
        if (!closed) {
          if (!signal.aborted) ctx.log.warn("la conversation affichée ne s'est pas fermée");
          return;
        }
      }
      chat.render(h(GuildChat, { guild: found, me: meId, onClose: closeChat }), { parent: document.body, className: SITE_LIKE_CLASS });
      refreshRow();
    }

    function placeRow(): void {
      const page = findDmsPage();
      if (!page) {
        row.clear();
        return;
      }
      // En tête de la liste (avant sa première ligne, ou juste avant la suivante si la nôtre est déjà là) ; sans
      // conversation, sous le titre.
      const { list } = page;
      if (list) {
        const first = list.firstElementChild;
        const before = first && first === row.ui?.element ? first.nextSibling : list.firstChild;
        row.render(rowView(), { parent: list, before, inline: true });
      } else {
        row.render(rowView(), { parent: page.root, after: page.header });
      }
    }

    function sync(): void {
      placeRow();
      // Une conversation du site ouverte d'ailleurs (adresse, autre bouton) prend la place.
      if (chat.ui && findChatWindows().some((window) => !window.guild)) closeChat();
    }

    watchDom(sync, { signal });
  },
};
