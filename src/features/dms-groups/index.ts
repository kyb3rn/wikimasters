import { classMarks, watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { findChatList, findChatWindows, readChatDays, readChatMessageDates } from '@/site/dms';
import { groupLinks } from './groups';

const MESSAGE = 'wm-dm-message';
const OWN = 'wm-dm-own';
const PREV = 'wm-dm-prev';
const NEXT = 'wm-dm-next';
const TIME = 'data-wm-time';

const LINE = `.${MESSAGE} > div.items-end`;
const ROUND = 'var(--radius-2xl, 1rem)';
const JOINED = 'var(--radius-sm, 0.25rem)';

/*
 * L'heure du site (sous chaque bulle, au survol) prendrait sa hauteur même invisible et écarterait les bulles d'un
 * groupe : elle est cachée et réécrite à côté de la bulle (`::after` de sa rangée, côté libre), au survol, comme
 * Instagram. Coins : arrondis partout, réduits du côté de l'auteur là où la bulle touche sa voisine du groupe. La
 * photo de l'auteur ne reste qu'au dernier message du groupe (place gardée : les bulles restent alignées), son pseudo
 * (chat de groupe) qu'au premier, juste au-dessus de la bulle : la cale `h-8` de sa rangée l'écartait de 32 px.
 */
const CSS = `
.${MESSAGE}.${MESSAGE} { margin-bottom: 12px; }
.${MESSAGE}.${PREV} > div.mb-0\\.5 { display: none; }
.${MESSAGE} > div.mb-0\\.5 > div.h-8 { height: 0; }
.${MESSAGE}.${MESSAGE}.${NEXT} { margin-bottom: 2px; }
.${MESSAGE} > div.mt-0\\.5 { display: none; }
${LINE}[${TIME}]::after { content: attr(${TIME}); flex: none; align-self: center; padding: 0 4px;
  font-size: 10px; line-height: 1; white-space: nowrap;
  color: color-mix(in oklab, var(--color-foreground) 25%, transparent); opacity: 0; transition: opacity 0.15s; }
.${MESSAGE}:hover > div.items-end::after { opacity: 1; }
.${MESSAGE} > div.items-end > div.rounded-2xl.rounded-2xl { border-radius: ${ROUND}; }
.${OWN}.${PREV} > div.items-end > div.rounded-2xl.rounded-2xl { border-top-right-radius: ${JOINED}; }
.${OWN}.${NEXT} > div.items-end > div.rounded-2xl.rounded-2xl { border-bottom-right-radius: ${JOINED}; }
.${MESSAGE}:not(.${OWN}).${PREV} > div.items-end > div.rounded-2xl.rounded-2xl { border-top-left-radius: ${JOINED}; }
.${MESSAGE}:not(.${OWN}).${NEXT} > div.items-end > div.rounded-2xl.rounded-2xl { border-bottom-left-radius: ${JOINED}; }
.${MESSAGE}.${NEXT} > div.items-end > div.rounded-full { visibility: hidden; }
`;

/**
 * Messages d'une conversation groupés comme Instagram : les messages d'un même auteur envoyés à moins d'une minute
 * d'intervalle se suivent sans écart, coins intérieurs réduits, photo au dernier seulement, pseudo (chat de groupe)
 * au premier ; heure au survol à côté de la bulle. Toute conversation du site (/dms, fenêtre « Message » des amis)
 * et celle de la guilde (guild-chat, même balisage).
 */
export const dmsGroups: Feature = {
  id: 'dms-groups',
  name: 'Messages',
  description: 'Les messages envoyés à la suite sont regroupés.',
  category: 'Messages',
  routes: 'all',
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    if (!(await ctx.ready())) return;
    ctx.style(CSS);
    const marks = classMarks(signal);
    /** Rangées dont l'heure est réécrite à côté de la bulle. */
    let timed = new Set<HTMLElement>();
    ctx.onDispose(() => timed.forEach((line) => line.removeAttribute(TIME)));

    /** Date d'envoi de chaque message (id → ms) : elle ne change pas. */
    const dates = new Map<string, number>();
    /** Messages sans date déjà cherchés dans l'état du site : pas de nouvelle lecture tant qu'ils sont les mêmes. */
    let searched = '';
    let warned = false;

    function sync(): void {
      const rows: HTMLElement[] = [];
      const own: HTMLElement[] = [];
      const prev: HTMLElement[] = [];
      const next: HTMLElement[] = [];
      const lines = new Set<HTMLElement>();
      for (const chat of findChatWindows()) {
        const list = findChatList(chat.frame);
        if (!list) continue;
        const days = readChatDays(list);
        const missing = days
          .flat()
          .flatMap((entry) => (entry.kind === 'message' && entry.at === undefined && entry.id && !dates.has(entry.id) ? [entry.id] : []));
        if (missing.length > 0 && missing.join() !== searched) {
          searched = missing.join();
          for (const [id, at] of readChatMessageDates(list)) dates.set(id, at);
          if (!warned && missing.some((id) => !dates.has(id))) {
            warned = true;
            ctx.log.warn("dates des messages illisibles dans l'état du site : messages non groupés");
          }
        }
        for (const day of days) {
          const links = groupLinks(
            day.map((entry) =>
              entry.kind === 'message' ? { sender: entry.sender, at: entry.at ?? (entry.id ? dates.get(entry.id) : undefined) } : undefined,
            ),
          );
          for (const [index, entry] of day.entries()) {
            const link = links[index];
            if (entry.kind !== 'message' || !link) continue;
            const { row, line } = entry;
            rows.push(row);
            if (entry.own) own.push(row);
            if (link.prev) prev.push(row);
            if (link.next) next.push(row);
            if (entry.time === '') continue;
            lines.add(line);
            if (line.getAttribute(TIME) !== entry.time) line.setAttribute(TIME, entry.time);
          }
        }
      }
      // Les copies des modales qui s'effacent (clones dans nos `.wm-root`) ne sont pas marquées par nous : elles
      // gardent leur allure.
      marks.only(MESSAGE, rows);
      marks.only(OWN, own);
      marks.only(PREV, prev);
      marks.only(NEXT, next);
      for (const line of timed) if (!lines.has(line)) line.removeAttribute(TIME);
      timed = lines;
    }

    watchDom(sync, { signal });
  },
};
