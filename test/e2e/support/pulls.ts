import { sitePage, SUPABASE } from './site';

/** Paquet de test (données inventées, même forme que `POST /api/packs/open`). */
export const PACK = {
  cards: [
    { id: 'c1', wikipedia_title: 'Tour Eiffel', rarity: 'C', atk: 1200, def: 900 },
    { id: 'c2', wikipedia_title: 'Musée du Louvre', rarity: 'R', atk: 4000, def: 3100 },
    { id: 'c3', wikipedia_title: 'Mont Blanc', rarity: 'SR', atk: 6100, def: 5400 },
  ],
  packs_remaining: 9,
  packs_last_regen_at: '2026-09-29T03:10:26.641536+00:00',
  owned_copies: [
    { id: 'u1', card_id: 'c1', starred: false, is_shiny: false, user_card_tags: [] },
    { id: 'u2', card_id: 'c2', starred: false, is_shiny: false, user_card_tags: [] },
    { id: 'u3', card_id: 'c3', starred: false, is_shiny: false, user_card_tags: [] },
  ],
};

/** Réglages des tests qui passent par le carrousel du site : sans « toutes les cartes d'un coup ». */
export const CAROUSEL = { features: { 'pulls-grid': false }, values: {} };

/** Paquet PRO : pas d'exemplaires dans la réponse, le site les demande à Supabase. */
export const PRO_PACK = { cards: PACK.cards, eligible: true, claimed_today: true };
export const PRO_COPIES = [
  { id: 'p1', card_id: 'c1', starred: false, is_shiny: false },
  { id: 'p2', card_id: 'c2', starred: false, is_shiny: false },
  { id: 'p3', card_id: 'c3', starred: false, is_shiny: false },
];

/**
 * Imitation du carrousel de `/pulls` : mêmes classes et même structure que le site (compteur, zone de la
 * carte, navigation, « Encore n cartes » / « Continuer »), la face est recréée à chaque carte (comme un
 * rendu React), la rangée de navigation est stable, glissement au pointeur. Comme le site : son (Web Audio)
 * à l'ouverture et à chaque changement de carte, étoile de favori sur la face, props React du carrousel
 * (`cards`, `onDone`) sur sa racine, L shiny montrée d'abord sans son habillage puis révélée (300 ms ici).
 * Comme le site aussi : après un glissement, le clic suivant sur la carte est ignoré (`window.__pulls.swiped`),
 * et la modale d'enchère se charge à sa première ouverture (`/_next/static/chunks/auction-modal.js`).
 * `window.__pulls.index` = carte affichée.
 */
