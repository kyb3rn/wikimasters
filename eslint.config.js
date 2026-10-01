import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

/**
 * `no-restricted-syntax` à notre façon, pour lui donner un nom par convention : la même règle d'ESLint dans
 * deux blocs, le second remplace les options du premier (les exceptions d'une convention effaceraient les
 * autres). Options : `{ selector, message }`, sélecteurs AST comme `no-restricted-syntax`.
 */
const restrictedSyntax = {
  meta: { type: 'problem', schema: { type: 'array' } },
  create(context) {
    const listeners = {};
    for (const { selector, message } of context.options) {
      const previous = listeners[selector];
      listeners[selector] = (node) => {
        previous?.(node);
        context.report({ node, message });
      };
    }
    return listeners;
  },
};

/** Conventions de CLAUDE.md : interdit dans src/, sauf dans `allowedIn` (le module qui en est le passage obligé). */
const CONVENTIONS = {
  net: {
    allowedIn: ['src/core/net/**'],
    selectors: [
      "CallExpression > Identifier.callee[name='fetch']",
      "MemberExpression[object.name=/^(window|globalThis|self)$/] > Identifier.property[name='fetch']",
      "NewExpression > Identifier.callee[name='XMLHttpRequest']",
    ],
    message:
      'Requête du script : `net.fetch` (core/net), ou `siteRequest` / `supabaseRequest` (site/api), pour que ' +
      'les intercepteurs et les observateurs la voient.',
  },
  storage: {
    allowedIn: ['src/core/storage.ts', 'src/core/settings/**', 'src/site/**'],
    selectors: ['Identifier[name=/^(localStorage|sessionStorage)$/]'],
    message:
      "Réglage de l'utilisateur : `defineSettings` (tous dans `wm-settings-v1`) ; autre donnée : " +
      '`jsonStore` (core/storage). Les clés du site lui-même se lisent dans site/.',
  },
  'indexed-db': {
    allowedIn: ['src/core/idb.ts'],
    selectors: ["Identifier[name='indexedDB']"],
    message: 'Base IndexedDB : `idbStore` (core/idb), avec son repli en mémoire.',
  },
  toast: {
    allowedIn: ['src/ui/toast/**', 'src/services/notifications/**', 'src/features/debug/**', 'src/features/showcase/**'],
    selectors: ["MemberExpression[object.name='toast'][property.name=/^(success|info|show)$/]"],
    message:
      'Notification : `notify` (services/notifications : toast et liste de la cloche) ; erreur : `toast.error`.',
  },
  style: {
    allowedIn: ['src/core/dom/**'],
    selectors: ["CallExpression[callee.property.name='createElement'][arguments.0.value='style']"],
    message: 'Feuille de style : `ctx.style` dans une fonctionnalité, sinon `injectStyle` / `toggleStyle` (core/dom).',
  },
  'root-class': {
    selectors: [
      "MemberExpression[property.name=/^(classList|className)$/] > MemberExpression.object[object.name='document'][property.name=/^(documentElement|body)$/]",
      "CallExpression[callee.name='setClass'][arguments.0.object.name='document'][arguments.0.property.name=/^(documentElement|body)$/]",
    ],
    message:
      "Classe sur <html> ou <body> : React, qui rend ces balises, l'efface. État durable : `toggleStyle` " +
      '(core/dom) ou `ctx.style`.',
  },
};

export default defineConfig(
  { ignores: ['dist/', 'node_modules/', 'test-results/', 'playwright-report/', '.dependency-cruiser.cjs'] },

  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
    },
  },

  // Code du navigateur : la console passe par core/log (préfixe [WM …]).
  {
    files: ['src/**'],
    ignores: ['src/core/log.ts'],
    rules: { 'no-console': 'error' },
  },

  {
    files: ['src/**'],
    plugins: { wm: { rules: Object.fromEntries(Object.keys(CONVENTIONS).map((name) => [name, restrictedSyntax])) } },
  },
  ...Object.entries(CONVENTIONS).map(([name, { allowedIn = [], selectors, message }]) => ({
    files: ['src/**'],
    ignores: allowedIn,
    rules: { [`wm/${name}`]: ['error', ...selectors.map((selector) => ({ selector, message }))] },
  })),

  // Fichiers de configuration et de build, en JavaScript, exécutés par Node.
  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
  },
);
