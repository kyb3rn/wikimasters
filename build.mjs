// Assemble src/ en un seul userscript.
//
//   node build.mjs                 dist/wikimasters.user.js       version à installer
//   node build.mjs --dev           dist/wikimasters.dev.js        + outils de diagnostic, source map
//                                  dist/wikimasters.loader.user.js  script de chargement à installer une fois
//   node build.mjs --dev --watch   idem, reconstruit à chaque sauvegarde
//
// `WM_DEV_BUNDLE=<fichier> node build.mjs --dev` : version de dev écrite dans ce fichier, script de chargement
// inchangé (plusieurs séries de tests Edge en parallèle, chacune avec son fichier ; lu par test/e2e/support/site.ts).
// Version à installer : rien n'est écrit s'il y reste un octet d'un outil de dev (voir DEV_ONLY).

import * as esbuild from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = new Set(process.argv.slice(2));
const dev = args.has('--dev');
const watch = args.has('--watch');

const root = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

/**
 * Fonctionnalités de développement : listées sous `__DEV__` seulement (features/index.ts), esbuild les retire de la
 * version à installer tant que leurs modules n'ont pas d'effet au chargement. Un octet de l'un d'eux dans le fichier
 * fait échouer le build.
 */
const DEV_ONLY = /^src\/features\/(debug|showcase|market-search)\//;

const MATCHES = ['https://wiki-masters.com/*', 'https://www.wiki-masters.com/*'];

const REPOSITORY = 'https://github.com/kyb3rn/wikimasters';
// Fichier joint à la dernière release GitHub (.github/workflows/release.yml) : Tampermonkey y
// relit `@version` et installe le script quand elle est plus grande que la sienne.
const RELEASE_URL = `${REPOSITORY}/releases/latest/download/wikimasters.user.js`;

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

// `WM_DEV_BUNDLE` : voir l'en-tête ; le script de chargement installé dans Tampermonkey garde le fichier habituel.
const customDevBundle = dev ? process.env.WM_DEV_BUNDLE : undefined;
const outfile = customDevBundle
  ? path.resolve(root, customDevBundle)
  : path.join(root, 'dist', dev ? 'wikimasters.dev.js' : 'wikimasters.user.js');
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
      : userscriptHeader(
          metadata({
            name: 'WikiMasters',
            version: pkg.version,
            extra: [
              ['homepageURL', REPOSITORY],
              ['updateURL', RELEASE_URL],
              ['downloadURL', RELEASE_URL],
            ],
          }),
        ),
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

if (dev && !customDevBundle) await writeLoader();

/** Fichiers de `DEV_ONLY` présents dans la sortie, avec leur nombre d'octets. */
function devCodeIn(metafile) {
  return Object.values(metafile.outputs).flatMap((output) =>
    Object.entries(output.inputs)
      .filter(([input, { bytesInOutput }]) => bytesInOutput > 0 && DEV_ONLY.test(input))
      .map(([input, { bytesInOutput }]) => `${input} (${bytesInOutput} octets)`),
  );
}

if (watch) {
  const context = await esbuild.context(options);
  await context.watch();
  console.log(`Surveillance de src/ : ${path.relative(root, outfile)} reconstruit à chaque sauvegarde.`);
} else if (dev) {
  await esbuild.build(options);
} else {
  // Rien n'est écrit avant la vérification : un fichier fautif n'arrive jamais dans dist/ (le résumé d'esbuild,
  // qui l'annoncerait, est remplacé par le nôtre).
  const result = await esbuild.build({ ...options, write: false, metafile: true, logLevel: 'warning' });
  const leaks = devCodeIn(result.metafile);
  if (leaks.length > 0) {
    console.error(
      'Code de développement dans la version à installer (un effet au chargement de ces modules les garde) :\n' +
        leaks.map((leak) => `  ${leak}`).join('\n'),
    );
    process.exit(1);
  }
  for (const file of result.outputFiles) {
    await mkdir(path.dirname(file.path), { recursive: true });
    await writeFile(file.path, file.contents);
    console.log(`${path.relative(root, file.path)}  ${(file.contents.length / 1024).toFixed(1)} Ko`);
  }
}
