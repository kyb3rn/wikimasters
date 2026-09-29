# WikiMasters : userscript pour wiki-masters.com

Refonte des userscripts de `../old` en **un seul userscript Tampermonkey**, écrit en TypeScript strict et assemblé par esbuild. Tout est en français (commentaires, interface, journaux, tests, documentation), sauf les identifiants du code (anglais). L'utilisateur ne lit pas le code : commentaires seulement quand ils apportent quelque chose (pourquoi non évident, comportement du site, piège, ambiguïté), jamais pour paraphraser.

## Méthode de travail

- **Les fonctionnalités sont reprises une par une avec l'utilisateur.** Ne jamais porter une fonctionnalité de `../old` de sa propre initiative : on la redéfinit ensemble, puis on l'intègre.
- Le socle grandit à la demande : n'ajouter à `core/`, `site/`, `ui/` ou `services/` que ce dont la fonctionnalité en cours a besoin.
- Pas d'accès au navigateur de l'utilisateur ni à sa session : quand on ne sait pas comment le site se comporte, **demander des journaux ou une capture** (`wm.debug.capture()`) plutôt que deviner.
- Git : dépôt **public** `https://github.com/kyb3rn/wikimasters` (branche `main`). Pas de commit ni de push sans demande. Rien de personnel dans le dépôt : les captures brutes sont ignorées par git.
- Avant de livrer : `npm run check` doit passer.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Reconstruit `dist/wikimasters.dev.js` à chaque sauvegarde (écrit aussi le script de chargement) |
| `npm run build` | `dist/wikimasters.user.js`, la version à installer (sans les outils de dev) |
| `npm run check` | Types, lint, règles d'architecture, tests unitaires, tests Edge, build : tout |
| `npm run test` / `npm run test:e2e` | Tests unitaires (Vitest) / tests dans Edge (Playwright) |
| `npm run deps` | Règles d'architecture seules |
| `npm run site:classes` | Vérifie que les classes de `ui/site.ts` existent dans le balisage du site (captures) |

Node a été installé après le lancement de certaines sessions : si `node` est introuvable, recharger le PATH (`$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`).

**Installation dans Tampermonkey.** Développement : installer une fois `dist/wikimasters.loader.user.js` (il charge `dist/wikimasters.dev.js` par `@require file:///…`, option « Autoriser l'accès aux URL de fichier » de l'extension requise) ; un F5 sur le site prend la dernière version. Production : installer `dist/wikimasters.user.js`. Jamais les deux ensemble (la seconde copie ne démarre pas et le signale).

## Architecture

