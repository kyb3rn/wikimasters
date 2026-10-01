import { h } from 'preact';
import { blockSounds } from '@/core/audio';
import { childController, nextFrame, sleep, waitUntil } from '@/core/async';
import { classMarks, toggleStyle, watchDom, type ClassMarks } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { normalizeText } from '@/core/text';
import {
  createPullsGrid,
  markArrived,
  notifyPullsGridChange,
  PULLS_GRID_CLASSES,
  readPullsGrid,
  setSlotFace,
  type PullsGridSlot,
} from '@/services/pulls-grid';
import { carouselLock } from '@/services/pulls-pack';
import { findStarButton } from '@/site/cards';
import { carouselCards, findCarousel, type Carousel } from '@/site/pulls';
import { PULLS_ROUTE } from '@/site/routes';
import { SITE_SOUNDS } from '@/site/sound';
import { buttonClass } from '@/ui/button';
import { createSlot, type UiSlot } from '@/ui/mount';
import { cloneFace, imagesComplete, imagesDecoded } from './face';
import { gridLayout } from './layout';
import { settings } from './settings';
import { ARRIVAL_MS, CSS, GRID_ON_CSS, OFFSTAGE } from './style';

/** Changement de carte dans le carrousel : un rendu React, sans réseau. */
const STEP_TIMEOUT_MS = 2000;
/** Une shiny se révèle à la fin de l'animation de la carte, puis 350 ms (code du site). */
const SHINY_TIMEOUT_MS = 4000;
const IMAGES_TIMEOUT_MS = 1500;
const DECODE_TIMEOUT_MS = 400;

const sameTitle = (a: string | undefined, b: string | undefined) => normalizeText(a) === normalizeText(b);
/** Feuille posée tant que la grille est affichée. */
const GRID_ON_STYLE = 'pulls-grid-on';

/** Un paquet affiché en grille. */
interface Session {
  /** Racine du carrousel : un autre paquet, une autre racine. */
  readonly root: HTMLElement;
  readonly count: number;
  readonly grid: HTMLElement;
  readonly controller: AbortController;
  /** HTML de la face du site copiée dans chaque case : une face qui change est recopiée. */
  readonly sources: (string | undefined)[];
  /** « Continuer » à nous. */
  readonly proceed: UiSlot;
  /** Parties du carrousel cachées, rendues à la fin. */
  readonly hidden: Set<Element>;
  readonly marks: ClassMarks;
  /** Toutes les cartes sont arrivées. */
  done: boolean;
  /** Le script fait tourner le carrousel (arrivée des cartes, ouverture d'une carte). */
  stepping: boolean;
}

