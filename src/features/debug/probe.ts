import { isRecord } from '@/core/guards';

/**
 * Sonde de la Collection (`wm.debug.probeCollection()`) : ce que `/api/my-collection` accepte au-delà de
 * ce que le site envoie (tris, sens, plusieurs étiquettes…) et ce que Supabase permet en direct avec la
 * session du site. Lecture seule : des GET, un à la fois, espacés.
 */

export interface ProbeIo {
  /** GET d'une route du site (cookies joints). */
  site(path: string): Promise<Response>;
  /** GET Supabase avec la session du site. */
  supabase(path: string, headers?: Record<string, string>): Promise<Response>;
  userId(): string | undefined;
  progress(message: string): void;
  sleep(ms: number): Promise<void>;
}

export interface ProbeRow {
  readonly id: string;
  readonly title: string;
  readonly rarity: string | undefined;
  readonly obtainedAt: string | undefined;
  readonly starred: boolean;
  readonly shiny: boolean;
  readonly atk: number | undefined;
  readonly def: number | undefined;
  readonly qScore: number | undefined;
  readonly pageviews: number | undefined;
  readonly category: string | undefined;
  readonly cardCreatedAt: string | undefined;
  readonly tagIds: readonly string[];
}

type Entry = Record<string, unknown>;

export interface ProbeReport {
  readonly at: string;
  durationSeconds: number;
  requests: number;
  stopped?: string;
  tags: { name: string; cardCount: number }[];
  readonly stats: Entry[];
  readonly lists: Entry[];
  readonly supabase: Entry[];
}

const str = (value: unknown) => (typeof value === 'string' ? value : undefined);
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

export function readRow(raw: unknown): ProbeRow | undefined {
  if (!isRecord(raw) || typeof raw.id !== 'string') return undefined;
  const card = isRecord(raw.card) ? raw.card : {};
  const tags = Array.isArray(raw.tags) ? raw.tags : [];
  return {
    id: raw.id,
    title: str(card.wikipedia_title) ?? '',
    rarity: str(raw.snapshot_rarity) ?? str(card.rarity),
    obtainedAt: str(raw.obtained_at),
    starred: raw.starred === true,
    shiny: raw.is_shiny === true,
    atk: num(raw.snapshot_atk) ?? num(card.atk),
    def: num(raw.snapshot_def) ?? num(card.def),
    qScore: num(card.q_score),
    pageviews: num(card.pageviews),
    category: str(card.category),
    cardCreatedAt: str(card.created_at),
    tagIds: tags.flatMap((tag) => (isRecord(tag) && typeof tag.id === 'string' ? [tag.id] : [])),
  };
}

const RANK: Record<string, number> = { C: 0, PC: 1, R: 2, SR: 3, UR: 4, L: 5 };
const plain = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

const ORDER_KEYS: Record<string, (row: ProbeRow) => string | number | undefined> = {
  rareté: (row) => (row.rarity === undefined ? undefined : RANK[row.rarity]),
  nom: (row) => plain(row.title),
  ajout: (row) => row.obtainedAt,
  favori: (row) => (row.starred ? 1 : 0),
  shiny: (row) => (row.shiny ? 1 : 0),
  atk: (row) => row.atk,
  def: (row) => row.def,
  'atk+def': (row) => (row.atk === undefined || row.def === undefined ? undefined : row.atk + row.def),
  q_score: (row) => row.qScore,
  vues: (row) => row.pageviews,
  catégorie: (row) => (row.category === undefined ? undefined : plain(row.category)),
  'création de la carte': (row) => row.cardCreatedAt,
};

/**
 * Ordres que suit la liste, par exemple « ajout ↓ ». Toléré à 90 % des paires (noté « ~92 % ») : la
 * collation de Postgres ne range pas la ponctuation comme JavaScript. Une clé presque constante
 * (> 95 % de valeurs égales) ne dit rien et n'est pas retenue.
 */
export function orderOf(rows: readonly ProbeRow[]): string {
  const found: string[] = [];
  for (const [name, key] of Object.entries(ORDER_KEYS)) {
    const values = rows.map(key);
    if (values.length < 3 || values.some((value) => value === undefined)) continue;
    const counts = new Map<unknown, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    if (Math.max(...counts.values()) > 0.95 * values.length) continue;
    let up = 0;
    let down = 0;
    for (let i = 1; i < values.length; i++) {
      const a = values[i - 1];
      const b = values[i];
      if (a === undefined || b === undefined) continue;
      if (a <= b) up++;
      if (a >= b) down++;
    }
    const pairs = values.length - 1;
    const label = (count: number, arrow: string) => `${name} ${arrow}${count === pairs ? '' : ` ~${Math.round((100 * count) / pairs)} %`}`;
    if (up / pairs >= 0.9) found.push(label(up, '↑'));
    if (down / pairs >= 0.9) found.push(label(down, '↓'));
  }
  return found.join(', ') || 'aucun ordre simple';
}

