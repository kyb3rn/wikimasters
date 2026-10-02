# WikiMasters : userscript pour wiki-masters.com

Refonte des userscripts de `../old` en **un seul userscript Tampermonkey**, écrit en TypeScript strict et assemblé par esbuild. Tout est en français (commentaires, interface, journaux, tests, documentation), sauf les identifiants du code (anglais). L'utilisateur ne lit pas le code : commentaires seulement quand ils apportent quelque chose (pourquoi non évident, comportement du site, piège, ambiguïté), jamais pour paraphraser.

## Où lire quoi

| Pour… | Lire |
|---|---|
| le socle en détail, et « quel outil pour… » | [`docs/architecture.md`](docs/architecture.md) |
| ce que fait chaque fonctionnalité, les choix de l'utilisateur | [`docs/features.md`](docs/features.md) |
| le site : règles, cartes et raretés, temps réel, modales, champs, boutons | [`docs/site/README.md`](docs/site/README.md) |
| une page du site | `docs/site/<page>.md` : `pulls`, `collection`, `global-collection`, `marketplace`, `profile`, `friends`, `trades`, `dms`, `guild` |
| routes et données du site | [`docs/api.md`](docs/api.md) |
| tests, faux sites, captures | [`docs/testing.md`](docs/testing.md) |

Avant de toucher à une page : son fichier `docs/site/<page>.md`, sa section de `docs/features.md` (Paquets, Collection, Toutes les cartes, Marché, Profil, Amis, Échanges, Messages, Guilde ; Socle des pages et Modale de carte valent partout) et ses specs (`test/e2e/<fonctionnalité>.spec.ts`). Tenir ces docs à jour à chaque découverte ou changement : le code fait foi.

## Méthode de travail

