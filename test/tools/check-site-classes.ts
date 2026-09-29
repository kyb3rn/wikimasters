// Vérifie que chaque classe de `siteClass` (src/ui/site.ts) existe dans le balisage du site, relevé dans
// les captures : Tailwind ne génère que les classes que le site utilise lui-même.
//   npm run site:classes

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { siteClass } from '@/ui/site';

const dir = path.resolve('test/fixtures/captures');
const seen = new Set<string>();
for (const name of await readdir(dir)) {
  if (!name.endsWith('.json')) continue;
  const capture = JSON.parse(await readFile(path.join(dir, name), 'utf8')) as { html?: string };
  for (const match of (capture.html ?? '').matchAll(/class="([^"]*)"/g)) {
    for (const token of (match[1] ?? '').split(/\s+/)) if (token) seen.add(token.replaceAll('&amp;', '&'));
  }
}

let missing = 0;
for (const [key, value] of Object.entries(siteClass)) {
  const absent = value.split(/\s+/).filter((token) => token && !seen.has(token));
  if (absent.length === 0) continue;
  missing += absent.length;
  console.error(`siteClass.${key} : absentes du site → ${absent.join(' ')}`);
}
console.log(missing === 0 ? `Toutes les classes existent (${seen.size} relevées dans les captures).` : `${missing} classe(s) absente(s).`);
process.exitCode = missing === 0 ? 0 : 1;
