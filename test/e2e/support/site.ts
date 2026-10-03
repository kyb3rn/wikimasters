import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, type Locator, type Page, type Route } from '@playwright/test';
import { KIT_SCRIPT } from './kit';

const SITE = 'https://www.wiki-masters.com';
export const SUPABASE = 'https://x.supabase.co';

/** Jeton de session Supabase imité : son `sub` est l'utilisateur `u0`. */
export const FAKE_JWT = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from('{"sub":"u0"}').toString('base64url')}.signature`;

const ROOT = path.resolve(import.meta.dirname, '../../..');

/** Version du script (`package.json`), affichée par lui. */
export const VERSION = (JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { version: string }).version;

/** Version de dev construite par `npm run test:e2e` avant les tests (ailleurs avec `WM_DEV_BUNDLE`, voir build.mjs). */
const DEV_BUNDLE = path.resolve(ROOT, process.env.WM_DEV_BUNDLE ?? 'dist/wikimasters.dev.js');

/** Classes du bouton du solde relevées sur le site (29/09/2026). */
const BALANCE_CLASSES =
  'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-[var(--color-accent)] ' +
  'bg-[var(--color-surface)]/90 hover:bg-[var(--color-accent)]/10 transition-colors tabular-nums cursor-pointer';

/**
 * En-tête du site : solde en barre du haut sur mobile, en boîte fixe en haut à droite sur ordinateur.
 * Un peu de CSS remplace Tailwind pour la mise en page (positions, affichage selon la largeur).
 */
const HEADER = `
<div class="md:hidden fixed top-0 left-0 right-0 z-50 pointer-events-none">
  <div class="flex h-11 items-center justify-end gap-1 pr-2 pl-4 pointer-events-auto">
    <button type="button" class="${BALANCE_CLASSES}" aria-label="Ouvrir la boutique WikiBidous">12 660</button>
    <button type="button" aria-label="Notifications">🔔</button>
  </div>
</div>
<div class="hidden md:block fixed top-0 right-0 z-50 pointer-events-none" style="padding:12px">
  <button type="button" class="${BALANCE_CLASSES} pointer-events-auto" aria-label="Ouvrir la boutique WikiBidous">12 660</button>
</div>`;

/**
 * Le site rend l'en-tête sur le serveur, puis React le reprend (hydratation) : il note alors son fiber sur chaque nœud.
 * Le script attend ce moment pour poser ses boutons devant le solde ; ici, l'en-tête est repris aussitôt.
 */
const HYDRATE_HEADER = `
for (const node of document.querySelectorAll('body > .fixed, body > .fixed *')) {
  if (!Object.keys(node).some((key) => key.startsWith('__reactFiber$'))) node.__reactFiber$test = { return: null, memoizedProps: {}, stateNode: node };
}`;

const LAYOUT_CSS = `
body { margin: 0; padding-top: 64px; background: #0d1117; color: #e6edf3; font-family: sans-serif; }
.fixed { position: fixed; } .top-0 { top: 0; } .right-0 { right: 0; } .left-0 { left: 0; } .inset-0 { inset: 0; }
.z-50 { z-index: 50; } .z-\\[60\\] { z-index: 60; } .z-\\[70\\] { z-index: 70; } .justify-center { justify-content: center; } .bg-black\\/70 { background: rgb(0 0 0 / 70%); }
.hidden { display: none; } .flex { display: flex; } .items-center { align-items: center; }
.justify-end { justify-content: flex-end; } .h-11 { height: 2.75rem; } .gap-1 { gap: .25rem; } .gap-4 { gap: 1rem; }
.gap-2 { gap: .5rem; } .flex-col { flex-direction: column; } .relative { position: relative; }
.pointer-events-none { pointer-events: none; } .pointer-events-auto { pointer-events: auto; }
.text-xs { font-size: .75rem; line-height: 1rem; } .font-semibold { font-weight: 600; }
.text-\\[var\\(--color-accent\\)\\] { color: rgb(227, 179, 65); }
.animate-fade-in-up { animation: fade-in-up 0.3s ease-out; }
@keyframes fade-in-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
@media (min-width: 768px) { .md\\:hidden { display: none; } .md\\:block { display: block; } }
`;

/** Page du site : en-tête avec le solde, puis `main`, puis `script` (qui dispose de `window.kit`, voir kit.ts). */
export function sitePage(main = '<h1>Page de test</h1>', script = ''): string {
  return (
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>WikiMasters (test)</title>` +
    `<style>${LAYOUT_CSS}</style></head><body>${HEADER}<script>${HYDRATE_HEADER}</script><main>${main}</main>` +
    (script ? `<script>${KIT_SCRIPT}</script><script>${script}</script>` : '') +
    `</body></html>`
  );
}