- **Les fonctionnalités sont reprises une par une avec l'utilisateur.** Ne jamais porter une fonctionnalité de `../old` de sa propre initiative : on la redéfinit ensemble, puis on l'intègre.
- Le socle grandit à la demande : n'ajouter à `core/`, `site/`, `ui/` ou `services/` que ce dont la fonctionnalité en cours a besoin.
- Pas d'accès au navigateur de l'utilisateur ni à sa session : quand on ne sait pas comment le site se comporte, **demander des journaux ou une capture** (Alt+Maj+C, `wm.debug.capture()`) plutôt que deviner.
- Git : dépôt **public** `https://github.com/kyb3rn/wikimasters` (branche `main`). Pas de commit ni de push sans demande. Rien de personnel dans le dépôt : les captures brutes sont ignorées par git.
- Avant de livrer : `npm run check` doit passer.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Reconstruit `dist/wikimasters.dev.js` à chaque sauvegarde (écrit aussi le script de chargement) |
| `npm run build` | `dist/wikimasters.user.js`, la version à installer (refusée s'il y reste un octet des outils de dev) |
| `npm run check` | Types, lint, règles d'architecture, tests unitaires, tests navigateur, build : tout |
| `npm run test` / `npm run test:e2e` | Tests unitaires (Vitest) / tests dans un navigateur (Playwright) |
| `npm run deps` | Règles d'architecture seules |
| `npm run site:classes` | Vérifie que les classes de `ui/site.ts` existent dans le balisage du site (captures) |
| `npm run captures:sanitize` | Réapplique le masquage aux captures existantes |

`WM_DEV_BUNDLE=dist/<nom>.dev.js` (build `--dev` et specs) : version de dev écrite et lue ailleurs, pour plusieurs séries de tests navigateur en parallèle. Si `node` est introuvable (installé après le lancement de la session) : `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`.

**Installation dans Tampermonkey.** Développement : installer une fois `dist/wikimasters.loader.user.js` (il charge `dist/wikimasters.dev.js` par `@require file:///…`, option « Autoriser l'accès aux URL de fichier » requise) ; un F5 sur le site prend la dernière version. Production : `dist/wikimasters.user.js`. Jamais les deux ensemble (la seconde copie ne démarre pas et le signale).

**Publier une version.** Lien partagé : `https://github.com/kyb3rn/wikimasters/releases/latest/download/wikimasters.user.js` (`@updateURL` / `@downloadURL`, `build.mjs`) ; Tampermonkey n'installe une mise à jour que si `@version` augmente. Monter `version` dans `package.json`, `npm run check`, commit, push, puis `git tag v<version>` et `git push origin v<version>` : `.github/workflows/release.yml` vérifie le tag, construit depuis le commit tagué (jamais le disque) et crée la release avec le fichier joint (les tests navigateur ne tournent qu'en local).

## Architecture

`src/main.ts` (démarrage au `document-start`), puis cinq couches : `core/` (mécanique générique, ne connaît pas le site), `site/` (DOM, état React, requêtes et temps réel du site), `ui/` (interface Preact générique aux couleurs du site), `services/` (logique partagée entre fonctionnalités), `features/` (une par dossier, listées dans l'ordre de montage par `features/index.ts`). Détail et index des outils par besoin : [`docs/architecture.md`](docs/architecture.md).

**Règles de dépendance** (dependency-cruiser, `.dependency-cruiser.cjs`) :
- une couche n'importe que des couches plus basses : `core` ← `site` ← `ui` ← `services` ← `features` ; `site` et `ui` ne dépendent que de `core` ;
- une fonctionnalité n'importe **jamais** une autre : ce qui sert à deux fonctionnalités remonte dans `services/` (ou plus bas) ;
- seuls `main.ts` et `features/index.ts` importent depuis `features/` ;
- un module-dossier ne s'importe de l'extérieur que par son `index.ts`, sa façade publique ;
- pas de module Node ni de dépendance de dev dans `src/` ; pas de cycle.

**Une fonctionnalité** (`core/runtime/types.ts`) : `id` stable en kebab-case, `name`, `description`, `toggleLabel?`, `category` (onglet des paramètres), `routes` (constantes de `site/routes.ts`, ou `'all'`), `settings?`, `required?` (toujours active, sans interrupteur), `hidden?` (absente des paramètres), `defaultOff?` (éteinte tant que l'utilisateur ne l'a pas activée), `mount(ctx)`. Montée quand la page correspond, démontée ailleurs ; remontée quand les **paramètres de route** changent (autre annonce, autre profil) ; un changement de réglage ne remonte rien (`settings.get` relit). `mount` part dès `document-start`, avant le DOM : `if (!(await ctx.ready())) return;`. Tout ce qu'elle pose est lié à `ctx.signal` ou `ctx.onDispose` ; `ctx.style(css)` et `ctx.hide(el)` se défont seuls au démontage. Une erreur de démarrage est isolée (journalisée, démontée, nouvel essai à la page suivante). Ajouter une fonctionnalité : `src/features/<id>/index.ts` exporte la `Feature`, l'ajouter à `features/index.ts` (l'ordre compte : mémoire des filtres, puis recherche, puis délai et pagination), tests dans `test/unit/features/<id>/` et `test/e2e/`, section dans `docs/features.md`.

**Réglages** : `defineSettings('<id>', { clé: { type: 'boolean' | 'number' | 'choice', label, … } })` passé en `settings` de la `Feature` : la fenêtre de paramètres les affiche d'elle-même. Tout est dans `wm-settings-v1` (activation et valeurs, synchronisé entre onglets ; import / export demandé plus tard).

**Textes de la fenêtre de paramètres** (demande de l'utilisateur) : phrases simples qui disent ce que fait l'outil, jamais où se trouve le bouton ; on suppose que l'utilisateur sait de quoi il s'agit. Onglet = catégorie (« Paquets ») ; une section par fonctionnalité titrée de son nom (« Défaussage rapide »), puis l'interrupteur `toggleLabel` (« Afficher le bouton »). Un concept garde son nom partout. Deux fonctionnalités du même concept dans une catégorie portent le même `name` : une seule section, leurs cadres l'un sous l'autre. Concept utilisé à plusieurs endroits : sa catégorie ne contient que ses réglages communs (protections) ; chaque usage va dans la catégorie de son endroit, en section titrée du nom du concept. Toute nouvelle catégorie reçoit son icône dans `TAB_ICONS` (`features/settings/tabs.ts`, celle du site quand il en a une). Pas de notion « par défaut » affichée. « À propos » en dernier.

**Interface** : Preact, toujours dans un conteneur `.wm-root` à nous, jamais dans un nœud géré par React. Dans une page que React redessine : `createSlot` / `createSlots` (reposée si React l'a retirée) ; dans une rangée du site : `inline: true` (`display: contents`, aucun style de base). Un conteneur posé dans `<body>` pendant le chargement est retiré par React : monter une fenêtre ou une liste à son ouverture. **Boutons : toujours `buttonClass`** (demande de l'utilisateur : tous standardisés, ceux du site compris, rhabillés par site-buttons ; vitrine `/wm-ui`). **Pas de style maison quand le site a déjà le contrôle** (demande de l'utilisateur : le moins de code répété possible) : champs, pastilles, onglets reprennent ses classes Tailwind, relevées dans son balisage et rangées dans `siteClass` (`ui/site.ts`) ; une classe inventée n'existe pas dans sa feuille (`npm run site:classes` après tout ajout). Couleurs : thème du site (`ui/theme.ts`). Erreurs : `toast.error(message, { title })` ; succès et informations : `notify` (toast et liste de la cloche).

**Réseau** (`core/net`) : `window.fetch` et `window.WebSocket` remplacés une fois. Une requête passe par les intercepteurs (ordre d'inscription, `last` après tous ; le premier qui rend une `Response` court-circuite le réseau), le `fetch` d'origine, puis les observateurs (une tâche plus tard, réponses reçues seulement ; `net.track` pour suivre jusqu'au bout, échec réseau compris). Réponse resservie pendant que la page affiche « chargement » : `replayResponse` / `instantResponse`. Le temps réel (Supabase Realtime) n'arrive que par `net.observeSocket` : une surenchère ou un changement de solde n'apparaît **pas** dans `fetch`. Piège : une navigation Next.js charge la nouvelle page (requête RSC) **avant** `pushState` ; une fonctionnalité qui doit voir cette requête prend `routes: 'all'` et filtre dans l'observateur.

**Console** : `window.wm` (`version`, `dev`, `features`, `market`, `debug` en dev) ; un module y ajoute ses commandes par `expose(clé, valeur, signal)` en augmentant `WmApi`.

## Conventions

Une règle marquée (ESLint) est vérifiée par `eslint.config.js`.
- TypeScript strict (`noUncheckedIndexedAccess` compris). Valider tout ce qui vient de l'extérieur (réponses du site, stockage) avant de le typer : `isRecord`, `parseJson`, fonctions `parse`.
- Journaux par `ctx.log` / `createLogger` (`[WM <id>]`) ; `console` seulement dans `core/log.ts` (ESLint).
- Requêtes : `net.fetch`, `siteRequest`, `supabaseRequest`, jamais `fetch` (ESLint). Comme le site par défaut ; une forme optimisée est seulement proposée à l'utilisateur, puis validée ; aucun contournement. Essais et sondes : colonnes utiles, jamais `count=exact`, `limit` minimal.
- Réglages de l'utilisateur : `defineSettings`, jamais une clé à part (l'export doit les contenir tous). Autres données : `jsonStore('wm-<module>-v<n>', repli, parse)`, `n` changé quand la forme change ; IndexedDB : `idbStore` (ESLint ; les clés du site lui-même se lisent dans `site/`).
- Prédicat d'une requête du site : `is<Objet><Action>`, sans suffixe `Request` (`isFriendshipDelete`, `isProfileVisibilityChange`).
- Actions sur le compte : `site/api`, une seule tentative, erreur en toast avec le message du site (`siteErrorText`) ; refus qu'il afficherait dans un élément caché : `watchSiteRefusal` ; sans réponse : « Le site n'a pas répondu (erreur réseau). » (`NETWORK_ERROR`), texte unique.
- DOM du site (React) : ne jamais déplacer ni supprimer un nœud géré par React. Ajouter des enfants, des classes (`classMarks`), masquer (`ctx.hide`), ou poser un contrôle à nous qui déclenche l'original caché. Renommer un bouton : `renameText`. Reconnaître un bouton du site à son icône lucide (`hasIcon`) plutôt qu'à son texte.
- **Dans un rappel de `watchDom`, n'écrire dans le DOM que si ça change** (`setClass`, comparer avant d'affecter `title`, `disabled`…) : sinon boucle de synchronisation à chaque image. Les tests de repos le vérifient (`expectDomIdle`).
- État durable de la page : `toggleStyle` ou `ctx.style`, jamais une classe sur `<html>` ou `<body>` (React l'efface ; ESLint). Feuille de style : `ctx.style` ou `injectStyle` (ESLint).
- **Bouton d'action qui lance une requête** (demande de l'utilisateur, partout) : roue à la place de son icône ou devant son texte (`Icon busy`) et `disabled` pendant toute la requête, donc curseur « interdit » ; jamais un état « en cours » cliquable ni un curseur d'attente ; opacité 50 % pour tout bouton désactivé. Bouton du site : `lockControl({ busy })`.
- Griser un contrôle du site : `lockControl` (plusieurs propriétaires possibles), jamais à la main. Marquer ou griser une carte : `stampFace` / `syncStamps` (même teinte et même fondu partout, jamais un filtre à part ni de transparence sur la carte).
- Boutons (demande de l'utilisateur) : grand 48 px, moyen = hauteur des champs, petit 30 px, très petit (« tiny ») 20 px ; une taille = une hauteur pour toutes les formes.
- Encarts : fond uni, jamais de dégradé interne ni de bordure latérale colorée (encarts teintés du site) ; icône seule, en haut.
- Listes : jamais de recherche automatique par défaut (Entrée ou le bouton ; après la frappe : option). Taille des cartes réglée par conteneur, pas par page.
- Code de dev (`__DEV__`, `debug`, `showcase`, `market-search`) : rien de non pur au niveau de leurs modules ; le build de production échoue s'il en reste un octet.

## Tests

Détail : [`docs/testing.md`](docs/testing.md).
- **Unitaires** (Vitest, `test/unit/` en miroir de `src/`) : la logique sans navigateur ; la garder séparée du DOM pour la tester ici.
- **Navigateur** (Playwright, Chromium headless ; jamais `channel: 'msedge'`, voir `playwright.config.js`) : `openSite(page, chemin, { html, api, handle })` sert la page et les réponses sans contacter le site et injecte la version de dev au `document-start` ; faux sites des pages dans `test/e2e/support/`, sans Tailwind (on vérifie rôles et classes, pas l'aspect). Toute fonctionnalité qui écrit dans le DOM a un test de repos (`expectDomIdle`). À 60 images/s, une action lancée aussitôt après un changement de la page précède la passe du script : `nextFrame(page)` d'abord (voir `docs/testing.md`).
- **Ne jamais automatiser le vrai site** (actions irréversibles, garde `automation_limit`). Un onglet ouvert par Ctrl+clic échappe aux routes du test et irait au vrai site : annuler le clic dans la page après notre code.
- **Captures** (Alt+Maj+C en dev) : déposées dans `test/fixtures/captures/`, **ignoré par git** (pseudo, collection, dépôt public) ; un test n'embarque que l'extrait utile, réduit et anonymisé. Une capture vieillit avec le site : en redemander une avant de travailler sur une page.

## Connaissance du site

Règles d'or (détail : [`docs/site/README.md`](docs/site/README.md)) :
- aucune automatisation d'action (gardes anti-robots, sanctions sur le compte) : **une action = un geste de l'utilisateur** ;
- site peu fiable, surtout en journée : 403/404/500 fréquents, réponses de 0,3 à 18 s, temps réel coupé par moments. Tout code réseau prévoit l'échec, la lenteur et la coupure ;
- une partie des données n'arrive que par le temps réel (WebSocket), pas par `fetch` ;
- carte (modèle) ≠ exemplaire (possédé) ; raretés par les données, pas par les classes CSS (les shiny n'ont pas `glow-l`) ;
- l'horloge du PC peut être décalée : temps restants calculés à l'heure du serveur (`serverNow`) ;
- le code JavaScript du site se lit (chunks `/_next/static/…`) : y chercher les paramètres réels des routes plutôt que deviner.

Anciens relevés, plus détaillés sur le balisage mais à revérifier : `../old/docs/site.md`, `../old/docs/api.md`, `../old/docs/marche-algorithme.md`.
