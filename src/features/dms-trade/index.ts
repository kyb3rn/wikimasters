import { h } from 'preact';
import { watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { tradeWindowButton } from '@/services/site-window';
import { findChatWindows, readChatPeer, type ChatWindow } from '@/site/dms';
import { DMS_ROUTE } from '@/site/routes';
import { createSlot } from '@/ui/mount';
import { TradeButton } from './TradeButton';

/** Conversation du site affichée (pas celle de la guilde, à nous). */
const currentChat = (): ChatWindow | undefined => findChatWindows().find((chat) => !chat.guild);

/**
 * « Échanger » au bout de l'en-tête de la conversation ouverte dans /dms (avant la croix du site quand elle est
 * affichée) : la fenêtre d'échange du site avec cet ami, sur place, comme sur la page Amis.
 */
export const dmsTrade: Feature = {
  id: 'dms-trade',
  name: 'Échanger depuis une conversation',
  description: "« Échanger » dans l'en-tête de la conversation : la fenêtre d'échange du site avec cet ami, sans quitter /dms.",
  category: 'Messages',
  routes: [DMS_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    const slot = createSlot(signal);
    const trade = tradeWindowButton({
      signal,
      log: ctx.log,
      onChange: () => sync(),
      target: () => {
        const chat = currentChat();
        const peer = chat && readChatPeer(chat);
        return chat && peer && { friendUsername: peer.username, friendProfileId: peer.id, contextFrom: chat.frame };
      },
    });

    if (!(await ctx.ready())) return;

    function sync(): void {
      if (signal.aborted) return;
      const chat = currentChat();
      const header = chat?.close.parentElement;
      if (!chat || !header) {
        slot.clear();
        return;
      }
      slot.render(h(TradeButton, { busy: trade.busy, onClick: trade.open }), { parent: header, before: chat.close, inline: true });
    }

    watchDom(sync, { signal });
  },
};
