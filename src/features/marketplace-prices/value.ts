import { formatNumber, plural, type MarketEntry } from '@/services/market';
import type { Sale } from '@/site/api';
import type { Rarity } from '@/site/rarity';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/*
 * Le marché bouge vite (−20 % en une journée) : une vente compte d'autant moins qu'elle est ancienne, avec une
 * demi-vie choisie pour qu'il reste l'équivalent de 10 ventes. 15 ventes dans la journée : demi-vie d'environ 19 h,
 * une vente d'il y a 72 h ne pèse presque plus. 2 ventes dans la semaine : demi-vie maximale, et l'estimation est
 * peu sûre (prudence forte, cadre en tirets).
 *
 * La revente vise le haut de la fourchette (demande de l'utilisateur, 02/10) : sur 10 ventes, 7 à 150 et 3 à 200,
 * vendre à 200 est possible, en remettant en vente jusqu'à trouver l'acheteur. Il faut 30 % des ventes (en poids ;
 * un quart visait « un rien trop haut ») et au moins 3 ventes à ce prix ou plus : deux ventes à 70 et 1 400 ne font
 * pas une carte à 1 400.
 *
 * Pas de tendance prolongée : avec des ventes aussi dispersées (de 30 à 420 en une demi-journée pour la même carte),
 * la pente tirée d'une dizaine de ventes est du bruit. Sur les ventes des captures du 29/09 au 02/10, elle annonçait
 * même l'inverse de ce qui a suivi.
 */
const EQUIVALENT_SALES = 10;
const HALF_LIFE = { min: 3 * HOUR, max: 7 * DAY };
/** Ventes plus anciennes : poids négligeable même à la demi-vie maximale. */
const HORIZON = 10 * HALF_LIFE.max;
/**
 * Haut de la fourchette : part des ventes (en poids) et nombre de ventes récentes qui l'atteignent au moins. Récente :
 * de moins de 3 demi-vies (poids d'au moins 1/8) ; deux ventes du mois dernier ne comptent pas pour deux.
 */
const TOP_SHARE = 0.3;
const TOP_SALES = 3;
const RECENT_WEIGHT = 1 / 8;
/**
 * Rythme des ventes : le meilleur des rythmes vus sur ces durées, une vente retirée par prudence. 7 ventes
 * aujourd'hui font une carte qui se vend, même sans vente le mois d'avant.
 */
const PACE_WINDOWS = [DAY, 3 * DAY, 7 * DAY, 30 * DAY];

/**
 * Écart type d'un jour à l'autre (en log) : le prix dérive depuis la dernière vente connue et pendant qu'on attend
 * la revente.
 */
const DAILY_VOLATILITY = 0.08;
/**
 * Incertitude (en log) d'un prix tiré d'une seule vente, divisée par la racine du nombre équivalent de ventes :
 * deux ventes au même prix ne prouvent pas un prix fixe.
 */
const SAMPLE_UNCERTAINTY = 0.1;
/** Part du prix visé retirée par prudence au-delà de laquelle l'estimation est peu sûre (tirets). */
const UNSURE = 0.1;

/** Revente en 10 min au mieux (durée minimale d'une enchère), 24 h au pire (on aura baissé le prix d'ici là). */
const RESALE = { min: 10 * MINUTE, max: DAY };

/** Intérêt à partir duquel la carte est colorée : vert à 10, bleu à 50, rose à 200 (en wikibidous). */
const INTEREST_STOPS: readonly (readonly [score: number, color: string])[] = [
  [10, '#4ee329'],
  [50, '#00c3ff'],
  [200, '#ff00ea'],
];

/** Ce que les ventes récentes d'une carte disent du marché, indépendamment de l'heure qu'il est. */
interface MarketStats {
  /** Médiane pondérée des prix. */
  readonly market: number;
  /** Haut de la fourchette des prix. */
  readonly top: number;
  /** Part des ventes (en poids) au haut de la fourchette ou plus. */
  readonly topShare: number;
  /** Date de la dernière vente (ms). */
  readonly latest: number;
  /** Nombre équivalent de ventes indépendantes. */
  readonly effective: number;
  /** Ventes par ms. */
  readonly rate: number;
}