/** Répartition des étiquettes A et B dans une liste (plusieurs `tag_id` : la première, l'union, l'intersection ?). */
export function tagMix(rows: readonly ProbeRow[], a: string, b: string): Entry {
  const has = (row: ProbeRow, id: string) => row.tagIds.includes(id);
  return {
    avecA: rows.filter((row) => has(row, a)).length,
    avecB: rows.filter((row) => has(row, b)).length,
    avecLesDeux: rows.filter((row) => has(row, a) && has(row, b)).length,
    niAniB: rows.filter((row) => !has(row, a) && !has(row, b)).length,
  };
}

/** Total d'un `Content-Range` PostgREST (`0-0/1461`, `*\/0`). */
export function rangeTotal(header: string | null): number | undefined {
  const total = header?.split('/')[1];
  return total === undefined || total === '*' ? undefined : Number(total);
}

interface Answer {
  readonly status: number;
  readonly ms: number;
  readonly body: unknown;
  readonly range: string | null;
}

/** Arrêt de la sonde : le rapport est rendu tel quel, avec la raison. */
export class ProbeStop extends Error {}

const RETRIED = new Set([0, 403, 404, 408, 500, 502, 503, 504]);
const SORTS = ['atk', 'def', 'power', 'title', 'obtained_at', 'date', 'recent', 'newest', 'oldest', 'shiny', 'q_score', 'quality', 'pageviews', 'popularity', 'category', 'count', 'random'];
const DIRECTIONS = ['order=desc', 'dir=desc', 'direction=desc', 'sort_dir=desc', 'sortOrder=desc', 'desc=1', 'reverse=1', 'ascending=false'];
const SORT_SUFFIXES = ['name_desc', '-name', 'name.desc', 'name:desc', 'added_asc', '-added', 'added.asc', 'rarity_asc'];
const UNKNOWN_FILTERS = ['starred=1', 'favorites=1', 'shiny=1', 'is_shiny=1'];

