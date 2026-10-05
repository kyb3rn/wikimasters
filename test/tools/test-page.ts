// Tests d'une page seulement, pendant les corrections : types, tests unitaires (tous : quelques secondes), version de
// dev, puis les tests navigateur des groupes demandés. `npm run check` reste le passage complet avant un commit ou une
// version : chaque test navigateur charge le script entier, une modification d'une page peut en casser une autre.
//   npm run test:page                              groupes et leurs specs
//   npm run test:page -- collection guild-chat     groupes ou specs (nom sans .spec.ts), autant qu'on veut
//   npm run test:page -- dms -- -g "roue"          ce qui suit `--`, ou commence par `-`, va à Playwright

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const E2E = 'test/e2e';

/**
 * Groupes par page (noms de docs/site/), plus la modale de carte, commune à plusieurs pages. Une spec va au premier
 * groupe qui la prend (`x-` : préfixe, sinon nom exact) ; les autres, au socle.
 */
const GROUPS: readonly (readonly [string, readonly string[]])[] = [
  ['pulls', ['pulls-']],
  ['collection', ['collection-', 'tag-manager', 'resale']],
  ['global-collection', ['global-collection-']],
  ['card-modal', ['card-modal', 'card-modal-', 'auction-modal', 'auction-history', 'auction-stay', 'auction-wished-price', 'market']],
  ['marketplace', ['marketplace-', 'auction-', 'market-', 'sales-limit']],
  ['profile', ['profile-']],
  ['friends', ['friends-', 'player-search']],
  ['trades', ['trades', 'trades-', 'trade-']],
  ['dms', ['dms', 'dms-']],
  ['guild', ['guild-']],
];
const SOCLE = 'socle';

const matches = (spec: string, rule: string) => (rule.endsWith('-') ? spec.startsWith(rule) : spec === rule);
const groupOf = (spec: string) => GROUPS.find(([, rules]) => rules.some((rule) => matches(spec, rule)))?.[0] ?? SOCLE;

const specs = readdirSync(E2E)
  .filter((file) => file.endsWith('.spec.ts'))
  .map((file) => file.slice(0, -'.spec.ts'.length));
const groups = new Map<string, string[]>([...GROUPS.map(([name]) => name), SOCLE].map((name) => [name, []]));
for (const spec of specs) groups.get(groupOf(spec))?.push(spec);

const separator = process.argv.indexOf('--', 2);
const own = process.argv.slice(2, separator < 0 ? undefined : separator);
const playwrightArgs = [...own.filter((arg) => arg.startsWith('-')), ...(separator < 0 ? [] : process.argv.slice(separator + 1))];
const targets = own.filter((arg) => !arg.startsWith('-'));

if (targets.length === 0) {
  for (const [name, members] of groups) console.log(`${name} (${members.length}) : ${members.join(' ')}`);
  process.exit(0);
}

const chosen = new Set<string>();
for (const target of targets) {
  const members = groups.get(target) ?? (specs.includes(target) ? [target] : undefined);
  if (!members) {
    console.error(`« ${target} » : ni un groupe ni une spec. Groupes : ${[...groups.keys()].join(', ')}.`);
    process.exit(1);
  }
  for (const spec of members) chosen.add(spec);
}

/** Lance un outil du projet par Node, sans shell : les arguments passent tels quels (espaces, guillemets). */
function step(title: string, script: string, args: readonly string[]): void {
  console.log(`\n▶ ${title}`);
  const { status } = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit' });
  if (status !== 0) process.exit(status ?? 1);
}

step('Types', 'node_modules/typescript/bin/tsc', ['--noEmit', '-p', 'tsconfig.json']);
step('Types des tests', 'node_modules/typescript/bin/tsc', ['--noEmit', '-p', 'test/tsconfig.json']);
step('Tests unitaires', 'node_modules/vitest/vitest.mjs', ['run', '--reporter=dot']);
step('Version de dev', 'build.mjs', ['--dev']);
step(
  `Tests navigateur : ${targets.join(', ')} (${chosen.size} specs)`,
  'node_modules/@playwright/test/cli.js',
  ['test', ...[...chosen].map((spec) => `${E2E}/${spec}.spec.ts`), ...playwrightArgs],
);
