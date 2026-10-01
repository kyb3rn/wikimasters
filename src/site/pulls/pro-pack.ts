import { isRecord, parseJson } from '@/core/guards';
import type { NetRequest } from '@/core/net';
import { currentFiberAncestors, stateHooks, type StateHook } from '@/core/react';
import { textOf } from '@/core/text';
import { PRO_DAILY_PATH } from '@/site/api';

/**
 * Cadre du pack PRO du jour, en bas du choix du paquet (comptes PRO, code du site du 30/09/2026) :
 *
 *   div.w-full.max-w-sm.animate-fade-in-up.rounded-xl.border.border-violet-500/25.bg-violet-950/20.px-4.py-3.flex.flex-col.gap-2
 *     p « Pack PRO du jour »
 *     puis, selon l'état de la page :
 *       disponible     button « Ouvrir le pack PRO du jour » (« Ouverture… » et désactivé pendant l'ouverture)
 *       déjà réclamé   p « Déjà réclamé aujourd’hui (heure de ton appareil). Reviens demain ! »
 *       ni l'un ni l'autre : rien (réponse de `GET /api/packs/pro-daily` pas encore reçue, ou en échec)
 */
export interface ProPack {
  readonly root: HTMLElement;
  /** Bouton d'ouverture du site (pack disponible). */
  readonly button: HTMLButtonElement | undefined;
  readonly claimed: boolean;
}

const TITLE = 'Pack PRO du jour';

export function findProPack(doc: Document = document): ProPack | undefined {
  for (const title of doc.querySelectorAll('main div > p:first-child')) {
    if (textOf(title) !== TITLE) continue;
    const root = title.parentElement;
    if (!(root instanceof HTMLElement)) continue;
    const button = root.querySelector('button');
    const claimed = [...root.querySelectorAll(':scope > p')].some((line) => textOf(line).startsWith('Déjà réclamé'));
    return { root, button: button ?? undefined, claimed };
  }
  return undefined;
}

const CLAIM_KEY = 'wikimasters:pro-daily-claimed';

/**
 * Jour où le pack a été ouvert (« 2026-09-30 », jour de l'appareil), que le site retient dans son stockage
 * (`{ userId, date }`, écrit dès qu'il le sait réclamé) pour ne pas redemander avant le lendemain.
 */
export function proClaimDate(): string | undefined {
  let stored: unknown;
  try {
    stored = parseJson(localStorage.getItem(CLAIM_KEY) ?? 'null');
  } catch {
    // Stockage refusé par le navigateur.
    return undefined;
  }
  const date = isRecord(stored) ? stored.date : undefined;
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
}

/** Le site demande si le pack du jour est disponible (à l'arrivée, et après chaque paquet refermé). */
export function isProDailyStatus(request: NetRequest): boolean {
  return request.method === 'GET' && isProDaily(request);
}

/** Route du pack du jour : lecture de sa disponibilité (`GET`) ou ouverture (`POST`). */
export function isProDaily(request: NetRequest): boolean {
  return request.url.pathname === PRO_DAILY_PATH;
}

/** États de la page /pulls qui décident de ce que montre le cadre : disponible, déjà réclamé. */
export interface ProDailyStates {
  readonly eligible: StateHook;
  readonly claimed: StateHook;
}

const PLATFORMS: readonly unknown[] = ['web', 'ios', 'android'];

/**
 * États de la page /pulls (code du site, 30/09/2026). La page est le premier composant à états au-dessus du
 * cadre, son premier état est le profil (`packs_remaining`…). Ses états se suivent ainsi : …, plateforme
 * (`"web"`, `"ios"`, `"android"`), disponible, déjà réclamé, ouverture en cours (booléens), … ; les compter
 * depuis le début ne tiendrait pas : des hooks du site (utilisateur, adresse) en ont peut-être aussi.
 * Les changer fait redessiner le cadre par le site, comme sa propre réponse.
 */
export function findProDailyStates(pack: ProPack): ProDailyStates | undefined {
  const page = currentFiberAncestors(pack.root).find((fiber) => {
    const profile = stateHooks(fiber)[0]?.value;
    return isRecord(profile) && 'packs_remaining' in profile;
  });
  const states = page ? stateHooks(page) : [];
  const platform = states.findIndex((state) => PLATFORMS.includes(state.value));
  const [eligible, claimed, opening] = platform < 0 ? [] : states.slice(platform + 1, platform + 4);
  if (!eligible || !claimed || !opening || ![eligible, claimed, opening].every((state) => typeof state.value === 'boolean')) return undefined;
  // Le site montre le bouton si disponible, sinon la phrase si réclamé : sinon ce ne sont pas ces états-là.
  const shown = eligible.value === Boolean(pack.button) && (Boolean(pack.button) || claimed.value === pack.claimed);
  return shown ? { eligible, claimed } : undefined;
}
