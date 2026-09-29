import path from 'node:path';
import type { Page, Route } from '@playwright/test';

export const SITE = 'https://www.wiki-masters.com';
export const SUPABASE = 'https://x.supabase.co';

/** Version de dev construite par `npm run test:e2e` avant les tests. */
const DEV_BUNDLE = path.resolve(import.meta.dirname, '../../../dist/wikimasters.dev.js');

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

/** Page du site : en-tête avec le solde, puis `main`. */
export function sitePage(main = '<h1>Page de test</h1>', script = ''): string {
  return (
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>WikiMasters (test)</title>` +
    `<style>${LAYOUT_CSS}</style></head><body>${HEADER}<main>${main}</main>` +
    (script ? `<script>${script}</script>` : '') +
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
