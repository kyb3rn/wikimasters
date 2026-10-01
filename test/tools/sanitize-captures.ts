// Réapplique les règles de masquage actuelles aux captures existantes, puis vérifie qu'aucun
// jeton ni adresse e-mail ne reste, y compris dans les binaires.
//   npm run captures:sanitize [-- <dossier>]

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { containsSecret, sanitizeCapture, type StoredCapture } from '@/features/debug';

/** Tout le texte d'une capture, binaires compris (décodés en latin1). */
function allText(capture: StoredCapture): string {
  const binaries = [
    ...capture.exchanges.filter((e) => e.bodyEncoding === 'base64').map((e) => e.body),
    ...(capture.sockets ?? []).filter((e) => e.dataEncoding === 'base64').map((e) => e.data ?? ''),
  ].map((b64) => Buffer.from(b64, 'base64').toString('latin1'));
  return JSON.stringify(capture) + binaries.join('\n');
}

const dir = process.argv[2] ?? 'test/fixtures/captures';
const files = (await readdir(dir)).filter((f) => f.startsWith('wm-capture-') && f.endsWith('.json'));
let changed = 0;
const leaks: string[] = [];

for (const file of files) {
  const full = path.join(dir, file);
  const before = await readFile(full, 'utf8');
  const capture = sanitizeCapture(JSON.parse(before) as StoredCapture);
  const after = JSON.stringify(capture, null, 2);
  if (after !== before) {
    await writeFile(full, after, 'utf8');
    changed++;
  }
  const text = allText(capture);
  if (containsSecret(text)) leaks.push(file);
}

console.log(`${files.length} captures relues, ${changed} réécrites.`);
if (leaks.length) {
  console.error(`Données sensibles encore présentes dans : ${leaks.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Aucun jeton ni adresse e-mail restant.');
}
