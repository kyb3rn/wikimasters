# Tests

Deux séries : **unitaires** (Vitest, dans Node : la logique) et **Edge** (Playwright : le script injecté dans un faux site). `npm run check` lance les deux, avec types, lint, architecture et build. Règles essentielles : [`CLAUDE.md`](../CLAUDE.md#tests).

**Jamais le vrai site** : aucune session, actions irréversibles, garde `automation_limit` du site. Tout ce qu'un test charge est servi par Playwright ou imité.

## Tests unitaires (`test/unit/`)

- `vitest.config.js` : `test/unit/**/*.test.ts`, environnement `node`, alias `@` → `src`, `__DEV__` vrai, `__VERSION__` = `"test"`.
- Arborescence miroir de `src/` : `test/unit/<couche>/<module>/…` (ou `<module>.test.ts`) teste `src/<couche>/<module>`. Un fichier de test porte le nom de ce qu'il teste.
- Garder la logique séparée du DOM pour la tester ici (fonctions `parse`, modèles, calculs, suivis de requêtes). Ce qui demande un vrai navigateur va dans les tests Edge.
- Outils communs, `test/unit/support.ts` : `memoryLogger` (journal qui retient erreurs et avertissements), `netRequest` (une `NetRequest`), `flush` (laisse passer les tâches en attente), `stateComponent` / `statelessFiber` (fibers et hooks d'état React imités), `fakeStorage`, `realtimeFrame` (diffusion binaire de Supabase Realtime), `recordedExchange` (échange d'une capture), `friendship` (amitié de `GET /api/friends`), `sale`, `SALES_NOW`, `DAY` (historiques de ventes), `connectFakeSite` (un `fetch` qui répond comme le site).
- `test/unit/core/fake-dom.ts` : DOM minimal pour `core/dom` (éléments, attributs, classes, nœuds texte, `document`), qui compte les écritures (`writes`) : un appel sans changement ne doit rien écrire.

## Tests Edge (`test/e2e/`)

`playwright.config.js` : Edge installé sur la machine (`channel: 'msedge'`), sans fenêtre, `locale: 'fr-FR'`, 4 processus (la machine saturait au-delà : Edge dessine sans carte graphique). `npm run test:e2e` construit d'abord la version de dev.

Lancer une partie seulement, ou plusieurs séries en parallèle sans écraser le fichier des autres :

```
WM_DEV_BUNDLE=dist/<nom>.dev.js node build.mjs --dev
WM_DEV_BUNDLE=dist/<nom>.dev.js npx playwright test <specs> --workers=2 --output=test-results/<nom>
```

(PowerShell : `$env:WM_DEV_BUNDLE='dist/<nom>.dev.js'`.) Une spec par fonctionnalité ou par page (`<fonctionnalité>.spec.ts`), plus `socle.spec.ts` (démarrage et console, double installation, passage des requêtes, sons, temps réel, captures et masquage) et `shared-api.spec.ts` (modules du socle testés directement).

### Le faux site : `support/site.ts`

- `openSite(page, chemin, { html, api, files, handle })` : route tout `https://www.wiki-masters.com/**` (`SITE`) ; `handle(route, url)` d'abord (vrai = traitée), puis `api` (JSON par chemin, toute méthode), `files`, sons `/audio/…` (un WAV silencieux), le HTML pour un document, 404 sinon. Injecte la version de dev (`WM_DEV_BUNDLE` ou `dist/wikimasters.dev.js`) avant tout code de la page, comme Tampermonkey au `document-start` (`injectScript`).
- `sitePage(main, script)` : en-tête du site (bouton du solde en barre mobile et en boîte ordinateur, classes relevées), un peu de CSS à la place de Tailwind pour la mise en page, `<main>`, puis le script de la page avec `window.kit`.
- `presetSettings(page, { features, values })` : réglages posés dans `wm-settings-v1` avant le premier chargement seulement (ce que le test change ensuite reste) ; plusieurs appels s'additionnent.
- `expectDomIdle(page, { settle, quiet })` : **test de repos**. Exige d'abord `wm.debug.domSyncs()` (version de dev), puis vérifie que le nombre de passes de synchronisation ne bouge plus pendant `quiet` ms. Toute fonctionnalité qui écrit dans le DOM en a un.
- `letTimePass(page, ms)` : la seule attente fixe, pour vérifier qu'il ne se passe **rien** pendant ce temps (aucune requête, rien d'affiché ni de retiré). Toute autre attente porte sur une condition (`expect(…).toBe…`, `waitForFunction`, `waitForRequest`).
- `rect(locator)` : rectangle d'un élément affiché ; lève s'il manque (une comparaison de positions passerait sur deux absents).
- `openSettings(page, onglet?)`, `chooseOption(page, liste, option)` (liste déroulante du site ou la nôtre), `hold(server)` / `Gated` (réponses d'un serveur imité retenues jusqu'à libération : états « en cours »), `animationsDone(locator)` (les filtres des faux sites apparaissent avec une animation : l'attendre avant de mesurer ou d'enchaîner des clics chronométrés), `collectLogs(page)` (journaux `[WM …]`).
- `SUPABASE` (`https://x.supabase.co`), `FAKE_JWT` (session imitée, utilisateur `u0`), `VERSION`.

