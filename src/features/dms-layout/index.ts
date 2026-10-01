import { h } from 'preact';
import { childController, waitUntil } from '@/core/async';
import { classMarks, EMBEDDED_CLASS, watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { dmsRowAt, findChatWindows, findDmsPage, type ChatWindow } from '@/site/dms';
import { DMS_ROUTE } from '@/site/routes';
import { createSlot } from '@/ui/mount';
import { EmptyPanel } from './EmptyPanel';

const PAGE = 'wm-dms-page';
const HEAD = 'wm-dms-head';
const LIST = 'wm-dms-list';
const PANEL = 'wm-dms-panel';
const ACTIVE = 'wm-dms-active';
const DOCKED = 'wm-dms-docked';

const LIST_WIDTH = 340;
const GAP = 24;
/** Largeur des deux colonnes ensemble, au plus (demande de l'utilisateur). */
const MAX_WIDTH = 1500;
/** Largeur de la page (marges `md:p-6` comprises) sous laquelle la conversation reste une modale : liste, écart et la largeur de celle du site (`max-w-md`). */
const WIDE = 48 + LIST_WIDTH + GAP + 448;

const RECT = ['top', 'left', 'width', 'height'] as const;

/*
 * La page devient une grille centrée de 1500 px au plus (deux pistes vides de part et d'autre) : le titre
 * au-dessus, puis la liste à gauche (elle défile seule) et notre cadre à droite, du haut de la première conversation
 * jusqu'en bas. L'écart entre les colonnes est une marge du cadre : un `column-gap` s'ajouterait aussi entre les
 * pistes vides. La conversation du site (portail dans `body`) est posée exactement sur ce cadre : sans fond ni croix,
 * sous les modales du site (z-50) qu'elle peut ouvrir.
 */
const CSS = `
.${PAGE}.${PAGE} { display: grid;
  grid-template-columns: minmax(0, 1fr) ${LIST_WIDTH}px minmax(0, ${MAX_WIDTH - LIST_WIDTH}px) minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr); row-gap: 24px; height: 100%; box-sizing: border-box; }
.${PAGE} > * { grid-column: 2; min-width: 0; min-height: 0; margin: 0 !important; }
.${PAGE} > .${HEAD} { grid-column: 2 / 4; }
.${PAGE} > .${LIST} { overflow-y: auto; }
.${PAGE} > .${PANEL} { grid-column: 3; grid-row: 2; margin-left: ${GAP}px !important; }
.${PANEL} > div { height: 100%; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 12px; padding: 24px; text-align: center; }
.${ACTIVE}.${ACTIVE} { background-color: var(--color-surface-light); }
.${DOCKED}.${DOCKED}.${DOCKED} { position: fixed; inset: auto; top: var(--wm-dms-top); left: var(--wm-dms-left);
  width: var(--wm-dms-width); height: var(--wm-dms-height); padding: 0; z-index: 30; display: flex;
  background: none; -webkit-backdrop-filter: none; backdrop-filter: none; }
.${DOCKED} > .card-frame { width: 100%; max-width: none; height: 100%; animation: none; }
.${DOCKED} > .card-frame > div.border-b > button[aria-label="Fermer"] { display: none; }
`;

function setRect(overlay: HTMLElement, rect: DOMRect | undefined): void {
  for (const key of RECT) {
    const name = `--wm-dms-${key}`;
    const value = rect ? `${rect[key]}px` : '';
    if (overlay.style.getPropertyValue(name) === value) continue;
    if (value) overlay.style.setProperty(name, value);
    else overlay.style.removeProperty(name);
  }
}

/**
 * /dms en deux colonnes, comme une messagerie : liste des conversations à gauche, conversation ouverte à droite.
 *
 * La conversation reste celle du site (sa modale, posée sur la colonne de droite) : chargement, envoi, échanges et
 * temps réel sont les siens, rien n'est ouvert ni suivi en double. Passer à une autre conversation fait ce que ferait
 * l'utilisateur : fermer celle affichée (le site quitte ses canaux et relit la liste), puis cliquer la ligne choisie.
 * Page trop étroite pour deux colonnes : la modale du site, telle quelle.
 */
export const dmsLayout: Feature = {
  id: 'dms-layout',
  name: 'Messages',
  description: 'La liste des conversations à gauche, la conversation ouverte à droite.',
  category: 'Messages',
  routes: [DMS_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    if (!(await ctx.ready())) return;
    ctx.style(CSS);
    const marks = classMarks(signal);
    const panel = createSlot(signal);
    /** Conversations posées sur le cadre : leur position (variables CSS) est retirée quand elles ne le sont plus. */
    const docked = new Set<HTMLElement>();
    // Le cadre bouge sans mutation du site (fenêtre, menu latéral) : la conversation le suit.
    const resize = new ResizeObserver(() => sync());
    let observed: Element | undefined;
    /** Conversation demandée, en attente que la précédente soit fermée. */
    let switching: { username: string; controller: AbortController } | undefined;
    /** Clic relayé par nous sur une ligne : laissé au site. */
    let passing = false;

    ctx.onDispose(() => {
      switching?.controller.abort();
      resize.disconnect();
      for (const overlay of docked) setRect(overlay, undefined);
    });

    function observe(element: Element | undefined): void {
      if (element === observed) return;
      if (observed) resize.unobserve(observed);
      if (element) resize.observe(element);
      observed = element;
    }

    function sync(): void {
      const page = findDmsPage();
      const wide = page !== undefined && page.root.getBoundingClientRect().width >= WIDE;
      marks.only(PAGE, wide && page ? [page.root] : []);
      marks.only(HEAD, wide && page ? [page.header] : []);
      marks.only(LIST, wide && page?.list ? [page.list] : []);
      let slot: HTMLElement | undefined;
      if (wide && page) {
        slot = panel.render(h(EmptyPanel, { busy: switching !== undefined }), { parent: page.root, className: PANEL }).element;
      } else {
        panel.clear();
      }
      observe(slot);

      const chats = slot ? findChatWindows() : [];
      const overlays = chats.map((chat) => chat.overlay);
      for (const overlay of docked) {
        if (overlays.includes(overlay)) continue;
        setRect(overlay, undefined);
        docked.delete(overlay);
      }
      marks.only(DOCKED, overlays);
      marks.only(EMBEDDED_CLASS, overlays);
      const rect = slot?.getBoundingClientRect();
      for (const overlay of overlays) {
        setRect(overlay, rect);
        docked.add(overlay);
      }

      const active = switching?.username ?? chats.find((chat) => !chat.guild)?.peer.username;
      marks.only(ACTIVE, page && slot ? page.rows.filter((row) => row.username === active).map((row) => row.button) : []);
    }

    async function switchTo(open: ChatWindow, username: string): Promise<void> {
      const controller = childController(signal);
      switching = { username, controller };
      sync();
      const findRow = () => findDmsPage()?.rows.find((row) => row.username === username);
      open.close.click();
      const ready =
        (await waitUntil(() => !open.overlay.isConnected, { signal: controller.signal, timeoutMs: 3000 })) &&
        (await waitUntil(() => findRow() !== undefined, { signal: controller.signal, timeoutMs: 10_000 }));
      if (controller.signal.aborted) return;
      switching = undefined;
      const row = ready ? findRow() : undefined;
      if (row) {
        passing = true;
        try {
          row.button.click();
        } finally {
          passing = false;
        }
      } else {
        ctx.log.warn(`conversation avec ${username} : la précédente ne s'est pas fermée ou la ligne a disparu`);
      }
      sync();
    }

    // Capture sur `window` : avant React, qui écoute sur le document.
    window.addEventListener(
      'click',
      (event) => {
        if (passing) return;
        const page = findDmsPage();
        const row = page && panel.ui ? dmsRowAt(event.target, page) : undefined;
        if (!row) return;
        switching?.controller.abort();
        switching = undefined;
        const open = findChatWindows()[0];
        if (!open) {
          sync();
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        if (open.guild || open.peer.username !== row.username) void switchTo(open, row.username);
      },
      { capture: true, signal },
    );
    window.addEventListener('resize', sync, { signal });
    watchDom(sync, { signal });
  },
};