```
docs/              site.md (le site), api.md (ses routes et ses données)
src/
  main.ts          démarrage : console wm, réseau, navigation, fonctionnalités
  env.d.ts         __DEV__, __VERSION__ (remplacées au build)
  core/            mécanique générique, ne connaît pas le site
    net/           point de passage unique de fetch et observation des WebSocket
    router/        navigation SPA, motifs de routes
    runtime/       cycle de vie des fonctionnalités, catalogue, wm.features
    settings/      réglages et activation, une seule clé `wm-settings-v1` (exportable)
    dom/           whenBody, injectStyle, setClass, watchDom (un seul MutationObserver)
    async.ts       sleep, nextFrame, waitUntil (condition vérifiée à chaque image), childController
    audio.ts       trackSounds, blockSounds : sons Web Audio de la page reconnus à leur fichier (chargé puis décodé), filtrés tant qu'un signal court (un son coupé est joué sur une durée nulle)
    react.ts       fiberOf, fiberAncestors : lire l'état React du site
    expose.ts      window.wm
    storage.ts     jsonStore (localStorage)
    log.ts         createLogger → [WM <scope>]
  site/            connaissance du site
    api/           appels des routes du site (siteRequest, SiteApiError, discardUserCard)
    cards/         actions sur les exemplaires (favori, étiquettes, défausse, mise aux enchères), modale de carte, modale d'enchère
    collection/    page Collection : requêtes de sa liste et de ses compteurs, exemplaires listés, faces de la grille
    pulls/         paquet ouvert (cartes, exemplaires), carrousel de /pulls (parties, cartes lues dans son état React), cadre des paquets disponibles
    realtime/      décodage des diffusions binaires de Supabase Realtime
    sound.ts       réglage du son du site (`localStorage`, lu une fois par chargement), noms de ses sons (`SITE_SOUNDS`)
    header.ts      bouton du solde (barre mobile, boîte ordinateur)
    router.ts      routeur Next.js (trouvé dans l'état React) : gardes sur router.push, navigateTo
  ui/              interface Preact générique, aux couleurs du site (variables CSS de son thème)
    mount.ts       mountUi : conteneur .wm-root, `inline` pour glisser un bouton dans une rangée du site
    toast/         toasts : erreurs (8 s) en haut à droite sous le solde, notifications (6 s) en bas à droite, sticky, lien d'action
    lock.ts        lockControl : griser un contrôle du site (plusieurs propriétaires possibles), curseur « interdit »
    stamp.ts       stampFace : tampon sur une carte (« Défaussée » gris, « En vente » vert), clic pour la revoir en modale
    site.ts        classes Tailwind du site recopiées de son balisage (croix de fermeture…)
    modal/  controls/  icons.tsx  theme.ts
  services/        logique partagée entre fonctionnalités
    listings/      exemplaires mis aux enchères (suivis dans les requêtes)
    quick-discard/ défaussage rapide : protections communes (réglages `quick-discard`) et leur règle
    pulls-pack/    paquet ouvert sur /pulls (cartes, exemplaire choisi par carte, défausses faites et en cours, suivis dans les requêtes, gardé jusqu'au paquet suivant) et verrou du carrousel : une action à la fois sur la carte affichée (défausse, enchère rapide), clics bloqués sauf les nôtres (`clickThrough`) ; nos boutons de la rangée du carrousel resserrés (8 px entre eux et avec la flèche « suivante »)
    pulls-sound/   réglage du son des paquets (partagé : paramètres, cadre des paquets)
    pulls-grid/    grille « toutes les cartes d'un coup » de /pulls : cases, zone d'actions sous chaque carte (boutons d'autres fonctionnalités), `onPullsGridChange` (la grille échappe à watchDom)
  features/        une fonctionnalité par dossier ; index.ts les liste
    settings/      engrenage à gauche du solde + fenêtre de paramètres (obligatoire, cachée)
    quick-discard/ section commune « Défaussage rapide » des paramètres (protections), obligatoire
    pulls-grid/    toutes les cartes du paquet d'un coup (lignes de 5 au plus, arrivée en vague, sans son) : le carrousel du site, invisible, sert de moteur (le script le fait défiler et recopie chaque face) ; clic = modale du site, étoile relayée, « Continuer » à nous
    pulls-sound/   son des paquets (obligatoire, réglage dans Paquets) : le son du site reste actif, le script coupe lui-même, tout de suite ; un « off » du site au chargement devient le réglage. Carrousel : sons du site (paquet déchiré, chaque carte tournée, légendaire) ; grille : seul le paquet déchiré (coupure posée par pulls-grid)
    pulls-bar/     cadre en largeur sous « Ouvrir » (obligatoire, caché) : paquets disponibles, recharge (« Plein »), bouton du son, choix carrousel / grille (= activation de pulls-grid) ; lit le cadre du site, caché
    pulls-discard/ défaussage rapide sur /pulls (bouton du carrousel, ou sous chaque carte de la grille sans passer à la suivante ; modale du site verrouillée pour une carte défaussée)
    card-modal-stats/ masque ATK / DEF de la colonne de droite de la modale de carte (déjà sur la face)
    card-modal-stay/ après une défausse, garde la modale que le site retire (inerte, « Défaussée », fermeture gérée ici)
    card-modal-discard/ défaussage rapide dans la modale de carte : confirmation du site cachée et acceptée ; carte protégée : bouton « Confirmer ? » à recliquer (inactif 750 ms, puis actif 3,5 s)
    pulls-auction/ enchère rapide sur /pulls (bouton vert juste à gauche de la corbeille, dans le carrousel ou sous chaque carte de la grille) : fait ouvrir la modale de carte du site, cachée (clic sur la carte du carrousel, ou sur sa copie dans la grille), clique son « Mettre aux enchères » ; à la fermeture de la mise en vente, referme la modale de carte
    pulls-keyboard/  flèches gauche / droite du clavier dans le carrousel de /pulls (sans effet en grille)
    pulls-remaining/ « Encore n cartes » en texte gris, bouton seulement pour « Continuer » (obligatoire, cachée)
    pulls-center/  contenu de /pulls centré verticalement, 40 % de l'espace libre au-dessus, 60 % en dessous (obligatoire, cachée)
    auction-stay/  après une mise aux enchères : pas de redirection, bouton grisé, notification avec lien ; tampon « En vente » (modale, carte du carrousel ou de la grille)
    card-modal/    présentation de la modale de carte (obligatoire) : signalement sur l'image, Vendre · Marché · Défausser ; roue et bouton désactivé pendant toute défausse partie de la modale (défaussage rapide ou confirmation du site)
    disabled-cursor/ curseur « interdit » sur tout contrôle désactivé, du site ou du script (obligatoire, cachée)
    collection-stay/ /collection : après une défausse ou une mise aux enchères, le rechargement de la liste et des compteurs reçoit la réponse déjà affichée (aucune requête) ; la carte reste, tamponnée « Défaussée » / « En vente », modale verrouillée (obligatoire, cachée)
    auction-modal/ modale de mise en vente (obligatoire, design de l'ancien wm-vente sans l'historique) : celle du site reste cachée et sert de moteur ; durée par défaut réglable (10 min)
    debug/         captures et diagnostic (dev seulement)
test/
  unit/            Vitest, arborescence miroir de src/
  e2e/             Playwright dans Edge ; support/site.ts sert un faux site
  fixtures/captures/  captures de pages (Alt+Maj+C), ignorées par git
  tools/           outils Node en TypeScript (`node test/tools/run.mjs <outil>.ts`), ex. sanitize-captures
```

