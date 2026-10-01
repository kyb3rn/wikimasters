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

  Reflect.set(window, 'kit', { el, button, icon, tailwindBase, fiber, chain, hooks, nextRouter, listbox, rarityPills });
}

/** Script de page qui pose `window.kit`. */
export const KIT_SCRIPT = `(${installKit.toString()})();`;