/** Estimation de la revente d'une carte, à un moment donné. */
export interface MarketValue {
  /** Prix du marché : médiane des ventes pondérées par leur fraîcheur. */
  readonly market: number;
  /** Haut de la fourchette : prix atteint par 30 % des ventes (en poids) et au moins 3 ventes. */
  readonly top: number;
  /** Part des ventes (en poids) au haut de la fourchette ou plus. */
  readonly topShare: number;
  /** Part retirée par prudence (peu de ventes, données qui vieillissent). */
  readonly caution: number;
  /** Revente estimée : haut de la fourchette, prudence comprise, arrondie en dessous. */
  readonly value: number;
  readonly salesPerDay: number;
  /** Temps estimé pour revendre au haut de la fourchette (ms) : seule une part des acheteurs paie ce prix. */
  readonly resale: number;
  /** Peu de ventes récentes, ou données anciennes : à prendre avec des pincettes. */
  readonly unsure: boolean;
}

export interface Interest {
  /** Revente estimée moins le montant de l'annonce. */
  readonly gain: number;
  /** Gain moins ce que coûte le slot pendant la revente. */
  readonly score: number;
  /** Couleur de l'intérêt ; trop faible : `undefined`. */
  readonly color: string | undefined;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

/** Valeur sous laquelle se trouve la part `quantile` des poids. */
function weightedQuantile(values: readonly number[], weights: readonly number[], quantile: number): number {
  const order = values.map((_, index) => index).sort((a, b) => (values[a] ?? 0) - (values[b] ?? 0));
  const target = sum(weights) * quantile;
  let acc = 0;
  for (const index of order) {
    acc += weights[index] ?? 0;
    if (acc >= target) return values[index] ?? 0;
  }
  return values[order.at(-1) ?? 0] ?? 0;
}

/**
 * Prix le plus haut atteint par la part `share` des poids et par au moins `count` ventes récentes ; sinon la plus
 * basse des ventes récentes (de toutes, s'il n'y en a pas).
 */
function reachedPrice(values: readonly number[], weights: readonly number[], share: number, count: number): number {
  const order = values.map((_, index) => index).sort((a, b) => (values[b] ?? 0) - (values[a] ?? 0));
  const target = sum(weights) * share;
  let acc = 0;
  let recent = 0;
  let lowestRecent: number | undefined;
  for (const index of order) {
    const weight = weights[index] ?? 0;
    acc += weight;
    if (weight >= RECENT_WEIGHT) {
      recent++;
      lowestRecent = values[index];
    }
    if (recent >= count && acc >= target) return values[index] ?? 0;
  }
  return lowestRecent ?? values[order.at(-1) ?? 0] ?? 0;
}

const weightOf = (age: number, halfLife: number) => 2 ** (-age / halfLife);
const totalWeight = (ages: readonly number[], halfLife: number) => sum(ages.map((age) => weightOf(age, halfLife)));

/** Demi-vie qui laisse l'équivalent de 10 ventes, entre 3 h et 7 jours. */
export function halfLifeFor(ages: readonly number[]): number {
  if (totalWeight(ages, HALF_LIFE.max) <= EQUIVALENT_SALES) return HALF_LIFE.max;
  if (totalWeight(ages, HALF_LIFE.min) >= EQUIVALENT_SALES) return HALF_LIFE.min;
  let [low, high] = [HALF_LIFE.min, HALF_LIFE.max];
  for (let step = 0; step < 40; step++) {
    const middle = Math.sqrt(low * high);
    if (totalWeight(ages, middle) < EQUIVALENT_SALES) low = middle;
    else high = middle;
  }
  return high;
}

/** Statistiques des ventes, vues au moment de leur chargement (`at`) : rien n'est connu des ventes suivantes. */
function marketStats(input: readonly Sale[], at: number): MarketStats | undefined {
  const sales = input.filter((sale) => sale.price > 0 && at - sale.time <= HORIZON);
  if (sales.length === 0) return undefined;
  const ages = sales.map((sale) => Math.max(0, at - sale.time));
  const halfLife = halfLifeFor(ages);
  const weights = ages.map((age) => weightOf(age, halfLife));
  const total = sum(weights);
  const prices = sales.map((sale) => sale.price);
  const top = reachedPrice(prices, weights, TOP_SHARE, TOP_SALES);
  return {
    market: weightedQuantile(prices, weights, 0.5),
    top,
    topShare: sum(weights.filter((_, index) => (prices[index] ?? 0) >= top)) / total,
    latest: Math.max(...sales.map((sale) => sale.time)),
    effective: total ** 2 / sum(weights.map((weight) => weight ** 2)),
    rate: Math.max(...PACE_WINDOWS.map((window) => (ages.filter((age) => age <= window).length - 1) / window)),
  };
}

/** Revente estimée d'après des ventes chargées à `fetchedAt`, à l'instant `now` (heure du serveur). */
export function marketValue(sales: readonly Sale[], fetchedAt: number, now: number): MarketValue | undefined {
  const stats = marketStats(sales, fetchedAt);
  return stats && valueAt(stats, now);
}

function valueAt(stats: MarketStats, now: number): MarketValue {
  // Seule une part des acheteurs paie le haut de la fourchette : la revente attend l'un d'eux.
  const pace = stats.rate * stats.topShare;
  const resale = pace > 0 ? clamp(1 / pace, RESALE.min, RESALE.max) : RESALE.max;
  const drift = DAILY_VOLATILITY * Math.sqrt(Math.max(0, now + resale - stats.latest) / DAY);
  const sigma = Math.hypot(SAMPLE_UNCERTAINTY / Math.sqrt(stats.effective), drift);
  const caution = -Math.expm1(-sigma);
  return {
    market: stats.market,
    top: stats.top,
    topShare: stats.topShare,
    caution,
    value: Math.floor(stats.top * Math.exp(-sigma)),
    salesPerDay: stats.rate * DAY,
    resale,
    unsure: caution > UNSURE,
  };
}

const stats = new WeakMap<MarketEntry, Map<string, MarketStats | undefined>>();

/** `marketValue` des ventes en cache dans la rareté (toutes si elle est inconnue), statistiques gardées par chargement. */
export function entryValue(entry: MarketEntry, rarity: Rarity | undefined, now: number): MarketValue | undefined {
  const key = rarity ?? '';
  let byRarity = stats.get(entry);
  if (!byRarity) stats.set(entry, (byRarity = new Map<string, MarketStats | undefined>()));
  if (!byRarity.has(key)) {
    const sales = rarity ? entry.sales.filter((sale) => sale.rarity === rarity) : entry.sales;
    byRarity.set(key, marketStats(sales, entry.fetchedAt));
  }
  const found = byRarity.get(key);
  return found && valueAt(found, now);
}

const channels = (hex: string) => [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
const hex = (values: readonly number[]) => `#${values.map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`;

/** Couleur d'un intérêt, en dégradé entre les paliers ; sous le premier : `undefined`. */
export function interestColor(score: number): string | undefined {
  const first = INTEREST_STOPS[0];
  if (!first || !(score >= first[0])) return undefined;
  let low = first;
  for (const high of INTEREST_STOPS.slice(1)) {
    if (score <= high[0]) {
      const t = (score - low[0]) / (high[0] - low[0]);
      const [from, to] = [channels(low[1]), channels(high[1])];
      return hex(from.map((value, index) => value + ((to[index] ?? value) - value) * t));
    }
    low = high;
  }
  return low[1];
}

/** Intérêt d'une annonce à `amount` : gain à la revente, moins le slot occupé (`slotHour` wikibidous par heure). */
export function interestOf(value: MarketValue, amount: number, slotHour: number): Interest {
  const gain = value.value - amount;
  const score = Math.round(gain - (slotHour * value.resale) / HOUR);
  return { gain, score, color: interestColor(score) };
}

const signed = (value: number) => `${value < 0 ? '\u2212' : '+'}${formatNumber(Math.abs(value))}`;
const percent = (part: number) => `${signed(Math.round(part * 100))}\u00a0%`;
const duration = (ms: number) => (ms < HOUR ? `${Math.round(ms / MINUTE)} min` : `${Math.round(ms / HOUR)} h`);

function pace(perDay: number): string {
  if (perDay >= 1) return `≈ ${plural(Math.round(perDay), 'vente')} par jour`;
  const perWeek = Math.round(perDay * 7);
  return perWeek >= 1 ? `≈ ${plural(perWeek, 'vente')} par semaine` : 'Ventes rares';
}

/** Détail de l'estimation, une ligne par étape (survol du prix) ; `interest` : annonce en cours. */
export function valueDetail(value: MarketValue, interest: Interest | undefined): string {
  const top = formatNumber(Math.round(value.top));
  const parts = [`marché ${formatNumber(Math.round(value.market))}`];
  if (Math.round(value.top) !== Math.round(value.market)) parts.push(`haut de fourchette ${top}`);
  parts.push(`prudence ${percent(-value.caution)}`);
  if (value.unsure) parts.push('peu sûre');
  const share = Math.round(value.topShare * 100);
  const lines = [
    `Revente estimée : ${formatNumber(value.value)} (${parts.join(', ')})`,
    `${pace(value.salesPerDay)}${share < 100 ? `, dont ${share}\u00a0% à ${top} ou plus` : ''} : revente en ≈ ${duration(value.resale)}`,
  ];
  if (interest) lines.push(`Gain estimé : ${signed(interest.gain)} · intérêt : ${signed(interest.score)}`);
  return lines.join('\n');
}