**Règles de dépendance**, vérifiées par dependency-cruiser (`.dependency-cruiser.cjs`), le build de contrôle échoue sinon :
- une couche n'importe que des couches plus basses : `core` ← `site` ← `ui` ← `services` ← `features` (`ui` ne dépend que de `core`) ;
- une fonctionnalité n'importe **jamais** une autre : ce qui sert à deux fonctionnalités remonte dans `services/` (ou plus bas) ;
- seuls `main.ts` et `features/index.ts` importent depuis `features/` ;
- un module-dossier (`src/<couche>/<module>/`) ne s'importe de l'extérieur que par son `index.ts` : c'est sa façade publique, l'intérieur peut changer sans casser le reste ;
- pas de module Node ni de dépendance de dev dans `src/` ; pas de cycle.

**Une fonctionnalité** (`core/runtime/types.ts`) : `id` stable en kebab-case, `name`, `description`, `category` (catégorie de la fenêtre de paramètres), `routes` (motifs `matchRoute` comme `/marketplace/:id`, ou `'all'`), `settings?` (réglages), `required?` (toujours active, sans interrupteur), `hidden?` (absente des paramètres), `mount(ctx)`. Le runtime la monte quand la page correspond et la démonte ailleurs ; un changement de paramètres la remonte. Tout ce qu'elle pose est lié à `ctx.signal` (écouteurs, observateurs réseau, minuteries) ou à `ctx.onDispose`. Au chargement, `mount` est appelé dès `document-start` : le DOM n'existe pas encore (`await whenBody()`). Une erreur de démarrage est isolée (journalisée, fonctionnalité démontée, nouvel essai à la page suivante). `ctx.catalog` liste les fonctionnalités et leur état (fenêtre de paramètres).

**Textes de la fenêtre de paramètres** (demande de l'utilisateur) : phrases simples qui disent ce que fait l'outil, jamais où se trouve le bouton ; on suppose que l'utilisateur sait de quoi il s'agit. Onglet = catégorie (« Paquets ») ; à droite, une section par fonctionnalité titrée de son nom (« Défaussage rapide »), puis l'interrupteur `toggleLabel` (« Afficher le bouton »). Un concept garde son nom partout (« défaussage rapide » existera ailleurs que sur /pulls). Deux fonctionnalités du même concept dans une catégorie portent le même `name` : une seule section, leurs cadres l'un sous l'autre (« Mise aux enchères » : la modale, puis rester sur la carte). Concept utilisé à plusieurs endroits : sa catégorie ne contient que ses réglages communs (protections) ; chaque usage va dans la catégorie de son endroit (« Paquets », « Modale de carte »), en section titrée du nom du concept. Fenêtre de 912 × 620 px, colonne des catégories de 220 px. Pas de notion « par défaut » affichée pour l'instant. Onglet « À propos » en dernier (concept + version).

**Réglages** (`core/settings`) : `defineSettings('<id>', { clé: { type: 'boolean' | 'number' | 'choice', label, description?, primary?, default, min/max/step/unit (nombre), options (choix : `{ value, label }[]`, affichés en pastilles) } })` dans la fonctionnalité, passé en `settings` de la `Feature` : la fenêtre de paramètres les affiche d'elle-même (`primary` : avec l'interrupteur principal, au-dessus du trait ; nombre : champ − / valeur / + comme la mise du site). `settings.get(clé)` relit à chaque appel (valeur validée, bornée, sinon défaut). Tout est dans `wm-settings-v1` : `{ features: { id: activée }, values: { id: { clé: valeur } } }`, synchronisé entre onglets ; une fonctionnalité (dés)activée est montée ou démontée tout de suite. Import / export : pas encore (demandé plus tard).