### La boîte à outils des pages : `support/kit.ts`

`window.kit`, posé par `sitePage` avant le script de la page (écrit en TypeScript, sérialisé dans la page : rien de l'extérieur) : `el`, `button`, `icon` (lucide, classe `lucide-<nom>`), `tailwindBase`, `fiber` (fiber React noté sur un nœud), `hooks` (états d'un composant, chaînés comme chez React), `nextRouter` (routeur Next.js imité), `listbox` (liste déroulante du site : props `ariaLabel`, `value`, `options`, `onChange`, menu en portail), `rarityPills` (pastilles de rareté).

### Faux sites des pages (`test/e2e/support/`)

Chacun imite une page d'après le code et les captures du site (dates en tête de fichier), avec ses états React, ses requêtes et ses réponses. Commun aux listes (`lists.ts`) : `listServer` (serveur d'une liste imitée : requêtes notées, réponses retenues par `hold`), `filtersTitle` (titre de la carte servie, qui dit la requête : tri, raretés, étiquette, liste de souhaits, recherche, page ; un test lit ce que la page affiche pour savoir ce qui a été demandé), `gridTitles`, `rarityBox` (une case de nos filtres de rareté).

| Fichier | Page imitée | Entrée |
|---|---|---|
| `collection.ts` | Collection : recherche, listes, pastilles, liste et compteurs, voile, pagination, « tirer pour rafraîchir » (fibers périmés compris), modale de carte (défausse, mise aux enchères), « Gérer les étiquettes » | `openCollection`, `COLLECTION_HTML`, `entry`, `faces`, `titles` |
| `collection-selection.ts` | mode sélection de la Collection : barre du bas, modale d'étiquetage, défausse groupée, étiquettes lues à Supabase | `openSelectionPage`, `FAKE_TAGS` |
| `global-collection.ts` | Toutes les cartes, modale de carte en vue catalogue | `CATALOG_HTML`, `CATALOG_CARD` |
| `global-collection-list.ts` | liste de Toutes les cartes : filtres, effet de chargement, pages gardées en `sessionStorage`, états dans les hooks | `openGlobalCollection` |
| `marketplace.ts` | onglet « Parcourir » : `<select>` du tri, « Charger la suite », `onRefresh`, retour d'une annonce | `openMarketplace` |
| `profile-collection.ts` | profil d'un ami, onglets Vitrine et Collection (recréé à chaque ouverture, toute réponse affichée) | `openFriendCollection` |
| `pulls.ts` | carrousel de /pulls (face recréée à chaque carte, sons Web Audio, étoile, props React, révélation des shiny, clic ignoré après un glissement, modale d'enchère chargée à sa première ouverture), cadre des paquets, pack PRO du jour | `openPulls`, `openCard`, `packFaces`, `PULLS_HTML`, `PACK`, `PRO_PACK`, `CAROUSEL`, `recordSounds`, `playedSounds` |
| `friends.ts` | page Amis : amitiés, demandes, recherche de joueurs | `openFriendsPage`, `FRIENDSHIPS`, `PLAYERS` |
| `friend-picker.ts` | /trades et « Choisir un ami » | `openFriendPickerPage` |
| `trades.ts` | fenêtre « Échanger avec » : onglets, filtres, wikibidous, zone des cartes | `openTradeComposer` |

Les tests du carrousel désactivent « toutes les cartes d'un coup » (`presetSettings(page, CAROUSEL)`).

### Modules du socle dans la page : `shared-api.spec.ts`

`loadSharedApi(page, body)` (`support/modules.ts`) assemble `support/shared-api.entry.ts` (une sélection de modules de `src/` : `ui/mount`, `ui/lock`, `ui/modal`, `site/dom`, `site/modals`, `services/header-items`…) et le pose dans `window.wmTest` d'une page vide : pour tester dans un vrai navigateur un outil du socle sans faux site. Un module qui a besoin du DOM réel s'y ajoute.

### Pièges

- Le faux site n'a pas Tailwind : les contrôles qui reprennent ses classes y sont sans style ; vérifier les rôles et les classes, pas l'aspect.
- Un onglet ouvert par Ctrl+clic ou clic du milieu échappe aux routes du test (`page.route` comme `context.route`) et irait au vrai site : annuler le clic dans la page, après notre code.
- La page se rend comme React : un nœud recréé à chaque rendu (face du carrousel, onglet de la collection d'un ami) doit l'être aussi dans le faux site, sans quoi un test passe là où le site casserait.

## Captures

- En dev, **Alt+Maj+C** dans la page (ou `wm.debug.capture()`) télécharge `wm-capture-<page>-<date>.json` et le confirme à l'écran (fonctionnalité `debug`, interrupteur « Enregistrer pour les captures »). Une capture ne voit que l'onglet où elle est lancée.
- Format 2 (`format: 'wm-capture'`) : DOM affiché, échanges réseau et événements WebSocket depuis le chargement ; diffusions Supabase Realtime binaires décodées en JSON (`dataEncoding: 'realtime'`), autres binaires en base64.
- Masquage (`features/debug/redact.ts`) : jetons, clés, e-mails, identifiants de paiement, en-têtes sensibles par leur nom, paramètres d'adresse (`apikey`) ; un binaire contenant un e-mail ou un jeton est omis. Après toute amélioration : `npm run captures:sanitize` (réapplique les règles aux captures existantes, idempotent, et vérifie qu'il ne reste ni jeton ni e-mail).
- L'utilisateur les dépose dans `test/fixtures/captures/`, **ignoré par git** (fichiers lourds, pseudo et collection de l'utilisateur, dépôt public). Un test n'embarque que l'extrait utile, réduit et anonymisé : balisage recopié dans le faux site (`support/`) ou la spec, données inventées de même forme dans les tests unitaires.
- `npm run site:classes` vérifie chaque classe de `siteClass` dans le balisage des captures et dans la feuille de style du site (`site-*.css` du même dossier, pour un état jamais capturé : menu ouvert, carte bloquée) ; `-- --fetch-css` télécharge d'abord la feuille de la dernière capture. Sans capture, rien à vérifier.
- Une capture vieillit avec le site : en redemander une avant de travailler sur une page.

Outils Node en TypeScript : `node test/tools/run.mjs test/tools/<outil>.ts` (assemblé par esbuild avec les alias du projet).
