import type { Page, Request } from '@playwright/test';
import { FAKE_JWT, openSite, sitePage, SUPABASE, type FakeSite } from './site';

/** Liens du menu latéral du site, dans l'ordre (capture du 03/10/2026) : adresse, texte, icône lucide. */
const SIDE_NAV_LINKS: readonly (readonly [string, string, string])[] = [
  ['/pulls', 'Paquets', 'puzzle'],
  ['/collection', 'Collection', 'book-open'],
  ['/trades', 'Échanges', 'handshake'],
  ['/marketplace', 'Marché', 'gavel'],
  ['/profile', 'Profil', 'user'],
  ['/global-collection', 'Toutes les cartes', 'globe'],
  ['/guild', 'Guilde', 'castle'],
  ['/friends', 'Amis', 'users'],
  ['/dms', 'Messages', 'message-circle'],
  ['/battle', 'Bataille', 'swords'],
  ['/achievements', 'Succès', 'trophy'],
  ['/leaderboard', 'Classement', 'medal'],
  ['/settings', 'Paramètres', 'settings'],
];

/**
 * Le site autour de ses pages (capture du 03/10/2026) : menu latéral d'ordinateur (rangée du logo et de la cloche,
 * 13 liens ; allumé d'après le début du chemin : teinte et texte accent, point à droite), `<main>`, routeur Next.js.
 * Page rendue par le serveur puis reprise par React (hydratation) : le menu et `<main>` ne reçoivent leur fiber
 * qu'alors, tout de suite, ou à `window.__hydrate()` avec `hydrateLater`. Un lien ou `router.push` change l'adresse sans recharger, puis la page est rendue à neuf (Next.js remonte la page
 * quand sa requête change), comme au retour arrière. Pages : `/collection` (quelle que soit la requête : titre,
 * liste demandée à `/api/my-collection` à chaque montage, `window.__shell.collectionLoads`), toute autre adresse :
 * son titre. `window.__shell.renders` : pages rendues. Marché : aucune vente en cours, sauf réponse donnée par le test. Au chargement, le site lit son profil à Supabase avec la session :
 * le script la reprend.
 */
const SHELL_SCRIPT = `
(() => {
  const { el, fiber, icon, nextRouter, tailwindBase } = kit;
  tailwindBase();
  const LINKS = ${JSON.stringify(SIDE_NAV_LINKS)};
  const main = document.querySelector('main');
  window.__shell = { renders: 0, collectionLoads: 0 };
  void fetch('${SUPABASE}/rest/v1/profiles?select=is_pro&id=eq.u0', {
    headers: { apikey: 'cle-publique', authorization: 'Bearer ${FAKE_JWT}' },
  });

  const style = el('style');
  // Comme le site : le menu à gauche, la page à côté (empilé au-dessus, il repousserait la page sous l'écran).
  style.textContent = 'body { display: flex; align-items: flex-start; } nav.w-64 { width: 16rem; flex: none; } ' +
    'main { flex: 1 1 0%; min-width: 0; } @media (min-width: 768px) { .md\\\\:flex { display: flex; } }';
  document.head.append(style);

  const router = {
    push(href) {
      history.pushState(null, '', href);
      render();
    },
  };
  addEventListener('popstate', render);

  const nav = el('nav', 'hidden w-64 shrink-0 flex-col gap-2 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-surface)] p-6 md:flex');
  const head = el('div', 'flex items-center justify-between gap-2 mb-8');
  head.innerHTML = '<a class="min-w-0" href="/pulls"><h1 class="text-2xl font-bold"><span>Wiki</span><span>Masters</span></h1></a>' +
    '<div class="shrink-0"><button type="button" aria-label="Notifications">🔔</button></div>';
  nav.append(head);
  const links = LINKS.map(([href, label, name]) => {
    const link = el('a');
    link.setAttribute('href', href);
    link.innerHTML = '<span class="flex shrink-0 items-center justify-center text-[var(--color-foreground)]">' +
      icon(name, 'w-5 h-5 md:w-6 md:h-6 shrink-0', 24) + '</span>' + label;
    link.onclick = (event) => {
      if (event.ctrlKey || event.shiftKey || event.metaKey || event.button !== 0) return;
      event.preventDefault();
      router.push(href);
    };
    nav.append(link);
    return link;
  });
  main.before(nav);

  // Hydratation : fibers du menu et de main (routeur de Next.js au-dessus).
  window.__hydrate = () => {
    nextRouter(router.push);
    fiber(nav);
  };
  if (!window.__hydrateLater) window.__hydrate();

  function renderNav() {
    LINKS.forEach(([href], i) => {
      const link = links[i];
      const active = location.pathname === href || location.pathname.startsWith(href + '/');
      link.className = 'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ' +
        (active ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
          : 'text-[var(--color-foreground)]/60 hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface-light)]');
      const dot = link.querySelector('.ml-auto');
      if (active && !dot) link.append(el('div', 'ml-auto w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]'));
      if (!active) dot?.remove();
    });
  }

  function collectionPage() {
    const body = el('div', 'flex-1 p-4 md:p-6 space-y-6');
    body.id = 'site-collection';
    body.append(el('h1', 'text-2xl md:text-3xl font-bold', 'Collection'));
    window.__shell.collectionLoads++;
    void fetch('/api/my-collection?sort=rarity&page=0&stats=0');
    return body;
  }

  function render() {
    window.__shell.renders++;
    renderNav();
    const page = location.pathname === '/collection' ? collectionPage() : el('h1', '', location.pathname);
    main.replaceChildren(page);
  }
  render();
})();
`;

export interface ShellOptions extends FakeSite {
  /** Menu et `<main>` repris par React à `window.__hydrate()` seulement. */
  readonly hydrateLater?: boolean;
  /** Réponse d'une requête Supabase (`[]` sinon), éventuellement retenue (promesse). */
  readonly supabase?: (url: URL, request: Request) => SupabaseReply | undefined | Promise<SupabaseReply | undefined>;
  /** Script de la page posé avant celui du site (modules du site imités, `SITE_MODULES`). */
  readonly modules?: string;
}

export interface SupabaseReply {
  readonly status?: number;
  readonly json: unknown;
}

/** Ouvre une page du site entouré de son menu latéral (voir `SHELL_SCRIPT`). */
export async function openShell(page: Page, pathname: string, site: ShellOptions = {}): Promise<void> {
  if (site.hydrateLater) await page.addInitScript(() => (window.__hydrateLater = true));
  await page.route(`${SUPABASE}/**`, async (route) => {
    const reply = await site.supabase?.(new URL(route.request().url()), route.request());
    await route.fulfill({ status: reply?.status ?? 200, json: reply ? reply.json : [] });
  });
  await openSite(page, pathname, {
    ...site,
    html: sitePage('', `${site.modules ?? ''}
${SHELL_SCRIPT}`),
    api: {
      '/api/my-collection': { collection: [], total: null, rarityCounts: {}, tagOptions: [], pendingTradeCardIds: [] },
      // Listes personnelles du marché (`mine=1`) : aucune vente en cours.
      '/api/marketplace': { auctions: [], mine: true, selling: [], bidding: [], won: [], history: [] },
      ...site.api,
    },
  });
}

declare global {
  interface Window {
    __shell: { renders: number; collectionLoads: number };
    __hydrate: () => void;
    __hydrateLater?: boolean;
  }
}
