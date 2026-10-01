// Vérifie que chaque classe de `siteClass` (src/ui/site.ts) existe chez le site : Tailwind ne génère que les classes
// que le site utilise lui-même. Sources, dans test/fixtures/captures/ (ignoré par git) : le balisage des captures, et
// la feuille de style du site (`site-*.css`) pour les classes d'un état jamais capturé (menu ouvert, carte bloquée…).
//   npm run site:classes                   vérifie
//   npm run site:classes -- --fetch-css    télécharge d'abord la feuille de style de la dernière capture
//                                          (fichiers publics, sans session), puis vérifie

import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { siteClass } from '@/ui/site';

const dir = path.resolve('test/fixtures/captures');
const fetchCss = process.argv.includes('--fetch-css');

interface Capture {
  readonly capturedAt?: string;
  readonly page?: { readonly url?: string };
  readonly html?: string;
}

/** Captures de pages (les autres fichiers JSON du dossier, comme les sondes, n'ont pas de balisage). */
async function readCaptures(): Promise<Capture[]> {
  const names = await readdir(dir).catch(() => [] as string[]);
  const captures: Capture[] = [];
  for (const name of names.filter((n) => n.endsWith('.json'))) {
    const capture = JSON.parse(await readFile(path.join(dir, name), 'utf8')) as Capture;
    if (typeof capture.html === 'string') captures.push(capture);
  }
  return captures;
}

function classesOfHtml(html: string): string[] {
  return [...html.matchAll(/class="([^"]*)"/g)].flatMap((match) =>
    (match[1] ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => token.replaceAll('&amp;', '&')),
  );
}

/** Classes des sélecteurs d'une feuille de style, échappements CSS retirés (`.ring-black\/25` → `ring-black/25`). */
function classesOfCss(css: string): string[] {
  // Sélecteurs : ce qui précède chaque `{` (règles imbriquées comprises), sans les déclarations.
  const selectors = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{};]*)\{/g)].map((m) => m[1]).join(',');
  return [...selectors.matchAll(/\.((?:\\[0-9a-fA-F]{1,6} ?|\\.|[\w-])+)/g)].map((match) =>
    (match[1] ?? '')
      .replace(/\\([0-9a-fA-F]{1,6}) ?/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/\\(.)/g, '$1'),
  );
}

/**
 * Feuilles de style de la capture la plus récente, enregistrées sous `site-<nom>.css` ; celles d'une version
 * précédente du site sont retirées (elles feraient passer une classe qu'il n'utilise plus).
 */
async function downloadStylesheets(captures: readonly Capture[]): Promise<void> {
  const latest = [...captures].sort((a, b) => (b.capturedAt ?? '').localeCompare(a.capturedAt ?? ''))[0];
  if (!latest?.html || !latest.page?.url) {
    console.error('Aucune capture : pas de feuille de style à télécharger.');
    return;
  }
  const hrefs = [...latest.html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1] ?? '');
  const sheets = new Map<string, string>();
  for (const href of hrefs.filter(Boolean)) {
    const url = new URL(href.replaceAll('&amp;', '&'), latest.page.url);
    const response = await fetch(url, { credentials: 'omit' });
    if (!response.ok) {
      console.error(`${url.pathname} : erreur ${response.status}, feuilles de style inchangées.`);
      return;
    }
    sheets.set(`site-${path.basename(url.pathname)}`, await response.text());
  }
  for (const name of await readdir(dir)) {
    if (name.startsWith('site-') && name.endsWith('.css') && !sheets.has(name)) await rm(path.join(dir, name));
  }
  for (const [name, css] of sheets) {
    await writeFile(path.join(dir, name), css, 'utf8');
    console.log(`→ test/fixtures/captures/${name}`);
  }
}

const captures = await readCaptures();
if (fetchCss) await downloadStylesheets(captures);

const fromHtml = new Set(captures.flatMap((capture) => classesOfHtml(capture.html ?? '')));
const fromCss = new Set<string>();
const names = await readdir(dir).catch(() => [] as string[]);
const cssFiles = names.filter((name) => name.startsWith('site-') && name.endsWith('.css'));
for (const name of cssFiles) {
  for (const token of classesOfCss(await readFile(path.join(dir, name), 'utf8'))) fromCss.add(token);
}

if (fromHtml.size === 0 && fromCss.size === 0) {
  console.log('Aucune capture : rien à vérifier (test/fixtures/captures/ est vide sur un clone du dépôt).');
  process.exit(0);
}

let missing = 0;
let cssOnly = 0;
for (const [key, value] of Object.entries(siteClass)) {
  const tokens = value.split(/\s+/).filter(Boolean);
  const absent = tokens.filter((token) => !fromHtml.has(token) && !fromCss.has(token));
  cssOnly += tokens.filter((token) => !fromHtml.has(token) && fromCss.has(token)).length;
  if (absent.length === 0) continue;
  missing += absent.length;
  console.error(`siteClass.${key} : absentes du site → ${absent.join(' ')}`);
}

const sources =
  `${captures.length} capture(s), ${fromHtml.size} classes dans leur balisage` +
  (cssFiles.length > 0 ? `, ${fromCss.size} dans la feuille de style (${cssFiles.length} fichier(s))` : '');
if (missing === 0) {
  const note = cssOnly > 0 ? ` ; ${cssOnly} vue(s) seulement dans la feuille de style` : '';
  console.log(`Toutes les classes existent (${sources}${note}).`);
} else {
  console.log(`${missing} classe(s) absente(s) (${sources}).`);
  if (cssFiles.length === 0) {
    console.log(
      "Une classe d'un état jamais capturé (menu ouvert…) n'est que dans la feuille de style du site : " +
        '`npm run site:classes -- --fetch-css` la télécharge.',
    );
  }
}
process.exitCode = missing === 0 ? 0 : 1;