**Interface** : Preact, toujours dans un conteneur `.wm-root` à nous (`mountUi`), jamais dans un nœud géré par React. Pour glisser un bouton dans une rangée du site : `mountUi(…, { parent, before, inline: true })` (conteneur `display: contents`) et copier les classes du bouton voisin du site ; aucun style de base ne s'applique aux conteneurs `inline` (sinon il écraserait l'allure du site). Nos couleurs : variables CSS du thème du site (`ui/theme.ts`, `tokens`). **Pas de style maison quand le site a déjà le contrôle** (demande de l'utilisateur : le moins de code répété possible) : boutons, champs, croix… reprennent les classes Tailwind du site, relevées dans son balisage et rangées dans `ui/site.ts` (`siteClass`) ; une classe inventée n'existe pas dans sa feuille de style (`npm run site:classes` après tout ajout). Le faux site des tests n'a pas Tailwind : ces contrôles y sont sans style, les tests vérifient les rôles et les classes, pas l'aspect. Poser les boutons avec `watchDom` (idempotent : reposer ce que React a retiré). Erreurs pour l'utilisateur : `toast.error(message, { title })` ; notifications : `toast.success` / `toast.info` (en bas à droite).

Piège : une navigation Next.js charge la nouvelle page (requête RSC) **avant** `pushState`. Une fonctionnalité qui doit voir cette requête ne peut pas être limitée à la page d'arrivée : `routes: 'all'` et filtrage dans l'observateur.

Ajouter une fonctionnalité : `src/features/<id>/index.ts` exporte l'objet `Feature`, l'ajouter à la liste de `src/features/index.ts`, tests dans `test/unit/features/<id>/` et `test/e2e/`.

**Réseau** (`core/net`) : `window.fetch` est remplacé une fois ; chaque requête passe par (1) les intercepteurs, dans l'ordre d'inscription, le premier qui renvoie une `Response` court-circuite le réseau, (2) le `fetch` d'origine, (3) les observateurs, appelés dans une tâche ultérieure avec une copie du corps lue une seule fois. Les observateurs ne voient que les réponses reçues : pour suivre une requête jusqu'au bout, échec réseau compris (roue « en cours »), `net.track` (appelé au départ, puis à la fin avec le statut ou `undefined`, avant que l'appelant ne reçoive la réponse). Erreurs d'intercepteur, d'observateur ou de suivi journalisées, jamais propagées au site. Nos requêtes passent par `net.fetch` (marquées `own`). Les intercepteurs voient la requête sans son corps s'il n'est pas textuel.

`window.WebSocket` est aussi remplacé (sous-classe, `core/net/socket.ts`) : `net.observeSocket` voit ouvertures, messages reçus (`in`) et envoyés (`out`), fermetures, en lecture seule et dans l'ordre (`seq`). Le site y reçoit son temps réel (Supabase Realtime, canaux privés `auction:<id>`, `notifications:<uid>`, `profile:<uid>`) : une surenchère ou un changement de solde n'apparaît **pas** dans `fetch`.

**Console** : `window.wm` (`version`, `dev`, `features`, `debug` en dev). Un module ajoute ses commandes avec `expose(clé, valeur, signal)` et les déclare en augmentant `WmApi` (propriété optionnelle).

## Conventions

- TypeScript strict (`noUncheckedIndexedAccess` compris). Valider tout ce qui vient de l'extérieur (réponses du site, stockage) avant de le typer : `isRecord`, fonctions `parse`.
- Journaux par `ctx.log` / `createLogger` (préfixe `[WM <id>]`) ; `console` directe interdite hors `core/log.ts`.
- Réglages de l'utilisateur : `defineSettings` (jamais une clé localStorage à part, pour que l'export les contienne tous). Autres données persistées : `jsonStore('wm-<module>-v<n>', repli, parse)` ; changer `n` quand la forme change.
- Actions sur le compte (défausse, mise…) : `site/api` (`siteRequest`), une seule tentative, erreur montrée en toast avec le message du site.
- DOM du site (React) : ne jamais déplacer ni supprimer un nœud géré par React. Ajouter des enfants, des classes, masquer en CSS (`wm-hidden`), ou poser un bouton à nous qui déclenche l'original caché (« Signaler l'image »). Renommer un bouton : changer son nœud texte (React ne le réécrit que si son texte change). Reconnaître un bouton du site à son icône lucide plutôt qu'à son texte (on peut l'avoir renommé).
- **Dans un rappel de `watchDom`, n'écrire dans le DOM que si ça change** : `setClass(el, nom, oui)`, comparer avant d'affecter `title`, `disabled`… (`classList.add` réécrit l'attribut même s'il est inchangé : boucle de synchronisation à chaque image). Le test « au repos, le script ne resynchronise plus la page » (`card-modal.spec.ts`, `wm.debug.domSyncs()`) le vérifie.
- Griser un contrôle du site : `lockControl(el, { owner: '<id>', locked, reason })` (ui/lock), jamais à la main : plusieurs fonctionnalités peuvent verrouiller le même bouton. De même, marquer une carte passe par `stampFace(face, owner, stamp)` (ui/stamp).
- Code de dev (`__DEV__`) : retiré du build de production par esbuild.