/** WAV mono 16 bits de 50 ms de silence. */
const SILENT_WAV = (() => {
  const rate = 8000;
  const data = Buffer.alloc((rate / 20) * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
})();

export interface FakeSite {
  /** HTML servi pour toute page du site. */
  readonly html?: string;
  /** Réponses JSON par chemin (`/api/…`), quelle que soit la méthode. */
  readonly api?: Readonly<Record<string, unknown>>;
  /** Fichiers par chemin (`/audio/…`). */
  readonly files?: Readonly<Record<string, { readonly contentType: string; readonly body: Buffer }>>;
  /** Réponse sur mesure : renvoie vrai si la requête a été traitée. */
  readonly handle?: (route: Route, url: URL) => boolean | Promise<boolean>;
}

/**
 * Ouvre une page du site sans jamais le contacter : Playwright sert le HTML et les réponses,
 * le script est injecté avant tout autre code, comme Tampermonkey (`document-start`).
 */
export async function openSite(page: Page, pathname: string, site: FakeSite = {}): Promise<void> {
  await page.route(`${SITE}/**`, async (route: Route) => {
    const url = new URL(route.request().url());
    if (site.handle && (await site.handle(route, url))) return;
    if (site.api && url.pathname in site.api) return route.fulfill({ json: site.api[url.pathname] });
    const file = site.files?.[url.pathname];
    if (file) return route.fulfill({ contentType: file.contentType, body: file.body });
    // Sons du site (`/audio/<nom>.mp3`) : un son court et silencieux, que le navigateur sait décoder.
    if (url.pathname.startsWith('/audio/')) return route.fulfill({ contentType: 'audio/wav', body: SILENT_WAV });
    if (route.request().resourceType() === 'document') {
      return route.fulfill({ contentType: 'text/html; charset=utf-8', body: site.html ?? sitePage() });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  await injectScript(page);
  await page.goto(SITE + pathname);
}

export async function injectScript(page: Page): Promise<void> {
  await page.addInitScript({ path: DEV_BUNDLE });
}

interface PresetSettings {
  readonly features: Readonly<Record<string, boolean>>;
  readonly values: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

let presets = 0;

/**
 * Réglages enregistrés avant le premier chargement de la page (clé `wm-settings-v1`), pas aux suivants
 * (ce que l'utilisateur change reste). Plusieurs appels s'additionnent, le dernier l'emporte.
 */
export async function presetSettings(page: Page, settings: PresetSettings): Promise<void> {
  await page.addInitScript(
    ([value, key]) => {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
      const preset = JSON.parse(value) as PresetSettings;
      const stored = JSON.parse(localStorage.getItem('wm-settings-v1') ?? '{}') as Partial<PresetSettings>;
      const merged = {
        features: { ...stored.features, ...preset.features },
        values: { ...stored.values, ...preset.values },
      };
      localStorage.setItem('wm-settings-v1', JSON.stringify(merged));
    },
    [JSON.stringify(settings), `wm-test-preset-${++presets}`] as const,
  );
}

/** Journaux `[WM …]` de la console de la page. */
export function collectLogs(page: Page): { type: string; text: string }[] {
  const logs: { type: string; text: string }[] = [];
  page.on('console', (message) => {
    if (message.text().startsWith('[WM')) logs.push({ type: message.type(), text: message.text() });
  });
  return logs;
}

/**
 * Au repos, le script ne resynchronise plus la page : le nombre de passes de synchronisation du DOM
 * (`wm.debug.domSyncs()`, version de dev) ne bouge plus pendant `quiet` ms, après `settle` ms laissées à ce
 * qui était en cours (rendus, délais de quelques centaines de millisecondes).
 */
export async function expectDomIdle(page: Page, { settle = 300, quiet = 600 } = {}): Promise<void> {
  const syncs = () => page.evaluate(() => window.wm?.debug?.domSyncs() ?? -1);
  await letTimePass(page, settle);
  const before = await syncs();
  expect(before, 'wm.debug.domSyncs() introuvable : version de dev du script absente ?').toBeGreaterThanOrEqual(0);
  await letTimePass(page, quiet);
  expect(await syncs(), 'au repos, le script resynchronise encore la page').toBe(before);
}

/**
 * Laisse passer `ms` sans rien attendre de précis : pour vérifier ensuite qu'il ne s'est **rien** passé
 * pendant ce temps (aucune requête, rien d'affiché ni de retiré). Toute autre attente porte sur une condition.
 */
export function letTimePass(page: Page, ms: number): Promise<void> {
  return page.waitForTimeout(ms);
}

/**
 * Attend l'image suivante : la passe du script qui suit un changement de la page (`watchDom`, une par image) est
 * faite, son rappel ayant été demandé avant celui-ci. Le Chromium des tests tourne à 60 images/s : sans cette attente,
 * une action lancée aussitôt après un changement de la page (ouverture d'une modale du site…) le précède.
 * Inutile quand on attend déjà un état posé par le script.
 */
export function nextFrame(page: Page): Promise<void> {
  return page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

/** Rectangle d'un élément affiché ; lève s'il manque (une comparaison de positions passerait sur deux absents). */
export async function rect(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`élément absent ou caché : ${String(locator)}`);
  return box;
}

/** Ouvre la fenêtre de paramètres (engrenage affiché), sur l'onglet `tab` s'il est donné ; rend la fenêtre. */
export async function openSettings(page: Page, tab?: string): Promise<Locator> {
  await page.locator('button[aria-label="Paramètres WikiMasters"]:visible').click();
  const dialog = page.getByRole('dialog', { name: 'Paramètres' });
  if (tab) await dialog.getByRole('button', { name: tab }).click();
  return dialog;
}

/** Choisit une option d'une liste déroulante du site (ou de la nôtre, même rôle) par son nom. */
export async function chooseOption(page: Page, list: string, option: string): Promise<void> {
  await page.getByRole('button', { name: list }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

/** Porte d'un serveur imité : ses réponses attendent `gate` tant qu'il n'est pas résolu. */
export interface Gated {
  gate: Promise<void> | undefined;
}

/** Retient les réponses d'un serveur imité (`server.gate`) ; la fonction rendue les libère. */
export function hold(server: Gated): () => void {
  let release = () => {};
  server.gate = new Promise((resolve) => (release = resolve));
  return release;
}

/**
 * Fin des animations de l'élément (apparition du site…) : les positions mesurées ensuite sont les définitives,
 * et un clic n'attend plus qu'il cesse de bouger.
 */
export async function animationsDone(locator: Locator): Promise<void> {
  await locator.evaluate((node) => Promise.all(node.getAnimations().map((animation) => animation.finished)));
}
