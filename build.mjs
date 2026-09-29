// Assemble src/ en un seul userscript.
//
//   node build.mjs                 dist/wikimasters.user.js       version à installer
//   node build.mjs --dev           dist/wikimasters.dev.js        + outils de diagnostic, source map
//                                  dist/wikimasters.loader.user.js  script de chargement à installer une fois
//   node build.mjs --dev --watch   idem, reconstruit à chaque sauvegarde

import * as esbuild from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = new Set(process.argv.slice(2));
const dev = args.has('--dev');
const watch = args.has('--watch');

const root = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

const MATCHES = ['https://wiki-masters.com/*', 'https://www.wiki-masters.com/*'];

/** En-tête Tampermonkey, clés alignées. */
function userscriptHeader(entries) {
  const lines = entries.map(([key, value]) => `// @${key.padEnd(12)} ${value}`.trimEnd());
  return ['// ==UserScript==', ...lines, '// ==/UserScript==', ''].join('\n');
}

function metadata({ name, version, extra = [] }) {
  return [
    ['name', name],
    ['namespace', 'https://wiki-masters.com/'],
    ['version', version],
    ['description', pkg.description],
    ['author', pkg.author],
    ...MATCHES.map((m) => ['match', m]),
    // Tout le script démarre avant le site : l'interception réseau doit être en place
    // avant ses premières requêtes. Les fonctionnalités attendent le DOM elles-mêmes.
    ['run-at', 'document-start'],
    ['noframes', ''],
    // Contexte de la page : accès à window.fetch et à l'état React du site.
    ['grant', 'none'],
    ...extra,
  ];
}

const outfile = path.join(root, 'dist', dev ? 'wikimasters.dev.js' : 'wikimasters.user.js');
const loaderFile = path.join(root, 'dist', 'wikimasters.loader.user.js');

/** @type {import('esbuild').BuildOptions} */
const options = {
  absWorkingDir: root,
  entryPoints: ['src/main.ts'],
  outfile,
  bundle: true,
  format: 'iife',
  target: 'es2022',
  charset: 'utf8',
  legalComments: 'none',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  loader: { '.css': 'text' },
  // `__DEV__` remplacé par une constante : esbuild retire les branches mortes (outils de dev)
  // sans minifier, le fichier installé reste lisible.
  define: {
    __DEV__: String(dev),
    __VERSION__: JSON.stringify(pkg.version),
  },
  sourcemap: dev ? 'inline' : false,
  banner: {
    js: dev
      ? `// WikiMasters ${pkg.version} (dev) : généré par build.mjs, chargé par wikimasters.loader.user.js\n`
      : userscriptHeader(metadata({ name: 'WikiMasters', version: pkg.version })),
  },
  logLevel: 'info',
};

async function writeLoader() {
  const header = userscriptHeader(
    metadata({
      name: 'WikiMasters (dev)',
      version: `${pkg.version}-dev`,
      extra: [['require', pathToFileURL(outfile).href]],
    }),
  );
  const body =
    '\n// Script de chargement de la version de dev : Tampermonkey relit le fichier ci-dessus\n' +
    "// à chaque chargement de page (option « Autoriser l'accès aux URL de fichier » requise).\n" +
    '// Ne pas installer en même temps que wikimasters.user.js.\n';
  await mkdir(path.dirname(loaderFile), { recursive: true });
  await writeFile(loaderFile, header + body, 'utf8');
}

if (dev) await writeLoader();

if (watch) {
  const context = await esbuild.context(options);
  await context.watch();
  console.log(`Surveillance de src/ : ${path.relative(root, outfile)} reconstruit à chaque sauvegarde.`);
} else {
  await esbuild.build(options);
}
