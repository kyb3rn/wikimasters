// Assemble src/ en un seul userscript.
//
//   node build.mjs                 dist/wikimasters.user.js       version à installer
//   node build.mjs --dev           dist/wikimasters.dev.js        + outils de diagnostic, source map
//                                  dist/wikimasters.loader.user.js  script de chargement à installer une fois
//   node build.mjs --dev --watch   idem, reconstruit à chaque sauvegarde, et sert dist/ sur http://127.0.0.1:47100
//                                  pour dist/wikimasters.loader.firefox.user.js (Firefox, Violentmonkey)
//
// `WM_DEV_BUNDLE=<fichier> node build.mjs --dev` : version de dev écrite dans ce fichier, script de chargement
// inchangé (plusieurs séries de tests navigateur en parallèle, chacune avec son fichier ; lu par test/e2e/support/site.ts).
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
 * version à installer tant que leurs modules n'ont pas d'effet au chargement ; de même pour les services qu'elles seules
 * utilisent (prix souhaité de la Revente). Un octet de l'un d'eux dans le fichier
 * fait échouer le build.
 */
const DEV_ONLY = /^src\/(features\/(debug|showcase|market-search|resale|resale-card-display|auction-wished-price)|services\/wished-price)\//;

const MATCHES = ['https://wiki-masters.com/*', 'https://www.wiki-masters.com/*'];
const ORIGINS = MATCHES.map((m) => m.replace(/\/\*$/, ''));

// Firefox n'ouvre pas les fichiers du disque aux extensions (pas de `@require file:///`) : sous `--watch`, la version
// de dev y est servie en local, 127.0.0.1 seulement, et seul le site peut la lire.
const DEV_HOST = '127.0.0.1';
const DEV_PORT = 47100;

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
const firefoxLoaderFile = path.join(root, 'dist', 'wikimasters.loader.firefox.user.js');

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
      ? `// WikiMasters ${pkg.version} (dev) : généré par build.mjs, chargé par wikimasters.loader(.firefox).user.js\n`
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

async function writeLoaders() {
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

  const bundleUrl = `http://${DEV_HOST}:${DEV_PORT}/${path.basename(outfile)}`;
  const firefoxHeader = userscriptHeader(
    metadata({
      name: 'WikiMasters (dev)',
      version: `${pkg.version}-dev`,
      // Violentmonkey : la requête et l'évaluation doivent se faire dans la page, même si son réglage par défaut change.
      extra: [['inject-into', 'page']],
    }),
  );
  // Requête synchrone : le script doit être en place avant la première requête du site. Paramètre `t` : jamais une
  // version gardée en cache par le navigateur.
  const firefoxBody = `
// Script de chargement de la version de dev pour Firefox (Violentmonkey) : relit à chaque chargement de page
// la version servie par \`npm run dev\`, qui doit donc tourner.
// Ne pas installer en même temps que wikimasters.user.js.
(() => {
  const url = ${JSON.stringify(bundleUrl)};
  const request = new XMLHttpRequest();
  try {
    request.open('GET', \`\${url}?t=\${Date.now()}\`, false);
    request.overrideMimeType('text/javascript; charset=utf-8');
    request.send();
  } catch {}
  if (request.status !== 200) {
    console.error(\`[WM] version de dev introuvable sur \${url} : npm run dev est-il lancé ?\`);
    return;
  }
  (0, eval)(\`\${request.responseText}\\n//# sourceURL=\${url}\`);
})();
`;
  await mkdir(path.dirname(loaderFile), { recursive: true });
  await writeFile(loaderFile, header + body, 'utf8');
  await writeFile(firefoxLoaderFile, firefoxHeader + firefoxBody, 'utf8');
}

if (dev && !customDevBundle) await writeLoaders();

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
  if (!customDevBundle) {
    // Une requête arrivée pendant une reconstruction attend sa fin : un F5 prend toujours la dernière version.
    // Port déjà pris (autre `npm run dev`) : la surveillance continue sans servir.
    try {
      await context.serve({ host: DEV_HOST, port: DEV_PORT, servedir: path.dirname(outfile), cors: { origin: ORIGINS } });
      console.log(`Version de dev servie sur http://${DEV_HOST}:${DEV_PORT}/ (Firefox : ${path.basename(firefoxLoaderFile)}).`);
    } catch (error) {
      console.warn(`Version de dev non servie (Firefox) sur le port ${DEV_PORT} : ${error.message}`);
    }
  }
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