const SCRIPT = `
(() => {
  const ARROW = 'w-12 h-12 rounded-full bg-[var(--color-surface-light)] border border-[var(--color-border)] flex items-center justify-center disabled:opacity-20 hover:bg-[var(--color-accent)]/10 transition-all cursor-pointer disabled:cursor-not-allowed';
  const DOT = 'w-3 h-3 rounded-full transition-all duration-200 cursor-pointer';
  const svg = (points) => '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="' + points + '"></polyline></svg>';
  const el = (tag, cls) => { const node = document.createElement(tag); node.className = cls; return node; };
  let cards = [], copies = [], index = 0, seen = new Set(), revealed = new Set(), revealTimer, counter, area, prev, dots, next, cont;
  let swiped = false;
  window.__pulls = { get index() { return index; }, get swiped() { return swiped; } };
  const stage = document.getElementById('stage');
  const choice = [...stage.children];

  let audio = null;
  function playSound() {
    try {
      audio = audio || new AudioContext();
      const source = audio.createBufferSource();
      source.buffer = audio.createBuffer(1, 128, 22050);
      source.connect(audio.destination);
      source.start();
    } catch (error) {}
  }

  // Routeur Next.js imité : l'objet de useRouter(), fourni par un contexte React au-dessus de <main>.
  const router = {
    push(href) {
      history.pushState(null, '', href);
      closeModal();
      document.getElementById('stage').textContent = 'Fiche ' + href;
    },
    replace(href) { this.push(href); },
    prefetch() {},
  };
  document.querySelector('main')['__reactFiber$test'] = {
    memoizedProps: {},
    return: { memoizedProps: { value: router, children: null }, return: null },
  };
  const copyOf = (card) => copies.find((copy) => copy.card_id === card.id)?.id;
  /** Cartes en favori, étiquettes par exemplaire (état du site, pour la modale). */
  const starred = new Set(), tags = new Map();

  async function open(url) {
    const body = await (await fetch(url, { method: 'POST' })).json();
    copies = body.owned_copies;
    if (!copies) {
      const ids = body.cards.map((c) => c.id).join(',');
      copies = await (await fetch('${SUPABASE}/rest/v1/user_cards?select=id,card_id,starred,is_shiny&user_id=eq.u0&card_id=in.(' + ids + ')')).json();
    }
    cards = body.cards; index = 0; seen = new Set([0]); revealed = new Set();
    build(); render();
    playSound();
  }
  function done() { closeModal(); stage.replaceChildren(...choice); }

  // Modale de carte du site (portail dans body) : favori, étiquette, enchères, défausse.
  function closeModal() { document.getElementById('auction-modal')?.remove(); document.getElementById('card-modal')?.remove(); }

  // Modale « Mettre aux enchères » (par-dessus la modale de la carte), comme le code du site : état
  // mise / durée / envoi / erreur, compteur d'enchères actives après GET /api/marketplace/mine ; après la
  // création, onListed ferme la modale d'enchère, puis router.push vers l'annonce.
  const DURATIONS = [['10 min', 10], ['30 min', 30], ['1 h', 60], ['3 h', 180], ['6 h', 360], ['12 h', 720]];
  const ACTIVE = 'bg-[var(--color-accent)] text-[var(--color-accent-foreground)] border-[var(--color-accent)]';
  const IDLE = 'border-[var(--color-border)] text-[var(--color-foreground)]/60';
  // Chargée à la première ouverture : roue (div.fixed.inset-0.z-[60]) rendue dans la modale de carte, puis
  // la vraie modale, en portail dans body, si la modale de carte est encore ouverte.
  let auctionLoaded = false;
  function openAuction(card) {
    if (auctionLoaded) return showAuction(card);
    const host = document.getElementById('card-modal');
    const loading = el('div', 'fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm');
    loading.innerHTML = '<div class="w-8 h-8 rounded-full animate-spin"></div>';
    host.append(loading);
    fetch('/_next/static/chunks/auction-modal.js').catch(() => {}).finally(() => {
      auctionLoaded = true;
      loading.remove();
      if (host.isConnected) showAuction(card);
    });
  }
  function showAuction(card) {
    let price = '10', minutes = 60, sending = false, error = null, selling = null, max = 10;
    const back = el('div', 'fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm');
    back.id = 'auction-modal';
    back.onclick = () => back.remove();
    const panel = el('div', 'card-frame relative max-w-lg w-full p-6');
    panel.onclick = (event) => event.stopPropagation();
    const close = el('button', 'absolute top-3 right-3'); close.type = 'button'; close.setAttribute('aria-label', 'Fermer'); close.textContent = '×';
    close.onclick = () => back.remove();
    const title = el('h2', 'text-lg font-bold'); title.textContent = 'Mettre aux enchères';
    const note = el('p', 'text-xs'); note.textContent = "Un exemplaire sera mis en réserve pour la durée de l'enchère.";
    const quota = el('p', 'text-[11px]');
    const face = el('div', 'w-28 h-40 glow-' + card.rarity.toLowerCase() + ' relative rounded-2xl overflow-hidden cursor-pointer hover:z-10');
    face.style.cssText = 'width:112px;height:160px;background:#30363d';
    const faceTitle = el('h3', 'text-[10px] shrink-0 font-bold'); faceTitle.textContent = card.wikipedia_title;
    face.append(faceTitle);
    const input = el('input', 'flex-1 min-w-0'); input.type = 'number'; input.setAttribute('aria-label', 'Mise de départ'); input.value = price;
    input.addEventListener('input', () => { price = input.value; render(); });
    const step = (label, delta) => {
      const b = el('button', 'flex items-center'); b.type = 'button'; b.setAttribute('aria-label', label); b.textContent = delta > 0 ? '+' : '−';
      b.onclick = () => { price = String(Math.max(1, Number(price) + delta)); input.value = price; render(); };
      return b;
    };
    const durationButtons = DURATIONS.map(([label, value]) => {
      const b = el('button', ''); b.type = 'button'; b.textContent = label; b.onclick = () => { minutes = value; render(); };
      return b;
    });
    const errorText = el('p', 'mt-4 text-xs text-red-500');
    const cancel = el('button', 'flex-1'); cancel.type = 'button'; cancel.textContent = 'Annuler'; cancel.onclick = () => back.remove();
    const launch = el('button', 'flex-1'); launch.type = 'button';
    launch.onclick = async () => {
      error = null; sending = true; render();
      const response = await fetch('/api/marketplace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ card_id: copyOf(card), base_amount: Number(price), duration_minutes: minutes }) });
      const body = await response.json();
      sending = false;
      if (!response.ok) { error = body.error ?? "Impossible de créer l'enchère"; render(); return; }
      back.remove();
      router.push('/marketplace/' + body.auction_id);
    };
    function render() {
      const valid = Number.isInteger(Number(price)) && Number(price) >= 1;
      const full = selling !== null && selling >= max;
      quota.textContent = selling === null ? '' : 'Enchères actives : ' + selling + '/' + max;
      durationButtons.forEach((b, i) => { b.className = 'px-3 py-1.5 rounded-full text-xs border ' + (DURATIONS[i][1] === minutes ? ACTIVE : IDLE); b.disabled = sending; });
      if (error) { errorText.textContent = error; launch.before(errorText); } else errorText.remove();
      cancel.disabled = sending;
      launch.disabled = sending || !valid || full;
      launch.textContent = sending ? 'Mise en vente…' : "Lancer l'enchère";
    }
    panel.append(close, title, note, quota, face, step('Diminuer', -1), input, step('Augmenter', 1), ...durationButtons, cancel, launch);
    back.append(panel);
    document.body.append(back);
    render();
    fetch('/api/marketplace/mine').then((r) => (r.ok ? r.json() : null)).then((body) => {
      if (!body) return;
      selling = body.sellingCount ?? 0; max = body.maxConcurrentAuctions ?? 10; render();
    });
  }
  // Structure relevée sur le site : face (image en haut, favori), colonne de droite (titre, ligne rareté +
  // onglets Détails / Marché, étiquettes, bloc « Signaler l'image »), rangée d'actions (icônes lucide).
  function openModal(card) {
    closeModal();
    const icon = (name) => '<svg class="lucide lucide-' + name + '" width="16" height="16"></svg>';
    const button = (cls, html, onclick) => { const b = el('button', cls); b.type = 'button'; b.innerHTML = html; b.onclick = onclick; return b; };
    const back = el('div', 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm');
    back.id = 'card-modal';
    const panel = el('div', 'card-frame relative w-full animate-fade-in-up p-6');
    const close = button('absolute top-3 right-3', '×', closeModal); close.setAttribute('aria-label', 'Fermer');

    const face = el('div', 'w-72 h-[420px] glow-' + card.rarity.toLowerCase() + ' relative rounded-2xl overflow-hidden cursor-pointer');
    face.style.cssText = 'width:200px;height:280px;background:#30363d';
    const image = el('div', 'absolute top-0 left-0 right-0 h-[45%] z-20 bg-black/20');
    image.style.cssText = 'position:absolute;top:0;left:0;right:0;height:45%;background:#57606a';
    // Comme le site : libellé et remplissage de l'étoile selon l'état.
    const starLabel = () => (starred.has(card.id) ? 'Retirer des favoris' : 'Ajouter aux favoris');
    const starIcon = () => '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="' + (starred.has(card.id) ? 'currentColor' : 'none') + '" stroke="currentColor" d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"></path></svg>';
    const star = button('p-0.5 rounded-md', starIcon(), () => {
      const next = !starred.has(card.id);
      if (next) starred.add(card.id); else starred.delete(card.id);
      star.setAttribute('aria-label', starLabel());
      star.innerHTML = starIcon();
      fetch('/rest/v1/user_cards?user_id=eq.u0&card_id=eq.' + card.id, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ starred: next }) });
    });
    star.setAttribute('aria-label', starLabel());
    star.style.cssText = 'position:absolute;top:4px;right:4px;z-index:30';
    const faceBody = el('div', 'absolute top-[45%] left-0 right-0 bottom-0 flex flex-col p-3 z-20');
    faceBody.style.cssText = 'position:absolute;top:45%;left:0;right:0;bottom:0';
    const faceTitle = el('h3', 'text-base shrink-0 font-bold'); faceTitle.textContent = card.wikipedia_title;
    const faceStats = el('div', 'mt-auto flex w-full items-center justify-between face-stats');
    faceStats.innerHTML = '<div>' + icon('swords') + card.atk + '</div><div>' + icon('shield') + card.def + '</div>';
    faceBody.append(faceTitle, faceStats);
    face.append(image, star, faceBody);
    const left = el('div', 'flex-shrink-0 flex justify-center'); left.append(face);

    const title = el('h2', 'text-xl font-bold leading-tight pr-10'); title.textContent = card.wikipedia_title;
    const rarityRow = el('div', 'flex items-center justify-between gap-2 mt-1');
    const rarity = el('span', 'inline-block px-2 py-0.5 rounded text-xs font-bold'); rarity.textContent = 'Commun';
    const tablist = el('div', 'flex shrink-0 gap-0.5 rounded-md border');
    tablist.setAttribute('role', 'tablist'); tablist.setAttribute('aria-label', 'Vue de la carte');
    const content = el('div', 'text-sm'); content.id = 'card-view'; content.textContent = 'Détails de la carte';
    const tab = (label, view) => {
      const t = button('rounded px-2 py-0.5 text-[10px]', label, () => {
        for (const other of tablist.children) other.setAttribute('aria-selected', String(other === t));
        content.textContent = view;
      });
      t.setAttribute('role', 'tab'); t.setAttribute('aria-selected', String(label === 'Détails'));
      return t;
    };
    tablist.append(tab('Détails', 'Détails de la carte'), tab('Marché', 'Vue du marché'));
    rarityRow.append(rarity, tablist);
    const header = el('div', ''); header.append(title, rarityRow);
    // Étiquettes de l'exemplaire : une pastille par étiquette, avec « Retirer l'étiquette <nom> ».
    const chips = el('div', 'flex flex-wrap gap-1.5');
    const renderChips = () => chips.replaceChildren(...(tags.get(copyOf(card)) ?? []).map((name) => {
      const chip = el('span', 'inline-flex items-center gap-1 rounded-full text-xs'); chip.textContent = name;
      const remove = button('p-0.5 rounded-full', '×', () => {
        tags.set(copyOf(card), (tags.get(copyOf(card)) ?? []).filter((other) => other !== name)); renderChips();
      });
      remove.setAttribute('aria-label', "Retirer l'étiquette " + name);
      chip.append(remove);
      return chip;
    }));
    renderChips();
    const tag = el('input', 'w-full rounded-lg'); tag.placeholder = 'Ajouter une étiquette…';
    tag.onkeydown = (e) => {
      if (e.key !== 'Enter') return;
      tags.set(copyOf(card), [...(tags.get(copyOf(card)) ?? []), tag.value || 'test']); tag.value = ''; renderChips();
      fetch('/rest/v1/user_card_tags', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user_card_id: copyOf(card), tag_id: 't1' }) });
    };
    const report = button('inline-flex items-center gap-1.5 rounded-lg', icon('flag') + "Signaler l'image", () => {
      report.setAttribute('aria-pressed', 'true'); report.disabled = true; report.innerHTML = icon('flag') + 'Image signalée';
    });
    report.setAttribute('aria-pressed', 'false');
    const reportBlock = el('div', 'border-t border-[var(--color-border)] pt-3');
    const reportInner = el('div', 'space-y-1.5'); reportInner.append(report); reportBlock.append(reportInner);
    // Colonne de droite : ATK / DEF en deux cases, puis le lien Wikipédia.
    const stats = el('div', 'grid grid-cols-2 gap-3');
    stats.innerHTML = '<div class="card-frame p-3 text-center"><div>' + icon('swords') + card.atk + '</div><div>ATK</div></div>' +
      '<div class="card-frame p-3 text-center"><div>' + icon('shield') + card.def + '</div><div>DEF</div></div>';
    const wiki = el('a', 'inline-flex text-sm'); wiki.href = '#wiki'; wiki.textContent = "Voir l'article sur Wikipédia →";
    const right = el('div', 'flex-1 flex flex-col min-w-0 md:pr-2 gap-4'); right.append(header, content, chips, tag, stats, wiki, reportBlock);
    const columns = el('div', 'flex flex-col md:flex-row gap-6'); columns.append(left, right);

    const auction = button('flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg', icon('gavel') + 'Mettre aux enchères', () => openAuction(card));
    // Comme le site : « Défausser » ouvre une confirmation, rendue dans le fond de la modale de carte.
    const discard = button('flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg border', icon('trash-2') + 'Défausser<span>+1</span>', () => {
      if (document.getElementById('discard-confirm')) return;
      const confirmBack = el('div', 'fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm');
      confirmBack.id = 'discard-confirm';
      confirmBack.onclick = (event) => event.stopPropagation();
      const box = el('div', 'card-frame max-w-sm w-full p-5');
      const heading = el('h3', 'text-base font-bold mb-2'); heading.textContent = 'Défausser cette carte ?';
      const text = el('p', 'text-sm'); text.textContent = "C'est votre dernière copie — elle sera retirée définitivement.";
      const error = el('p', 'text-xs text-red-500');
      const cancel = button('flex-1', 'Annuler', () => confirmBack.remove());
      // Comme le site : « … » et boutons désactivés pendant la requête, « Erreur réseau » sans réponse.
      const confirm = button('flex-1 bg-red-500', 'Défausser', async () => {
        error.textContent = '';
        confirm.disabled = cancel.disabled = true;
        confirm.textContent = '…';
        try {
          const response = await fetch('/api/user-cards/' + copyOf(card) + '/discard', { method: 'POST' });
          const body = await response.json();
          if (!response.ok) { error.textContent = body.error ?? 'Impossible de défausser'; return; }
          closeModal();
        } catch (failure) {
          error.textContent = 'Erreur réseau';
        } finally {
          confirm.disabled = cancel.disabled = false;
          confirm.textContent = 'Défausser';
        }
      });
      box.append(heading, text, error, cancel, confirm);
      confirmBack.append(box);
      back.append(confirmBack);
    });
    const row = el('div', 'flex flex-col sm:flex-row gap-2'); row.append(auction, discard);
    const actions = el('div', 'mt-3 space-y-2'); actions.append(row);

    panel.append(close, columns, actions);
    back.append(panel);
    document.body.append(back);
  }
  document.getElementById('open').onclick = () => open('/api/packs/open');
  document.getElementById('open-pro').onclick = () => open('/api/packs/pro-daily');

  function build() {
    const root = el('div', 'flex flex-col items-center gap-4 md:gap-8 py-2 md:py-8 animate-fade-in-up');
    root['__reactFiber$test'] = { memoizedProps: {}, return: { memoizedProps: { cards, ownedCopies: null, onDone: done }, return: null } };
    counter = el('div', 'flex items-center gap-2 text-sm text-[var(--color-foreground)]/50');
    area = el('div', 'relative inline-flex max-w-[min(100vw-2rem,28rem)] items-center justify-center');
    let start = null;
    area.addEventListener('pointerdown', (e) => { start = e.clientX; });
    area.addEventListener('pointerup', (e) => {
      if (start === null) return;
      const dx = e.clientX - start; start = null;
      const target = dx < 0 ? index + 1 : index - 1;
      if (Math.abs(dx) >= 48 && target >= 0 && target < cards.length) { swiped = true; go(target); }
    });
    const nav = el('div', 'flex items-center gap-4');
    prev = el('button', ARROW); prev.innerHTML = svg('15 18 9 12 15 6'); prev.onclick = () => go(index - 1);
    dots = el('div', 'flex items-center gap-2');
    cards.forEach((_, i) => { const dot = el('button', DOT); dot.onclick = () => go(i); dots.append(dot); });
    next = el('button', ARROW); next.innerHTML = svg('9 18 15 12 9 6'); next.onclick = () => go(index + 1);
    nav.append(prev, dots, next);
    cont = el('button', 'px-8 py-3 rounded-xl bg-[var(--color-accent)] disabled:opacity-40 disabled:cursor-not-allowed');
    cont.onclick = done;
    root.append(counter, area, nav, cont);
    stage.replaceChildren(root);
  }
  function go(i) {
    if (i < 0 || i >= cards.length) return;
    if (i !== index) playSound();
    index = i; seen.add(i); render();
  }
  function render() {
    const card = cards[index];
    const shinyL = card.is_shiny === true && card.rarity === 'L';
    const shiny = shinyL && revealed.has(index);
    const face = el('div', 'w-72 h-[420px] ' + (shiny ? 'glow-shiny shiny-card isolate' : 'glow-' + card.rarity.toLowerCase()) + ' relative rounded-2xl overflow-hidden cursor-pointer');
    face.style.cssText = 'width:160px;height:224px;background:#30363d;position:relative';
    face.onclick = () => {
      if (swiped) { swiped = false; return; }
      openModal(card);
    };
    const title = el('h3', 'text-xs shrink-0 font-bold');
    title.textContent = card.wikipedia_title;
    const on = starred.has(card.id);
    const star = el('button', 'p-0.5 rounded-md');
    star.type = 'button';
    star.setAttribute('aria-label', on ? 'Retirer des favoris' : 'Ajouter aux favoris');
    star.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="' + (on ? 'currentColor' : 'none') + '" stroke="currentColor" d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"></path></svg>';
    star.style.cssText = 'position:absolute;top:4px;right:4px';
    star.onclick = (event) => {
      event.stopPropagation();
      if (on) starred.delete(card.id); else starred.add(card.id);
      fetch('/rest/v1/user_cards?user_id=eq.u0&card_id=eq.' + card.id, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ starred: !on }) });
      render();
    };
    face.append(title, star);
    const flip = el('div', 'animate-card-flip relative touch-none cursor-grab active:cursor-grabbing select-none');
    flip.append(face);
    area.replaceChildren(flip);
    counter.textContent = 'Carte ' + (index + 1) + ' / ' + cards.length;
    // Comme le site : révélée si on reste sur la carte, sinon oubliée jusqu'au prochain passage.
    clearTimeout(revealTimer);
    if (shinyL && !shiny) revealTimer = setTimeout(() => { revealed.add(index); render(); }, 300);
    [...dots.children].forEach((dot, i) => {
      dot.className = DOT + ' ' + (i === index ? 'bg-[var(--color-accent)] scale-125' : seen.has(i) ? 'bg-[var(--color-foreground)]/30' : 'bg-[var(--color-foreground)]/10');
    });
    prev.disabled = index === 0;
    next.disabled = index === cards.length - 1;
    cont.disabled = seen.size < cards.length;
    cont.textContent = seen.size < cards.length ? 'Encore ' + (cards.length - seen.size) + ' cartes' : 'Continuer';
  }
})();
`;

export const PULLS_HTML = sitePage(
  '<div id="stage"><button id="open">Ouvrir</button> <button id="open-pro">Pack PRO du jour</button></div>',
  SCRIPT,
);
