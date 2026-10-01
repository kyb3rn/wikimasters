import { defineConfig } from '@playwright/test';

// Tests dans Edge (installé sur la machine, rien à télécharger), sans fenêtre.
// Le site n'est jamais contacté : chaque test sert ses pages et ses réponses (voir test/e2e/support).
// `npm run test:e2e` construit la version de dev avant de lancer les tests ; `WM_DEV_BUNDLE` la met dans un autre
// fichier, pour plusieurs séries en parallèle (voir build.mjs).
export default defineConfig({
  testDir: 'test/e2e',
  reporter: 'list',
  // Par défaut, un Edge par demi-cœur : la machine saturait (Edge dessine sans carte graphique).
  workers: 4,
  use: {
    channel: 'msedge',
    headless: true,
    locale: 'fr-FR',
  },
});
