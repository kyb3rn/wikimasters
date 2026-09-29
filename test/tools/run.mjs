// Exécute un outil TypeScript de test/tools/ avec les alias du projet (`@/…`) :
//   node test/tools/run.mjs test/tools/<outil>.ts [arguments]
// L'outil est assemblé par esbuild dans un fichier temporaire, puis exécuté par Node.

import * as esbuild from 'esbuild';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [entry, ...args] = process.argv.slice(2);
if (!entry) {
  console.error('usage : node test/tools/run.mjs <outil.ts> [arguments]');
  process.exit(1);
}

// Dans le projet, pas dans le dossier temporaire du système : les paquets (preact…) restent externes et
// Node ne les trouve qu'en remontant vers node_modules.
const outfile = path.resolve(import.meta.dirname, '../../node_modules/.cache/wm-tools', `outil-${process.pid}.mjs`);
await esbuild.build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  define: { __DEV__: 'true', __VERSION__: '"outil"' },
  logLevel: 'warning',
});

process.argv = [process.argv[0], entry, ...args];
try {
  await import(pathToFileURL(outfile).href);
} finally {
  await rm(outfile, { force: true });
}
