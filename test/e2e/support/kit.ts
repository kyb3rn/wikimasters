/**
 * Boîte à outils des faux sites, posée dans la page avant leur script (`window.kit`, par `sitePage`) : éléments,
 * boutons, icônes lucide, base de Tailwind, états et fibers React imités, routeur Next.js, liste déroulante et
 * pastilles de rareté du site. Écrite en TypeScript pour être vérifiée, mais sérialisée dans la page
 * (`KIT_SCRIPT`) : la fonction ne doit rien utiliser de l'extérieur.
 */
function installKit(): void {
  /** Clé sous laquelle React note le fiber d'un nœud (`__reactFiber$<aléa>`), lue par le script. */
  const REACT_KEY = '__reactFiber$test';

  interface Fiber {
    key: string | null;
    memoizedProps: unknown;
    memoizedState?: unknown;
    stateNode?: unknown;
    return: Fiber | null;
  }

  interface Hook {
    readonly memoizedState: unknown;
    readonly queue: { dispatch(value: unknown): void };
    next: Hook | null;
  }

  function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(cls: string, html: string, onclick?: (event: MouseEvent) => void): HTMLButtonElement {
    const node = el('button', cls);
    node.type = 'button';
    node.innerHTML = html;
    if (onclick) node.onclick = onclick;
    return node;
  }

  /** Icône lucide du site, reconnue par le script à sa classe `lucide-<nom>`. */
  function icon(name: string, cls = '', size = 16): string {
    return `<svg class="lucide lucide-${name}${cls ? ` ${cls}` : ''}" width="${size}" height="${size}"></svg>`;
  }

  /** Comme la base de Tailwind et le site : `border-box` partout, 16 px imposés aux champs. */
  function tailwindBase(): void {
    if (document.getElementById('kit-base')) return;
    const style = el('style');
    style.id = 'kit-base';
    style.textContent = '*, ::before, ::after { box-sizing: border-box; } input, select, textarea { font-size: 16px !important; }';
    document.head.append(style);
  }

  /** Fiber React noté sur `node` (s'il y en a un) : props, nœud, parent. */
  function fiber(node: Node | null, props: object = {}, parent: Fiber | null = null, extra: Partial<Fiber> = {}): Fiber {
    const created: Fiber = { key: null, memoizedProps: props, stateNode: node, return: parent, ...extra };
    if (node) Reflect.set(node, REACT_KEY, created);
    return created;
  }

  /** Relie des hooks dans l'ordre (`next`), comme la liste des états d'un composant. */
  function chain<T extends { next?: unknown }>(list: T[]): T[] {
    list.forEach((hook, i) => {
      hook.next = list[i + 1] ?? null;
    });
    return list;
  }

  /**
   * États d'un composant fonction, dans l'ordre : `[lire, écrire]` par état → hooks chaînés, que le script lit
   * (`memoizedState`) et change (`queue.dispatch`). Le premier est le `memoizedState` du fiber du composant.
   */
  function hooks(states: [() => unknown, ((value: unknown) => void)?][]): Hook[] {
    return chain(
      states.map(
        ([get, set]): Hook => ({
          get memoizedState() {
            return get();
          },
          queue: { dispatch: set ?? (() => {}) },
          next: null,
        }),
      ),
    );
  }

  /** Routeur Next.js imité : l'objet de `useRouter()`, fourni par un contexte React au-dessus de `<main>`. */
  function nextRouter(push: (href: string) => void = (href) => history.pushState(null, '', href)) {
    const router = {
      push,
      replace(href: string) {
        router.push(href);
      },
      prefetch() {},
    };
    const main = document.querySelector('main');
    if (main) fiber(main, {}, fiber(null, { value: router, children: null }));
    return router;
  }

  interface ListboxOption {
    readonly value: string;
    readonly label: string;
  }

  let listboxes = 0;

  /**
   * Liste déroulante du site (Collection, Toutes les cartes, profil ; code du 29/09/2026) : bouton
   * (`aria-haspopup`, `aria-expanded`, `aria-controls`, `aria-label`), menu rendu dans `body` (portail) sous le
   * bouton tant qu'elle est ouverte, fermé par un `mousedown` hors du bouton et du menu. Props du composant :
   * `{ ariaLabel, value, options, onChange }` ; `render()` relit `value()` et `options()` et réécrit le bouton.
   * Avec `parent` (fiber de la page), le composant est noté au-dessus du bouton ; sinon la page place `props`
   * elle-même dans son arbre.
   */
  function listbox(spec: {
    label: string;
    className?: string;
    value: () => string;
    options: () => ListboxOption[];
    onChange: (value: string) => void;
    parent?: Fiber;
  }) {
    const id = `listbox-${++listboxes}`;
    const box = el('div', `relative ${spec.className ?? 'min-w-0 flex-1'}`);
    const props = { ariaLabel: spec.label, value: spec.value(), options: spec.options(), onChange: spec.onChange };
    const toggle = button('flex w-full min-h-[42px] items-center rounded-lg border', '', () => (menu.isConnected ? close() : open()));
    toggle.id = `${id}-button`;
    toggle.setAttribute('aria-haspopup', 'listbox');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', id);
    toggle.setAttribute('aria-label', spec.label);
    if (spec.parent) fiber(toggle, {}, fiber(null, props, spec.parent));
    const menu = el('ul', 'max-h-52 overflow-y-auto rounded-xl border py-1');
    menu.id = id;
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-labelledby', toggle.id);
    const open = () => {
      const rect = toggle.getBoundingClientRect();
      menu.style.cssText = `position:fixed;z-index:45;background:#161b22;top:${rect.bottom + 6}px;left:${rect.left}px;width:${rect.width}px`;
      menu.replaceChildren(
        ...props.options.map(({ value, label }) => {
          const item = el('li');
          item.setAttribute('role', 'none');
          const option = button('flex w-full cursor-pointer items-center justify-start px-3 py-2 text-left text-sm', '', () => {
            close();
            props.onChange(value);
          });
          option.setAttribute('role', 'option');
          option.textContent = label;
          item.append(option);
          return item;
        }),
      );
      document.body.append(menu);
      toggle.setAttribute('aria-expanded', 'true');
    };
    const close = () => {
      menu.remove();
      toggle.setAttribute('aria-expanded', 'false');
    };
    document.addEventListener('mousedown', (event) => {
      if (!(event.target instanceof Node) || (!box.contains(event.target) && !menu.contains(event.target))) close();
    });
    box.append(toggle);
    const render = () => {
      props.value = spec.value();
      props.options = spec.options();
      toggle.textContent = props.options.find((option) => option.value === props.value)?.label ?? '';
    };
    render();
    return { box, toggle, props, render };
  }

  const RARITIES = ['L', 'UR', 'SR', 'R', 'PC', 'C'];

  /**
   * Pastilles de rareté du site (rangée `div.flex.flex-wrap.gap-2`) : couleur en style, cochée `ring-2
   * ring-white/30`, sinon `opacity-50` ; « Réinitialiser… » (`resetLabel`) au bout de la rangée dès qu'une est
   * cochée. `checked`, `toggle` et `reset` : l'état de la page ; elle appelle `render()` après chaque changement.
   */
  function rarityPills(spec: {
    checked: () => Set<string>;
    toggle: (rarity: string) => void;
    reset: () => void;
    resetLabel?: string;
  }) {
    const row = el('div', 'flex flex-wrap gap-2');
    const pills = RARITIES.map((rarity) => {
      const pill = button('', rarity, () => spec.toggle(rarity));
      const color = `var(--color-rarity-${rarity.toLowerCase()})`;
      pill.setAttribute('style', `background-color: ${color}30; color: ${color};`);
      return pill;
    });
    const reset = button(
      'px-3 py-1 rounded-full text-xs cursor-pointer',
      `<span class="inline-flex items-center gap-1">${icon('x', 'size-3.5', 14)}${spec.resetLabel ?? 'Réinitialiser rareté'}</span>`,
      () => spec.reset(),
    );
    row.append(...pills);
    const render = () => {
      const checked = spec.checked();
      pills.forEach((pill, i) => {
        const on = checked.has(RARITIES[i] ?? '');
        pill.className = `px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${on ? 'ring-2 ring-white/30' : 'opacity-50 hover:opacity-80'}`;
      });
      if (checked.size > 0) row.append(reset);
      else reset.remove();
    };
    render();
    return { row, render };
  }

  interface ModalTag {
    readonly id: string;
    readonly name: string;
  }

  /** Props du composant de la modale de carte du site, et deux crochets du faux site. */
  interface CardModalProps {
    card: { readonly id: string; readonly wikipedia_title: string; readonly rarity: string; readonly atk?: number; readonly def?: number };
    onClose: () => void;
    starred?: boolean;
    count?: number;
    userCardId?: string;
    tags?: ModalTag[];
    tagsReadOnly?: boolean;
    onTagsChange?: (tags: ModalTag[]) => void;
    friendUsername?: string;
    friendProfileId?: string;
    friendOfferPending?: boolean;
    ownOfferPending?: boolean;
    catalogView?: boolean;
    wishlisted?: boolean;
    onToggleWishlist?: () => void;
    /** Faux site : « Mettre aux enchères » et « Défausser » (fenêtres propres à chaque page). */
    onAuction?: () => void;
    onDiscard?: () => void;
  }

  /**
   * Modale de carte du site (code du 02/10/2026) : un seul composant pour mes exemplaires, la vue catalogue
   * (`catalogView`) et l'exemplaire d'un ami (`friendUsername`), rendu en portail dans `body` (`#card-modal`, noté
   * avec le fiber du composant). Face (favori sauf en vue catalogue, « Échange en attente » d'un ami), colonne de
   * droite (titre, rareté + onglets, étiquettes modifiables ou en lecture seule, ATK / DEF, infos, bloc échange et
   * liste de souhaits, Wikipédia, « Signaler l'image »), rangée d'actions de mes exemplaires ou « Carte réservée
   * dans un échange ». « Proposer un échange » ouvre la fenêtre d'échange dans le fond (`#trade-composer`). La page
   * change `props` puis appelle `render()`.
   */
  function cardModal(props: CardModalProps, parent: Fiber | null = null) {
    const back = el('div', 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm');
    back.id = 'card-modal';
    back.onclick = () => props.onClose();
    fiber(back, {}, fiber(null, props, parent));
    let composing = false;

    function face(): HTMLElement {
      const { card } = props;
      const node = el('div', `w-72 h-[420px] glow-${card.rarity.toLowerCase()} relative rounded-2xl overflow-hidden`);
      node.style.cssText = 'position:relative;width:200px;height:280px;background:#30363d';
      const image = el('div', 'absolute top-0 left-0 right-0 h-[45%] z-20 bg-black/20');
      image.style.cssText = 'position:absolute;top:0;left:0;right:0;height:45%;background:#57606a';
      node.append(image);
      if (!props.catalogView) {
        const fill = props.starred ? 'currentColor' : 'none';
        const star = button('p-0.5 rounded-md', `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="${fill}" stroke="currentColor" d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"></path></svg>`);
        star.setAttribute('aria-label', props.starred ? 'Retirer des favoris' : 'Ajouter aux favoris');
        star.style.cssText = 'position:absolute;top:4px;right:4px;z-index:30';
        node.append(star);
      }
      const text = el('div', 'absolute top-[45%] left-0 right-0 bottom-0 flex min-h-0 flex-col p-3 z-20');
      text.style.cssText = 'position:absolute;top:45%;left:0;right:0;bottom:0;display:flex;flex-direction:column';
      const bottom = el('div', 'mt-auto flex min-h-0 w-full flex-col items-start gap-0.5 pt-1');
      if (props.friendUsername && props.friendOfferPending) bottom.append(el('div', 'rounded bg-amber-400/80 px-1.5 text-[9px] font-bold', 'Échange en attente'));
      const stats = el('div', 'flex w-full shrink-0 items-center justify-between border-t border-black/20 pt-1 py-1 face-stats');
      stats.innerHTML = `<span>${icon('swords')}${card.atk ?? 0}</span><span>${icon('shield')}${card.def ?? 0}</span>`;
      bottom.append(stats);
      text.append(el('h3', 'text-base font-bold', card.wikipedia_title), bottom);
      node.append(text);
      return node;
    }

    function tags(): HTMLElement | undefined {
      const list = props.tags ?? [];
      if (props.userCardId && !props.tagsReadOnly && props.onTagsChange) {
        const block = el('div', 'space-y-2');
        const chips = el('div', 'flex flex-wrap gap-1.5');
        for (const tag of list) {
          const chip = el('span', 'inline-flex items-center gap-1 rounded-full text-xs', tag.name);
          const remove = button('p-0.5 rounded-full', '×', () => props.onTagsChange?.(list.filter((other) => other.id !== tag.id)));
          remove.setAttribute('aria-label', `Retirer l'étiquette ${tag.name}`);
          chip.append(remove);
          chips.append(chip);
        }
        const input = el('input', 'w-full rounded-lg');
        input.placeholder = 'Ajouter une étiquette…';
        block.append(el('p', 'text-xs font-semibold uppercase', 'Étiquettes'), chips, input);
        return block;
      }
      if (!props.tagsReadOnly || list.length === 0) return undefined;
      const block = el('div', 'space-y-2');
      const chips = el('div', 'flex flex-wrap gap-1.5');
      chips.append(...list.map((tag) => el('span', 'inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border', tag.name)));
      block.append(el('p', 'text-xs font-semibold uppercase', 'Étiquettes'), chips);
      return block;
    }

    /** Échange (ami) et liste de souhaits (vue catalogue), dans la colonne de droite. */
    function sideActions(): HTMLElement | undefined {
      const friend = Boolean(props.friendUsername && props.friendProfileId);
      const wishlist = Boolean(props.catalogView && props.onToggleWishlist);
      if (!friend && !wishlist) return undefined;
      const block = el('div', 'space-y-2');
      if (friend && !props.friendOfferPending) {
        block.append(
          button('inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold bg-[var(--color-accent)]/10', `${icon('handshake', 'size-4 shrink-0')}Proposer un échange`, () => {
            composing = true;
            render();
          }),
        );
      }
      if (friend && props.friendOfferPending) {
        const status = el('div', 'inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold bg-amber-400/15 border');
        status.setAttribute('role', 'status');
        status.innerHTML = `${icon('refresh-cw', 'size-4 shrink-0')}Échange en attente`;
        block.append(status);
      }
      if (wishlist) {
        const wished = Boolean(props.wishlisted);
        const inner = el('div', 'space-y-1.5');
        const wish = button(
          `inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${wished ? 'border border-[var(--color-accent)] wished' : 'bg-[var(--color-accent)]/10 not-wished'}`,
          `${icon('bell', 'size-4 shrink-0')}${wished ? 'Retirer de la liste de souhaits' : 'Ajouter à la liste de souhaits'}`,
          () => props.onToggleWishlist?.(),
        );
        inner.append(wish);
        if (!wished) inner.append(el('p', 'text-xs leading-snug', 'Recevez une alerte si cette carte est mise en vente.'));
        block.append(inner);
      }
      return block;
    }

    function render(): void {
      const { card } = props;
      const panel = el('div', 'card-frame relative w-full p-6');
      panel.onclick = (event) => event.stopPropagation();
      const close = button('absolute top-3 right-3 z-20 flex h-9 w-9 items-center justify-center rounded-full', '×', () => props.onClose());
      close.setAttribute('aria-label', 'Fermer');

      const left = el('div', 'flex-shrink-0 flex justify-center');
      left.append(face());
      const rarityRow = el('div', 'flex items-center justify-between gap-2 mt-1');
      const tablist = el('div', 'flex shrink-0 gap-0.5 rounded-md border');
      tablist.setAttribute('role', 'tablist');
      tablist.setAttribute('aria-label', 'Vue de la carte');
      for (const label of ['Détails', 'Marché']) {
        const tab = button('rounded px-2 py-0.5 text-[10px]', label);
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', String(label === 'Détails'));
        tablist.append(tab);
      }
      rarityRow.append(el('span', 'inline-block px-2 py-0.5 rounded text-xs font-bold', card.rarity), tablist);
      const header = el('div');
      header.append(el('h2', 'text-xl font-bold leading-tight pr-10', card.wikipedia_title), rarityRow);
      const stats = el('div', 'grid grid-cols-2 gap-3');
      stats.innerHTML =
        `<div class="card-frame p-3 text-center"><div>${icon('swords')}${card.atk ?? 0}</div><div>ATK</div></div>` +
        `<div class="card-frame p-3 text-center"><div>${icon('shield')}${card.def ?? 0}</div><div>DEF</div></div>`;
      const infos = el('div', 'text-xs space-y-1');
      infos.append(el('p', '', 'Q-Score : 10'));
      if (props.count !== undefined) infos.append(el('p', '', `Exemplaires : ${props.count}`));
      const wiki = el('div', 'space-y-2');
      wiki.append(el('a', 'inline-flex text-sm', "Voir l'article sur Wikipédia →"));
      const report = button('inline-flex items-center gap-1.5 rounded-lg', `${icon('flag')}Signaler l'image`);
      report.setAttribute('aria-pressed', 'false');
      const reportBlock = el('div', 'border-t border-[var(--color-border)] pt-3');
      reportBlock.append(report);
      const right = el('div', 'flex-1 flex flex-col min-w-0 md:pr-2 gap-4');
      right.append(...[header, tags(), stats, infos, sideActions(), wiki, reportBlock].filter((node): node is HTMLElement => node !== undefined));
      const columns = el('div', 'flex flex-col md:flex-row gap-6');
      columns.append(left, right);
      panel.append(close, columns);

      const own = !props.catalogView && !props.friendUsername;
      if (own && (props.count ?? 0) > 0 && !props.ownOfferPending && props.userCardId) {
        const row = el('div', 'flex flex-col sm:flex-row gap-2');
        row.append(
          button('flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[var(--color-accent)]/10', `${icon('gavel')}Mettre aux enchères`, () => props.onAuction?.()),
          button('flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg border', `${icon('trash-2')}Défausser<span>+1</span>`, () => props.onDiscard?.()),
        );
        const actions = el('div', 'mt-3 space-y-2');
        actions.append(row);
        panel.append(actions);
      } else if (own && props.ownOfferPending) {
        panel.append(el('div', 'mt-3 inline-flex w-full items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-400/15', 'Carte réservée dans un échange'));
      }

      const children: HTMLElement[] = [panel];
      if (composing) {
        const composer = el('div', 'fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70');
        composer.id = 'trade-composer';
        composer.onclick = (event) => event.stopPropagation();
        const box = el('div', 'card-frame w-full p-5');
        box.append(el('h2', 'text-lg font-bold', `Échange avec ${props.friendUsername ?? ''}`), button('rounded-lg px-4 py-2', 'Annuler', () => {
          composing = false;
          render();
        }));
        composer.append(box);
        children.push(composer);
      }
      back.replaceChildren(...children);
    }

    render();
    document.body.append(back);
    return { back, props, render };
  }

  Reflect.set(window, 'kit', { el, button, icon, tailwindBase, fiber, chain, hooks, nextRouter, listbox, rarityPills, cardModal });
}

/** Script de page qui pose `window.kit`. */
export const KIT_SCRIPT = `(${installKit.toString()})();`;