export const pullsGrid: Feature = {
  id: 'pulls-grid',
  name: 'Apparence',
  toggleLabel: "Afficher toutes les cartes d'un coup",
  description:
    "À la place du carrousel : par lignes de cinq au plus, les cartes arrivent l'une après l'autre en vague, sans le son du carrousel.",
  category: 'Paquets',
  routes: [PULLS_ROUTE],
  settings,
  async mount(ctx) {
    const { signal, log } = ctx;
    let session: Session | undefined;
    /** Paquets où la grille a échoué : leur carrousel reste tel quel. */
    const failed = new WeakSet<HTMLElement>();

    if (!(await ctx.ready())) return;
    ctx.style(CSS);

    const slotAt = (current: Session, index: number): PullsGridSlot | undefined => readPullsGrid(current.grid)?.slots[index];

    /** Copie la face du site dans la case (cachée tant qu'elle n'est pas arrivée). */
    function copy(current: Session, slot: PullsGridSlot, face: HTMLElement): HTMLElement {
      current.sources[slot.index] = face.outerHTML;
      const clone = cloneFace(face);
      setSlotFace(slot, clone);
      return clone;
    }

    /** Montre la carte `index` dans le carrousel, comme un clic sur sa pastille (sans son : voir `start`). */
    async function showCard(index: number, abort: AbortSignal, timeoutMs?: number): Promise<Carousel | undefined> {
      // Une action lancée depuis le carrousel (grille activée en plein milieu) tient la carte : on la laisse finir.
      await waitUntil(() => !carouselLock(), { signal: abort });
      const before = findCarousel();
      if (before && before.index !== index) before.dots[index]?.click();
      await waitUntil(
        () => {
          const carousel = findCarousel();
          return !carousel || (carousel.index === index && carousel.face !== undefined);
        },
        { signal: abort, timeoutMs },
      );
      const after = findCarousel();
      return after?.index === index && after.face ? after : undefined;
    }

    /** Face de la carte `index`, telle que le carrousel l'affiche une fois prête (shiny révélée, images chargées). */
    async function capture(index: number, abort: AbortSignal, timeoutMs?: number): Promise<HTMLElement | undefined> {
      const carousel = await showCard(index, abort, timeoutMs);
      if (!carousel) return undefined;
      const card = carouselCards(carousel)?.[index];
      if (card?.isShiny && card.rarity === 'L') {
        const revealed = await waitUntil(() => findCarousel()?.face?.classList.contains('shiny-card') === true, {
          signal: abort,
          timeoutMs: SHINY_TIMEOUT_MS,
        });
        if (!revealed) log.warn('shiny non révélée par le carrousel', card.title);
      }
      await waitUntil(() => imagesComplete(findCarousel()?.face), { signal: abort, timeoutMs: IMAGES_TIMEOUT_MS });
      // Le site recadre l'image à son chargement, au rendu suivant.
      await nextFrame(abort);
      await nextFrame(abort);
      const after = findCarousel();
      return after?.index === index ? after.face : undefined;
    }

    /** Fait arriver les cartes une à une, au rythme du réglage. */
    async function reveal(current: Session): Promise<void> {
      const abort = current.controller.signal;
      let started: number | undefined;
      current.stepping = true;
      try {
        for (let index = 0; index < current.count; index++) {
          // Première carte : le site attend d'avoir chargé toutes les images du paquet, sans limite.
          const face = await capture(index, abort, index === 0 ? undefined : STEP_TIMEOUT_MS);
          if (abort.aborted) return;
          const slot = slotAt(current, index);
          if (!face || !slot) throw new Error(`carte ${index + 1} introuvable dans le carrousel`);
          await imagesDecoded(copy(current, slot, face), DECODE_TIMEOUT_MS, abort);
          started ??= performance.now();
          await sleep(started + index * settings.get('waveMs') - performance.now(), abort);
          if (abort.aborted) return;
          markArrived(slot);
          notifyPullsGridChange();
        }
      } finally {
        current.stepping = false;
      }
      await sleep(ARRIVAL_MS, abort);
      if (abort.aborted) return;
      current.done = true;
      sync();
    }

    /** Ouvre la carte ou bascule son favori : le carrousel (caché) passe dessus, puis le clic va au site. */
    async function withCard(index: number, action: (face: HTMLElement) => void): Promise<void> {
      const current = session;
      // Carte tenue par une autre action (mise aux enchères) : clic ignoré plutôt qu'exécuté plus tard.
      if (!current?.done || current.stepping || carouselLock()) return;
      const expected = slotAt(current, index)?.title;
      current.stepping = true;
      try {
        const carousel = await showCard(index, current.controller.signal, STEP_TIMEOUT_MS);
        if (!carousel?.face || !sameTitle(carousel.title, expected)) {
          log.warn('carte du carrousel différente de la carte cliquée', { carrousel: carousel?.title, grille: expected });
          return;
        }
        action(carousel.face);
      } finally {
        current.stepping = false;
      }
      sync();
    }

    function onGridClick(event: MouseEvent): void {
      if (!(event.target instanceof Element)) return;
      const slot = event.target.closest<HTMLElement>(`.${PULLS_GRID_CLASSES.slot}`);
      // La face seulement : les boutons posés sous la carte ont leur propre action.
      const face = event.target.closest(`.${PULLS_GRID_CLASSES.card} > *`);
      if (!slot || !face) return;
      const index = Number(slot.dataset.index);
      const button = event.target.closest('button');
      if (button && face.contains(button)) {
        if (button === findStarButton(face)) void withCard(index, (real) => findStarButton(real)?.click());
        return;
      }
      void withCard(index, (real) => real.click());
    }

    /** Taille des cartes : tout le paquet à l'écran si possible. */
    function layout(current: Session): void {
      const root = current.grid.parentElement;
      const wrapper = root?.parentElement;
      const main = root?.closest('main');
      if (!root || !wrapper || !main) return;
      const px = (value: string) => parseFloat(value) || 0;
      const around = getComputedStyle(wrapper);
      const page = getComputedStyle(main);
      const visible = Math.min(main.clientHeight, window.innerHeight - Math.max(0, main.getBoundingClientRect().top));
      // Ce qui entoure la grille dans le carrousel : marges, « Continuer ».
      const siblings = root.getBoundingClientRect().height - current.grid.getBoundingClientRect().height;
      const { zoom, width } = gridLayout(
        current.count,
        wrapper.clientWidth - px(around.paddingLeft) - px(around.paddingRight),
        visible - px(page.paddingTop) - px(page.paddingBottom) - px(around.paddingTop) - px(around.paddingBottom) - siblings,
      );
      const style = current.grid.style;
      if (style.getPropertyValue('--wm-zoom') !== String(zoom)) style.setProperty('--wm-zoom', String(zoom));
      if (style.width !== `${width}px`) style.width = `${width}px`;
    }

    function start(carousel: Carousel): Session {
      const controller = childController(signal);
      // En grille, les cartes arrivent sans bruit : seul le paquet déchiré s'entend (son inconnu : coupé aussi).
      blockSounds((name) => name !== SITE_SOUNDS.packRip, { signal: controller.signal });
      const grid = createPullsGrid(carousel.dots.length);
      grid.addEventListener('click', onGridClick, { signal: controller.signal });
      const current: Session = {
        root: carousel.root,
        count: carousel.dots.length,
        grid,
        controller,
        sources: [],
        proceed: createSlot(controller.signal),
        hidden: new Set(),
        marks: classMarks(controller.signal),
        done: false,
        stepping: false,
      };
      const main = carousel.root.closest('main');
      if (main) {
        const observer = new ResizeObserver(() => layout(current));
        observer.observe(main);
        controller.signal.addEventListener('abort', () => observer.disconnect(), { once: true });
      }
      reveal(current).catch((error: unknown) => {
        if (controller.signal.aborted) return;
        log.warn('grille abandonnée, carrousel du site rétabli', error);
        failed.add(current.root);
        if (session === current) end();
      });
      return current;
    }

    function end(): void {
      if (!session) return;
      session.controller.abort();
      session.grid.remove();
      for (const element of session.hidden) ctx.hide(element, false);
      session = undefined;
      toggleStyle(GRID_ON_STYLE, GRID_ON_CSS, false);
      notifyPullsGridChange();
    }

    /** « Continuer » à nous (grand, vert plein, comme celui du site), qui déclenche celui du site (caché) : jamais « Encore n cartes ». */
    function proceedButton(current: Session, original: HTMLButtonElement) {
      return h(
        'button',
        {
          type: 'button',
          class: buttonClass('standard', { tone: 'accent', fill: 'solid', size: 'lg' }),
          disabled: !current.done || original.disabled,
          onClick: () => findCarousel()?.proceed?.click(),
        },
        'Continuer',
      );
    }

    /** Grille à la place de la carte, carrousel caché, « Continuer » à nous. Idempotent. */
    function place(current: Session, carousel: Carousel, original: HTMLButtonElement): void {
      // Compteur, navigation, bouton d'origine « Encore n cartes » / « Continuer ».
      for (const element of [carousel.counter, carousel.nav, original]) {
        if (!element) continue;
        ctx.hide(element);
        current.hidden.add(element);
      }
      if (carousel.holder) current.marks.set(carousel.holder, OFFSTAGE, true);
      toggleStyle(GRID_ON_STYLE, GRID_ON_CSS, true);
      current.proceed.render(proceedButton(current, original), { parent: carousel.root, after: original, inline: true });

      if (current.grid.parentElement !== carousel.root || current.grid.nextElementSibling !== carousel.nav) {
        carousel.root.insertBefore(current.grid, carousel.nav);
        layout(current);
      }
    }

    /** Une face déjà copiée a changé (favori…) : la copie suit. */
    function mirror(current: Session, carousel: Carousel): void {
      if (!current.done || current.stepping || !carousel.face) return;
      const slot = slotAt(current, carousel.index);
      if (!slot?.arrived || !sameTitle(slot.title, carousel.title)) return;
      if (carousel.face.outerHTML === current.sources[slot.index]) return;
      copy(current, slot, carousel.face);
      notifyPullsGridChange();
    }

    function sync(): void {
      if (signal.aborted) return;
      const carousel = findCarousel();
      const original = carousel?.proceed;
      if (!carousel || !original || failed.has(carousel.root)) {
        end();
        return;
      }
      if (session?.root !== carousel.root || session.count !== carousel.dots.length) {
        end();
        session = start(carousel);
      }
      place(session, carousel, original);
      mirror(session, carousel);
    }

    watchDom(sync, { signal });
    ctx.onDispose(end);
  },
};
