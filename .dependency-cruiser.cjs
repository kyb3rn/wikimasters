// Règles d'architecture, vérifiées par `npm run deps` (et `npm run check`).
// Couches, de la plus basse à la plus haute :
//   core      mécanique générique (réseau, navigation, cycle de vie, stockage) : ne connaît pas le site
//   site      connaissance du site : routes de l'API, forme des données, session, DOM du site
//   ui        composants d'interface génériques (Preact)
//   services  logique partagée entre fonctionnalités (cache du marché…)
//   features  une fonctionnalité par dossier
// Une couche n'importe que des couches plus basses. Un module-dossier ne s'importe que par son index.

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'pas-de-cycle',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'core-autonome',
      comment: 'core ne dépend que de core.',
      severity: 'error',
      from: { path: '^src/core/' },
      to: { path: '^src/(site|ui|services|features)/' },
    },
    {
      name: 'site-sous-ui',
      comment: 'site ne dépend que de core.',
      severity: 'error',
      from: { path: '^src/site/' },
      to: { path: '^src/(ui|services|features)/' },
    },
    {
      name: 'ui-generique',
      comment: "ui ne dépend que de core : un composant qui connaît le site va dans services/ ou dans sa fonctionnalité.",
      severity: 'error',
      from: { path: '^src/ui/' },
      to: { path: '^src/(site|services|features)/' },
    },
    {
      name: 'services-sous-features',
      severity: 'error',
      from: { path: '^src/services/' },
      to: { path: '^src/features/' },
    },
    {
      name: 'features-isolees',
      comment: "Une fonctionnalité n'importe jamais une autre : ce qui est partagé remonte dans services/.",
      severity: 'error',
      from: { path: '^src/features/([^/]+)/' },
      to: { path: '^src/features/', pathNot: '^src/features/$1/' },
    },
    {
      name: 'features-par-la-liste',
      comment: 'Seuls main.ts et features/index.ts chargent les fonctionnalités.',
      severity: 'error',
      from: { path: '^src/', pathNot: '^src/(main\\.ts|features/)' },
      to: { path: '^src/features/' },
    },
    {
      name: 'facade-dun-module',
      comment: "Depuis l'extérieur, un module-dossier s'importe par son index.ts.",
      severity: 'error',
      from: { path: '^src/([^/]+/[^/]+)/' },
      to: { path: '^src/[^/]+/[^/]+/(?!index\\.tsx?$)', pathNot: '^src/$1/' },
    },
    {
      name: 'facade-dun-module-depuis-un-fichier',
      comment: "Depuis l'extérieur, un module-dossier s'importe par son index.ts.",
      severity: 'error',
      from: { path: '^src/', pathNot: '^src/[^/]+/[^/]+/' },
      to: { path: '^src/[^/]+/[^/]+/(?!index\\.tsx?$)' },
    },
    {
      name: 'pas-de-node',
      comment: 'Le script tourne dans le navigateur : pas de module Node.',
      severity: 'error',
      from: { path: '^src/' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'dependances-declarees',
      comment: "Le code livré n'utilise que des dépendances de production déclarées dans package.json.",
      severity: 'error',
      from: { path: '^src/' },
      to: { dependencyTypes: ['npm-dev', 'npm-no-pkg', 'npm-unknown', 'unknown', 'undetermined'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js'],
    },
  },
};