export async function runCollectionProbe(io: ProbeIo): Promise<ProbeReport> {
  const started = Date.now();
  const report: ProbeReport = {
    at: new Date(started).toISOString(),
    durationSeconds: 0,
    requests: 0,
    tags: [],
    stats: [],
    lists: [],
    supabase: [],
  };

  async function ask(send: () => Promise<Response>): Promise<Answer> {
    for (let attempt = 0; ; attempt++) {
      await io.sleep(attempt === 0 ? 400 : 1500);
      const t = Date.now();
      let answer: Answer;
      try {
        const response = await send();
        const text = await response.text().catch(() => '');
        let body: unknown = text.slice(0, 300);
        try {
          body = JSON.parse(text);
        } catch {
          // corps non JSON : gardé en texte, tronqué
        }
        answer = { status: response.status, ms: Date.now() - t, body, range: response.headers.get('content-range') };
      } catch (error) {
        answer = { status: 0, ms: Date.now() - t, body: String(error), range: null };
      }
      report.requests++;
      if (report.requests % 10 === 0) io.progress(`${report.requests} requêtes…`);
      const code = isRecord(answer.body) ? (str(answer.body.code) ?? str(answer.body.error)) : undefined;
      if (answer.status === 401) throw new ProbeStop('session expirée : recharger la page puis relancer');
      if (answer.status === 429 || code === 'automation_limit') throw new ProbeStop(`refus du site (${answer.status} ${code ?? ''}) : sonde arrêtée`);
      if (attempt < 2 && RETRIED.has(answer.status)) continue;
      return answer;
    }
  }

  const errorOf = (answer: Answer) =>
    answer.status >= 200 && answer.status < 300
      ? undefined
      : typeof answer.body === 'string'
        ? answer.body
        : JSON.stringify(answer.body).slice(0, 300);

  // Identifiants remplacés dans le rapport (étiquettes A / B, utilisateur)
  const names = new Map<string, string>();
  const anonymize = (text: string) => [...names].reduce((acc, [id, name]) => acc.replaceAll(id, name), text);

  async function stats(test: string, query: string) {
    const answer = await ask(() => io.site(`/api/my-collection/stats?${query}`));
    const body = isRecord(answer.body) ? answer.body : {};
    const counts = isRecord(body.rarityCounts) ? Object.values(body.rarityCounts).reduce<number>((sum, n) => sum + (num(n) ?? 0), 0) : undefined;
    report.stats.push({ test, query: anonymize(query), status: answer.status, ms: answer.ms, total: body.total, sommeRaretés: counts, erreur: errorOf(answer) });
    return body;
  }

  const signatures = new Map<string, string>();
  async function list(test: string, query: string, extra?: (rows: readonly ProbeRow[]) => Entry) {
    const answer = await ask(() => io.site(`/api/my-collection?${query}${query ? '&' : ''}page=0&stats=0`));
    const raw = isRecord(answer.body) && Array.isArray(answer.body.collection) ? answer.body.collection : undefined;
    const rows = raw?.flatMap((item) => readRow(item) ?? []);
    const signature = rows ? rows.map((row) => row.id).join() : `statut ${answer.status}`;
    const same = [...signatures].filter(([, sig]) => sig === signature).map(([name]) => name);
    report.lists.push({
      test,
      query: anonymize(query),
      status: answer.status,
      ms: answer.ms,
      lignes: rows?.length,
      ordre: rows ? orderOf(rows) : undefined,
      identiqueÀ: same.join(' = ') || undefined,
      premières: rows?.slice(0, 4).map((row) => `${row.title} (${row.rarity ?? '?'})`).join(' · '),
      ...(rows && extra ? extra(rows) : {}),
      erreur: errorOf(answer),
    });
    return signature;
  }

  async function supabase(test: string, path: string, options: { count?: boolean; headers?: Record<string, string> } = {}) {
    const headers = { ...(options.count ? { prefer: 'count=exact' } : {}), ...options.headers };
    const answer = await ask(() => io.supabase(`/rest/v1/${path}`, headers));
    const entry: Entry = { test, path: anonymize(path), status: answer.status, ms: answer.ms };
    if (options.count) entry.total = rangeTotal(answer.range);
    const error = errorOf(answer);
    if (error) entry.erreur = error;
    report.supabase.push(entry);
    return { answer, entry };
  }

  try {
    io.progress('étiquettes et totaux');
    const base = await stats('référence', 'sort=rarity');
    const tags = (Array.isArray(base.tagOptions) ? base.tagOptions : [])
      .flatMap((tag) => (isRecord(tag) && typeof tag.id === 'string' ? [{ id: tag.id, name: str(tag.name) ?? '?', cardCount: num(tag.cardCount) ?? 0 }] : []))
      .sort((a, b) => b.cardCount - a.cardCount);
    report.tags = tags.map(({ name, cardCount }) => ({ name, cardCount }));
    const [a, b] = tags;
    if (a) names.set(a.id, 'A');
    if (b) names.set(b.id, 'B');
    for (const tag of tags.slice(2)) names.set(tag.id, `étiquette:${tag.name}`);

    if (a && b) {
      await stats(`seule A (${a.name}, ${a.cardCount})`, `sort=rarity&tag_id=${a.id}`);
      await stats(`seule B (${b.name}, ${b.cardCount})`, `sort=rarity&tag_id=${b.id}`);
      for (const query of [
        `tag_id=${a.id}&tag_id=${b.id}`,
        `tag_id=${b.id}&tag_id=${a.id}`,
        `tag_id=${a.id},${b.id}`,
        `tag_ids=${a.id},${b.id}`,
        `tag_ids=${a.id}&tag_ids=${b.id}`,
        `tag_ids[]=${a.id}&tag_ids[]=${b.id}`,
        `tags=${a.id},${b.id}`,
        `exclude_tag_id=${a.id}`,
        `not_tag_id=${a.id}`,
        `tag_id=${a.id}&untagged=1`,
      ]) {
        await stats(anonymize(query), `sort=rarity&${query}`);
      }
      const mix = (rows: readonly ProbeRow[]) => tagMix(rows, a.id, b.id);
      await list('liste tag_id=A&tag_id=B', `sort=added&tag_id=${a.id}&tag_id=${b.id}`, mix);
      await list('liste tag_id=B&tag_id=A', `sort=added&tag_id=${b.id}&tag_id=${a.id}`, mix);
    } else {
      io.progress('moins de deux étiquettes : tests à plusieurs étiquettes sautés');
    }

    io.progress('filtres');
    for (const filter of UNKNOWN_FILTERS) await stats(filter, `sort=rarity&${filter}`);
    await stats('rarity=SR', 'sort=rarity&rarity=SR');
    await stats('q=olymp', 'sort=rarity&q=olymp');

    io.progress('tris');
    for (const sort of ['rarity', 'name', 'starred', 'added', 'zzz']) signatures.set(`sort=${sort}`, await list(`sort=${sort}`, `sort=${sort}`));
    signatures.set('sans sort', await list('sans sort', ''));
    for (const sort of SORTS) await list(`sort=${sort}`, `sort=${sort}`);

    io.progress('sens du tri');
    const flip = (direction: string) => direction.replace('desc', 'asc').replace('false', 'true');
    const working: string[] = [];
    for (const direction of DIRECTIONS) {
      const signature = await list(`name + ${direction}`, `sort=name&${direction}`);
      if (signature !== signatures.get('sort=name') && !signature.startsWith('statut')) working.push(direction);
    }
    for (const sort of SORT_SUFFIXES) await list(`sort=${sort}`, `sort=${sort}`);
    for (const direction of working) {
      await list(`added + ${flip(direction)}`, `sort=added&${flip(direction)}`);
      await list(`rarity + ${flip(direction)}`, `sort=rarity&${flip(direction)}`);
    }

    io.progress('taille de page');
    for (const size of ['limit=20', 'per_page=20', 'pageSize=20']) await list(size, `sort=rarity&${size}`);

    io.progress('Supabase en direct');
    const uid = io.userId();
    if (!uid) {
      report.supabase.push({ test: 'session', erreur: 'session Supabase du site pas encore vue : recharger la page /collection puis relancer' });
    } else {
      names.set(uid, '<uid>');
      const me = `user_id=eq.${uid}`;
      const columns = (answer: Answer) => (Array.isArray(answer.body) && isRecord(answer.body[0]) ? Object.keys(answer.body[0]).join(', ') : undefined);

      for (const table of ['user_cards', 'cards', 'user_card_tags', 'tags']) {
        const { answer, entry } = await supabase(`colonnes de ${table}`, `${table}?select=*${table === 'user_cards' || table === 'tags' ? `&${me}` : ''}&limit=1`);
        entry.colonnes = columns(answer);
      }
      await supabase('total des exemplaires', `user_cards?select=id&${me}&limit=1`, { count: true });

      if (a && b) {
        await supabase('A ou B', `user_cards?select=id,user_card_tags!inner(tag_id)&${me}&user_card_tags.tag_id=in.(${a.id},${b.id})&limit=1`, { count: true });
        await supabase('A et B', `user_cards?select=id,a:user_card_tags!inner(tag_id),b:user_card_tags!inner(tag_id)&${me}&a.tag_id=eq.${a.id}&b.tag_id=eq.${b.id}&limit=1`, { count: true });
        await supabase('sans A', `user_cards?select=id,x:user_card_tags(tag_id)&${me}&x.tag_id=eq.${a.id}&x=is.null&limit=1`, { count: true });
        await supabase('A mais pas B', `user_cards?select=id,a:user_card_tags!inner(tag_id),x:user_card_tags(tag_id)&${me}&a.tag_id=eq.${a.id}&x.tag_id=eq.${b.id}&x=is.null&limit=1`, { count: true });
      }
      await supabase('sans étiquette', `user_cards?select=id,user_card_tags(tag_id)&${me}&user_card_tags=is.null&limit=1`, { count: true });
      await supabase('rareté SR (carte)', `user_cards?select=id,cards!inner(rarity)&${me}&cards.rarity=eq.SR&limit=1`, { count: true });
      await supabase('rareté SR (exemplaire)', `user_cards?select=id&${me}&snapshot_rarity=eq.SR&limit=1`, { count: true });
      await supabase('recherche olymp', `user_cards?select=id,cards!inner(search_document)&${me}&cards.search_document=ilike.*olymp*&limit=1`, { count: true });

      const firsts = (answer: Answer, show: (item: Record<string, unknown>, card: Record<string, unknown>) => string) =>
        Array.isArray(answer.body) ? answer.body.map((item) => (isRecord(item) ? show(item, isRecord(item.cards) ? item.cards : {}) : '?')).join(' · ') : undefined;
      const byAtk = await supabase('tri ATK ↓', `user_cards?select=id,cards(wikipedia_title,atk)&${me}&order=cards(atk).desc&limit=5`);
      byAtk.entry.premières = firsts(byAtk.answer, (_, card) => `${String(card.wikipedia_title)} ${String(card.atk)}`);
      const byRarity = await supabase('tri rareté ↑ puis ajout ↑', `user_cards?select=id,obtained_at,cards(wikipedia_title,rarity,rarity_order)&${me}&order=cards(rarity_order).asc,obtained_at.asc&limit=5`);
      byRarity.entry.premières = firsts(byRarity.answer, (item, card) => `${String(card.wikipedia_title)} ${String(card.rarity)} ${String(item.obtained_at)}`);
      const oldest = await supabase('tri ajout ↑', `user_cards?select=id,obtained_at&${me}&order=obtained_at.asc&limit=3`);
      oldest.entry.premières = firsts(oldest.answer, (item) => String(item.obtained_at));
      const big = await supabase('lignes par requête (limit=5000)', `user_cards?select=id&${me}&limit=5000`, { count: true });
      big.entry.lignes = Array.isArray(big.answer.body) ? big.answer.body.length : undefined;
    }
  } catch (error) {
    if (!(error instanceof ProbeStop)) throw error;
    report.stopped = error.message;
  }
  report.durationSeconds = Math.round((Date.now() - started) / 1000);
  return report;
}