## Tests

- **Unitaires** (Vitest, Node) : logique sans navigateur. Garder la logique séparée du DOM pour qu'elle soit testable ici.
- **Edge** (Playwright, `channel: 'msedge'`) : `openSite(page, chemin, { html, api, handle })` sert la page et les réponses sans contacter le site, et injecte `dist/wikimasters.dev.js` au `document-start`. `sitePage()` fournit l'en-tête du site (bouton du solde) ; `support/collection.ts` imite la page Collection (liste, pagination, modale, rechargement après une défausse ou une enchère) ; `support/pulls.ts` imite le carrousel de `/pulls` (mêmes classes, face recréée à chaque carte, sons Web Audio, étoile, props React, révélation des shiny, clic sur la carte ignoré après un glissement, modale d'enchère chargée à sa première ouverture). `presetSettings` pose des réglages avant le premier chargement (plusieurs appels s'additionnent) ; les tests du carrousel désactivent « toutes les cartes d'un coup » (`CAROUSEL`). Aucune session : ne jamais automatiser le vrai site (actions irréversibles, garde `automation_limit`).
- **Captures** : en dev, **Alt+Maj+C** dans la page (ou `wm.debug.capture()`) télécharge `wm-capture-<page>-<date>.json` et le confirme à l'écran. Format 2 : DOM affiché, échanges réseau et événements WebSocket depuis le chargement ; diffusions Supabase Realtime binaires décodées en JSON (`dataEncoding: 'realtime'`), autres binaires en base64 ; jetons, clés, e-mails et identifiants de paiement masqués, binaire contenant un e-mail ou un jeton omis. Une capture ne voit que l'onglet où elle est lancée (d'où le raccourci). Après toute amélioration du masquage : `npm run captures:sanitize` (réapplique les règles aux captures existantes et vérifie qu'il ne reste ni jeton ni e-mail). L'utilisateur les dépose dans `test/fixtures/captures/`, **ignoré par git** (fichiers lourds, pseudo et collection de l'utilisateur, dépôt public). Un test n'embarque que l'extrait utile, réduit et anonymisé, dans `test/fixtures/<fonctionnalité>/`. Une capture vieillit avec le site : en redemander une avant de travailler sur une page.

## Connaissance du site

**Lire d'abord [`docs/site.md`](docs/site.md)** (pages, raretés et shiny, temps réel, paquets, marché, **règles pour le script**) et **[`docs/api.md`](docs/api.md)** (routes, paramètres, forme des données), relevés le 29/09/2026 sur captures et code du site. Les tenir à jour à chaque découverte. À retenir :
- aucune automatisation d'action (gardes anti-robots, sanctions sur le compte) : une action = un geste de l'utilisateur ;
- site peu fiable, surtout en journée : 403/404/500 fréquents, réponses de 0,3 à 18 s, temps réel coupé par moments. Tout code réseau prévoit l'échec, la lenteur et la coupure ;
- une partie des données n'arrive que par le temps réel (WebSocket), pas par `fetch` ;
- carte (modèle) ≠ exemplaire (possédé) ; raretés par les données, pas par les classes CSS (les shiny n'ont pas `glow-l`) ;
- l'horloge du PC peut être décalée : calculer les temps restants avec l'en-tête `Date` des réponses ;
- le code JavaScript du site se lit (chunks `/_next/static/…`) : y chercher les paramètres réels des routes plutôt que deviner.

Anciens relevés, plus détaillés sur le balisage mais à revérifier : `../old/docs/site.md`, `../old/docs/api.md`, `../old/docs/marche-algorithme.md`.
