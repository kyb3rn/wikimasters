import { defineConfig } from '@playwright/test';

// Tests dans Edge (installé sur la machine, rien à télécharger), sans fenêtre.
// Le site n'est jamais contacté : chaque test sert ses pages et ses réponses (voir test/e2e/support).
// `npm run test:e2e` construit la version de dev avant de lancer les tests.
export default defineConfig({
  testDir: 'test/e2e',
  reporter: 'list',
  use: {
    channel: 'msedge',
    headless: true,
    locale: 'fr-FR',
  },
});
