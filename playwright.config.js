import { defineConfig } from '@playwright/test';

// Tests dans le Chromium headless de Playwright (`npx playwright install --only-shell chromium`, une fois par machine).
// Pas `channel: 'msedge'` : le headless d'Edge crée et détruit des fenêtres Windows cachées, et explorer.exe perd des
// icônes à chacune ; vers 10 000 objets GDI il se relance tout seul (plusieurs fois par jour avec `npm run check`).
// Le site n'est jamais contacté : chaque test sert ses pages et ses réponses (voir test/e2e/support).
// `npm run test:e2e` construit la version de dev avant de lancer les tests ; `WM_DEV_BUNDLE` la met dans un autre
// fichier, pour plusieurs séries en parallèle (voir build.mjs).
export default defineConfig({
  testDir: 'test/e2e',
  reporter: 'list',
  // Par défaut, un navigateur par demi-cœur : la machine saturait (le navigateur dessine sans carte graphique).
  workers: 4,
  use: {
    headless: true,
    locale: 'fr-FR',
  },
});
