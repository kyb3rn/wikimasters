import { h } from 'preact';
import { classMarks, watchDom } from '@/core/dom';
import { net } from '@/core/net';
import { hydrationGate } from '@/core/react';
import type { Feature } from '@/core/runtime';
import { isChatMessageSend, parseSentChatMessage } from '@/site/api';
import { addDmsConversation, findChatWindows, findDmsPage, newDmsConversation, readChatPeer } from '@/site/dms';
import { DMS_ROUTE } from '@/site/routes';
import { createSlot } from '@/ui/mount';
import { newMessage, NewMessageButton } from '@/services/new-message';

const HEAD = 'wm-dms-compose-head';
const BUTTON = 'wm-dms-compose';

// Titre et sous-titre à gauche, le bouton à droite, centré sur leurs deux lignes.
const CSS = `
.${HEAD}.${HEAD} { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 16px; align-items: center; }
.${HEAD} > :not(.${BUTTON}) { grid-column: 1; }
.${HEAD} > .${BUTTON} { grid-column: 2; grid-row: 1 / span 2; }
`;

/**
 * « Nouveau message » à droite du titre de /dms : choix d'un ami, puis sa conversation, même sans conversation
 * avec lui (demande de l'utilisateur). Après le premier message, la conversation est ajoutée à la liste : la page ne
 * la relit qu'à la fermeture de sa propre conversation, et son temps réel ne voit que les messages reçus.
 */
export const dmsNewMessage: Feature = {
  id: 'dms-new-message',
  name: 'Nouveau message',
  description: "Écrire à un ami, même sans conversation avec lui : on le choisit, sa conversation s'ouvre.",
  category: 'Messages',
  routes: [DMS_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    if (!(await ctx.ready())) return;
    ctx.style(CSS);
    const marks = classMarks(signal);
    const slot = createSlot(signal);
    const hydration = hydrationGate(signal);
    const compose = newMessage({ signal, log: ctx.log });

    function sync(): void {
      const page = findDmsPage();
      const header = page && hydration.ready(page.header, sync) ? page.header : undefined;
      marks.only(HEAD, header ? [header] : []);
      if (header) slot.render(h(NewMessageButton, { onClick: compose.open }), { parent: header, className: BUTTON });
      else slot.clear();
    }

    net.observe(
      isChatMessageSend,
      async (exchange) => {
        if (!exchange.ok) return;
        const sent = parseSentChatMessage(await exchange.json().catch(() => undefined));
        const peer = sent && findChatWindows().flatMap((chat) => readChatPeer(chat) ?? []).find(({ id }) => id === sent.recipientId);
        if (!sent || !peer) return;
        const row = findDmsPage()?.rows[0];
        if (!row || !addDmsConversation(row.button, newDmsConversation(peer, sent))) {
          ctx.log.warn(`conversation avec ${peer.username} : liste de la page illisible, elle n'y apparaîtra qu'au prochain chargement`);
        }
      },
      { signal },
    );

    watchDom(sync, { signal });
  },
};
