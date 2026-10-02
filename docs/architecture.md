# Architecture du script

Le socle en détail : ce que fait chaque module de `src/core`, `src/site`, `src/ui` et `src/services`, et ses outils. Les **règles** (couches, contrat d'une fonctionnalité, conventions) sont dans [`CLAUDE.md`](../CLAUDE.md) ; les fonctionnalités dans [`features.md`](features.md) ; le comportement du site dans [`site/README.md`](site/README.md) et [`api.md`](api.md).

Un module-dossier ne s'importe que par son `index.ts` : les noms ci-dessous sont ceux de sa façade, sauf mention « interne ».

## Trouver un outil

| Besoin | Outil |
|---|---|
| Attendre `<body>` dans une fonctionnalité | `if (!(await ctx.ready())) return;` ; ailleurs `whenBody()` / `whenBody(signal)` |
| Feuille de style d'une fonctionnalité | `ctx.style(css, name?)` (retirée au démontage) ; partagée : `injectStyle` / `writeStyle` ; état durable de la page : `toggleStyle` |
| Masquer un nœud du site | `ctx.hide(element, hidden?)` ; hors fonctionnalité : `setHidden(element, owner, hidden)` |
| Classe sur des nœuds du site | `classMarks(signal)` (`set`, `only`), sinon `setClass` |
| Suivre les changements de la page | `watchDom(callback, { signal })` (rappel idempotent) |
| Interface Preact gardée à sa place | `createSlot(signal)` / `createSlots(signal)` ; posée une fois : `mountUi` |
| Bouton devant le solde (en-tête) | `placeHeaderItem(rank, render, { signal, shown? })` |
| Bouton au bout d'une rangée d'onglets | `placeTabLineButton(ctx, options)` |
| Fenêtre à nous à la place d'une fenêtre du site (moteur caché) | `mirrorSiteDialog(ctx, { find, render, onClose? })` |
| Bloc qui tient lieu de page, centré | `flexMainWhile(ctx, className, shows)` |
| Bouton à nous | `buttonClass(forme, { tone, fill, size, pill })` ; roue : `<Icon name busy />` |
| Habiller un bouton du site | `applyButtonClass` |
| Griser ou occuper un contrôle du site | `lockControl(control, { owner, locked, reason, busy })` |
| Tampon sur une carte, ou la griser | `stampFace`, `syncStamps` (`STAMPS.greyed` : grisée sans texte) ; modale d'un exemplaire défaussé ou en vente : `markModalCard` |
| Confirmer en deux clics | `confirmStep` ; accepter la confirmation du site : `autoConfirm` |
| Modale à nous | `Modal` (`padded`, `locked`, `titleBefore`, `actions`), `openConfirm` ; comportement seul : `useModalBehavior` |
| Erreur pour l'utilisateur | `toast.error(message, { title })` ; texte : `siteErrorText(error)` |
| Notification (succès, info) | `notify(…)` (jamais `toast.success` / `toast.info`) |
| Refus d'une requête du site, à montrer | `watchSiteRefusal(match, onRefused, { signal })` |
| Action sur le compte | `siteRequest` ; Supabase : `supabaseRequest` |
| Lire, retenir, resservir une requête du site | `net.observe`, `net.intercept`, `net.track` ; `cacheResponse` / `replayResponse`, `instantResponse` |
| Temps réel | `net.observeSocket`, `decodeBroadcast` ; canal à nous : `openRealtimeChannel` ; client du site (état, relance) : `findSiteRealtime` |
| État React du site | `findPropsAbove`, `currentFiberAncestors`, `stateHooks`, `callbackHooks`, `refHooks`, `fiberOf` |
| Module ou composant du site (même chargé à la demande) | `pageModules()` (Turbopack) ; rendu hors de son arbre : `findPageReact`, `renderPageComponent` sous `providedContexts(currentFiberAncestors(nœud))` ; fenêtre d'échange : `openTradeComposer` |
| Écrire dans un contrôle React | `setReactInputValue` ; `<select>` : `chooseSelectValue` ; liste à lui : `findListbox` |
| Renommer un bouton du site | `renameText(element, de, vers)` |
| Reconnaître un nœud | `hasIcon`, `siteButtons`, `isOwn` (`site/dom.ts`) ; modales : `SITE_OVERLAY`, `findSiteModals` |
| Clic simple (sans ouvrir d'onglet) | `isPlainClick(event)` |
| Naviguer comme le site | `navigateTo(href)` ; refuser une navigation : `guardRouterPush` |
| Heure du serveur, décompte | `serverNow()`, `onServerSecond(listener, { signal })` ; à la fraction de seconde (limite par minute) : `preciseServerNow()` |
| Minuterie liée au démontage | `later(action, ms, signal)` ; `sleep`, `nextFrame`, `waitUntil`, `childController` |
| Liste d'abonnés | `createListeners(log?, label?)` |
| Texte affiché | `textOf(node)`, `normalizeText(text)` |
| Valider des données | `isRecord`, `isSet`, `parseJson` |
| Persister | réglage : `defineSettings` ; donnée : `jsonStore` ; gros volume : `idbStore` |
| Route d'une fonctionnalité | constantes de `site/routes.ts` |
| Commande de console | `expose(clé, valeur, signal)` + augmentation de `WmApi` |

## Démarrage (`src/main.ts`)

Au `document-start`, avant tout code du site (en principe : Tampermonkey l'injecte parfois en retard, voir [site/README.md](site/README.md#règles-pour-le-script)) : refus de démarrer si une autre copie tourne (`window.wm` déjà là), `initConsole`, `net.install(window)`, puis les suivis qui vivent toute la session : `trackSounds` (avant que la page ne charge ses sons), `trackSupabaseSession`, `trackServerClock`, `trackProStatus`, `trackMe`, `trackGuildMembership`. Ensuite le routeur, la position des toasts (`configureToasts` : sous le solde), le runtime (`createRuntime`) mis à jour à chaque changement de chemin, `syncSettingsAcrossTabs`, `onSettingsChange` → `runtime.refresh()`, `exposeFeatures`.

`src/env.d.ts` : `__DEV__` et `__VERSION__`, remplacées au build ; tout ce qui est sous `if (__DEV__)` disparaît du fichier de production.

## core : mécanique générique

Ne connaît pas le site.

### `core/runtime`
- `createRuntime({ features, isEnabled, saveEnabled, createLogger })` : `update(path)` monte et démonte selon les `routes` ; `refresh()` réapplique les choix d'activation. Clé de montage = motif reconnu + ses paramètres : même clé, pas de remontage ; autres paramètres (autre annonce, autre profil) → démontage puis remontage. Un **changement de réglage ne remonte rien** : `settings.get` relit, `onSettingsChange` pour réagir.
- Échec de `mount` (exception ou promesse rejetée) : journalisé, fonctionnalité démontée, état `failed`, nouvel essai à la page suivante seulement.
- `FeatureContext` (`types.ts`) : `log`, `signal`, `catalog`, `onDispose`, `ready()`, `style(css, name?)` (`<style id="wm-style-<id>[-<name>]">`, posé dès `<body>` si `<head>` manque, même nom = contenu remplacé), `hide(element, hidden?)` (rendu au démontage par `unhideAll`).
- `FeatureCatalog` : `list()`, `setEnabled`, `onChange` (fenêtre de paramètres). États : `off`, `idle`, `mounted`, `failed`.
- `exposeFeatures` : `wm.features` (`list()` en tableau, `enable(id)`, `disable(id)`).

### `core/settings`
- `defineSettings('<id>', schéma)` → `Settings` (`schema`, `get`, `set`). Types : `boolean`, `number` (`min`, `max`, `step`, `unit` ; champ − / valeur / +), `choice` (`options: { value: number, label }[]`, pastilles ou `display: 'slider'`). `primary` : avec l'interrupteur, au-dessus du trait. `enabledBy: '<clé>'` : grisé quand ce réglage booléen du même module est éteint (sa valeur reste ; l'usage tient compte des deux). `get` relit à chaque appel : valeur validée, bornée, sinon défaut.
- Stockage unique `wm-settings-v1` (`SETTINGS_KEY`) : `{ features: { id: activée }, values: { id: { clé: valeur } } }`, pensé pour un export / import futur (pas encore fait). `featureChoice` / `setFeatureChoice` (sans choix : active, sauf `defaultOff`), `onSettingsChange`, `syncSettingsAcrossTabs` (événement `storage`).

### `core/net`
`net` est l'unique point de passage du réseau de la page (`window.fetch` et `window.WebSocket` remplacés par `install`).
- Ordre : (1) intercepteurs dans l'ordre d'inscription, ceux inscrits avec `last` après tous les autres ; le premier qui rend une `Response` court-circuite le réseau ; (2) `fetch` d'origine ; (3) observateurs, une tâche plus tard (le code du site passe d'abord), avec un corps lu une fois et partagé (`text()`, `json()`, `arrayBuffer()`).
- `NetRequest` : `url`, `method` (majuscules), `headers`, `body` (texte seulement), `own` (requête du script par `net.fetch`). `NetExchange` ajoute `status`, `ok`, `synthetic` (servie par un intercepteur), `startedAt`, `duration`.
- `net.track(match, tracker)` : départ, puis fin avec le statut ou `undefined` (échec réseau), avant que l'appelant ne reçoive la réponse : pour une roue « en cours » ou un refus sans réponse.
- `net.observeSocket(match, observer)` : `open`, `message` (`in` / `out`), `close`, en lecture seule, dans l'ordre (`seq` croissant, avec des trous possibles).
- `instantResponse(body, init)` : réponse lue en microtâches (React regroupe « chargement » et « fini », la roue du site n'apparaît pas). `cacheResponse(exchange | response)` → `CachedResponse { body, contentType }`, `replayResponse(cached)` : resservie en 200 par un intercepteur.
- Toute erreur d'intercepteur, d'observateur ou de suivi est journalisée, jamais propagée au site.

### `core/router`
`createRouter(window, log)` : enveloppe `pushState` / `replaceState`, écoute `popstate` ; seul le chemin compte (`?…` et `#…` ignorés). `matchRoute(motif, chemin)` : segments fixes, `:nom`, `*` final.

### `core/dom`
- `whenBody()` : une promesse et un observateur partagés ; avec un signal, `undefined` dès l'interruption.
- `watchDom(callback, { signal })` : un seul `MutationObserver` (`childList`, `subtree`, attributs `class`, `disabled`, `aria-label`), un appel par image au plus ; ignore nos `.wm-root` (`ROOT_CLASS`) sauf un contenu marqué `SITE_LIKE_CLASS` (fait au balisage du site, pour que les fonctionnalités qui habillent ce balisage le voient). Chaque inscription rejoue tous les rappels à l'image suivante. À inscrire après `whenBody`. `domSyncRounds()` compte les passes (test de repos).
- `setClass` (n'écrit que si ça change), `classMarks(signal)` : `set` retient l'élément, `only(nom, cibles)` met la classe exactement sur ces éléments ; tout est retiré à l'interruption, éléments sortis de la page oubliés.
- `setHidden(element, owner, hidden)` / `unhideAll(owner)` : attribut `data-wm-hidden="owner1 owner2"` (pas une classe : React réécrit `class`), hors de l'`attributeFilter` de `watchDom`.
- Styles : `injectStyle(id, css)` (une fois), `writeStyle` (remplace si différent), `removeStyle`, `toggleStyle(id, css, on)` : pour un état durable de la page, une classe sur `<html>` ou `<body>` est effacée par React.
- `renameText(element, de, vers)` : change le nœud texte direct égal à `de` ; `isPlainClick(event)` ; `prefersReducedMotion()`.
- `guardBackdropClicks(isBackdrop, { signal })` : un fond de modale ne reçoit que les clics appuyés et relâchés sur lui (un glisser depuis le cadre arrive à leur ancêtre commun, le fond).
- Classes : `ROOT_CLASS` (`wm-root`), `SITE_LIKE_CLASS`, `GHOST_CLASS` (copie d'une modale qui s'efface, ignorée des recherches), `EMBEDDED_CLASS` (modale du site intégrée à la page par une fonctionnalité : plus une modale).

### Petits modules de `core`
- `async.ts` : `sleep`, `later`, `nextFrame`, `waitUntil(test, { signal, timeoutMs })` (vérifié à chaque image), `childController(parent)`.
- `listeners.ts` : `createListeners(log?, label?)` → `on(listener, { signal })`, `emit(...)` (chaque abonné dans un `try`, erreur journalisée), `size`.
- `react.ts` : `fiberOf(node)`, `fiberAncestors`, `currentFiberAncestors(node)` (arbre **affiché** : le fiber noté sur un nœud peut être la version précédente ; portails compris, arbre parcouru en entier si besoin), `findPropsAbove(node, test)` → `{ fiber, props }`, `stateHooks(fiber)` → `{ value, set }[]`, `callbackHooks(fiber)` (rappels `useCallback`), `refHooks(fiber)` (valeurs des `useRef`), `providedContexts(ancêtres)` (contextes fournis au-dessus d'un nœud, à refournir dans une autre racine), `setReactInputValue(champ, valeur)` (setter natif + `input`).
- `turbopack.ts` : `pageModules()` → `{ sources(), loaded(), require(id), load(chargeur) }` : modules de la page lus par un module à nous inscrit dans le registre de Turbopack (une fois par page ; `undefined` sans Turbopack). Reconnaître un module à son code (`sources`), les identifiants n'étant pas garantis.
- `page-react.ts` : `findPageReact(modules.loaded())` (React et react-dom/client du site), `renderPageComponent(page, composant, props, { contexts, onError })` : racine React à nous sur un nœud détaché (composants rendus en portail), retirée par `unmount()` à la tâche suivante.
- `audio.ts` : `trackSounds()` (au démarrage) reconnaît les sons Web Audio à leur fichier, chargé puis décodé ; `blockSounds(filter, { signal })` : un son filtré est joué sur une durée nulle.
- `guards.ts` : `isRecord`, `isSet`, `parseJson` (`undefined` si invalide). `text.ts` : `normalizeText`, `textOf`.
- `storage.ts` : `jsonStore(clé, repli, parse)` (relu à chaque `get` ; refusé par le navigateur : gardé en mémoire). `idb.ts` : `idbStore({ database: { name, version, stores }, store })` (clé `id`), jamais d'exception, repli en mémoire si IndexedDB est indisponible ou bloqué (2 s). Une base partagée par plusieurs magasins est décrite une fois (`MARKET_DATABASE`) : la mise à niveau crée tous ceux qui manquent, et une version différente ferait échouer l'ouverture.
- `log.ts` : `createLogger(scope)` → `[WM <scope>]`, `debug` en dev seulement ; `errorMessage`. Seul module autorisé à utiliser `console`.
- `expose.ts` : `window.wm` (`version`, `dev`), `expose(clé, valeur, signal)` ; chaque module déclare ses commandes en augmentant `WmApi` (propriété optionnelle). Commandes : `wm.features`, `wm.market` (`cache()`, `clear()` : features/market), `wm.debug` (dev : `capture()`, `exchanges()`, `sockets()`, `domSyncs()`, `sb(chemin, prefer?)`, `clear()`).

## site : connaissance du site

Tout ce qui lit le DOM, l'état React, les requêtes et le temps réel du site. Le comportement du site lui-même : [`site/README.md`](site/README.md) et une page par fichier.

### Socle commun de `site`
- `routes.ts` : `PULLS_ROUTE`, `COLLECTION_ROUTE`, `GLOBAL_COLLECTION_ROUTE`, `MARKETPLACE_ROUTE`, `AUCTION_ROUTE` (`/marketplace/:id`), `MY_PROFILE_ROUTE`, `PROFILE_ROUTE` (`/profile/:name`), `TRADES_ROUTE`, `FRIENDS_ROUTE`, `DMS_ROUTE`, `GUILD_ROUTE`, `BATTLE_ROUTE`, `auctionPath(id)`. Aucune route écrite en dur ailleurs.
- `dom.ts` : `isOwn(node)` (dans un `.wm-root`), `siteButtons(root)` (sans les nôtres), `hasIcon(element, ...noms)` (icône lucide `svg.lucide-<nom>`, alias compris).
- `router.ts` : routeur Next.js trouvé dans l'état React (`findNextRouter`) ; `guardRouterPush(garde, { signal })` refuse une navigation de `router.push` ; `navigateTo(href)` (sans nos gardes, chargement de la page à défaut).
- `clock.ts` : `trackServerClock` (en-tête `Date` des réponses fraîches du site et de Supabase ; écart de moins de 2 s ignoré ; `serverOffset(headers, reçueÀ)` le mesure), `serverNow()` ; `preciseServerNow()` : bornes de l'avance recoupées d'une réponse à l'autre (`narrowOffset` : entre `date − réception` et `date + 1 s − départ`), à quelques centaines de ms, écart de moins de 2 s compris ; `onServerSecond(listener, { signal })` : une minuterie pour tous, calée sur le changement de seconde du serveur.
- `pro.ts` : `trackProStatus` (lu dans les réponses du site, aucune requête ; événement `wikimasters:is-pro-changed`), `proStatus()` (`undefined` : inconnu), `onProStatusChange`, `openProUpgrade()` (événement `wikimasters:open-pro-upgrade`) ; dernier statut retenu (`wm-pro-v1`).
- `me.ts` : `trackMe`, `myUsername()`, `onMeChange` : id et pseudo lus dans les réponses du site (profil, amitiés), dernier vu retenu (`wm-me-v1`), ignoré si la session est celle d'un autre compte.
- `sound.ts` : réglage du son du site (`isSiteSoundOff`, `enableSiteSound` ; lu une fois par chargement par le site), noms de ses sons (`SITE_SOUNDS`).
- `header.ts` : boutons du solde (`findBalanceButtons` : barre mobile et boîte ordinateur ; `isBalanceButton`), son cadre (`BALANCE_BOX`, `BALANCE_ROW`), `balanceBottom` (bas du cadre : position des toasts), rangs de nos boutons devant lui (`HEADER_RANKS` : engrenage, cloche ; `headerSlot`, `markHeaderItem`).
- `fields.ts` : hauteur du champ standard (`FIELD_HEIGHT`), sélecteurs des champs (`TEXT_FIELD`, `SELECT_FIELD`, `LISTBOX_FIELD`) et de leurs voisins (`SEND_BUTTON`, `COLOR_PICKER`, `HEX_ROW_BUTTON`).
- `listbox.ts` : `findListbox(bouton)` → props de sa liste déroulante (`ariaLabel`, `value`, `options`, `onChange`) ; `chooseSelectValue(select, valeur)` : un `<select>` changé comme par l'utilisateur.
- `tabs.ts` : menus soulignés (`findUnderlinedTabBars`) et en segments (`findSegmentTabBars`, `ACTIVE_SEGMENT_TAB` en sélecteur CSS, `RESTYLED_SEGMENT_TABS` posé par site-tabs).
- `rarity.ts` : `RARITIES` (L UR SR R PC C), `RARITY_NAMES`, `rarityColor`, `rarityBadgeStyle`, `parseRarity`. `rarity-pills.ts` : `findRarityPills(scope?)` (pastilles cochées, bouton « Réinitialiser… »).
- `page-spinner.ts` : `soleMainChild`, `showsPageSpinner` (rond de chargement d'une page, unique enfant de `<main>`).
- `pagination.ts` : barres de pagination des listes (`findPaginationBars`, `paginationButtons`, `parsePageLabel`). `list-query.ts` : requêtes des listes filtrées (`ListQuery`, `BaseListQuery`, `readBaseListQuery`, `splitRarities`, `appendRarities`, `checkedRarities`, `SITE_TYPING_DELAY`) et `ListSource` (description d'une liste pour `services/list-search`). `list-page.ts` : `refreshAbove` (« tirer pour rafraîchir » : `onRefresh`), `statesAboveRefresh`, `uniqueStateRun`, `renewSet`.

### `site/api` : requêtes du site
- `siteRequest(chemin, init, parse)` : une route `/api/…` par `net.fetch`, une seule tentative, `SiteApiError` en cas d'échec. Erreurs (`errors.ts`) : `SiteApiError`, `NETWORK_ERROR` (« Le site n'a pas répondu (erreur réseau). », texte unique), `siteErrorMessage(body, status)`, `siteErrorText(error)`, `watchSiteRefusal`.
- Supabase avec la session du site : `trackSupabaseSession` (clé et jeton de sa dernière requête, jeton renouvelé ; sans requête vue : jeton du cookie de session, `readSessionCookie`, et clé gardée, `wm-supabase-v1`), `supabaseUserId`, `supabaseFetch` (réponse brute), `supabaseRequest` (REST, une tentative), `supabaseRealtimeAccess`, `isMyProfileRpc`.
- Cartes : `discardUserCard`, `readDiscard` ; enchères : `readAuctionCreation`, `readAuctionCancel`, `readAuctionRequest`, `parseAuctionCard`, `parseListingCard` (carte d'une annonce, rareté de l'exemplaire) ; ventes d'une carte : `fetchCardSales`, `parseCardSales`, `readSalesRequest` ; étiquettes : `createTags`, `addTagsToCards`, `removeTagsFromCards` (une requête pour toute la sélection) ; liste de souhaits : `isWishlistChange`, `readWishlistChange`, `addToWishlist`, `removeFromWishlist` ; pack PRO du jour : `fetchProDaily`, `parseProDaily`, `claimDateOf`, `PRO_DAILY_PATH`.
- Amis : `Player` / `parsePlayer`, `Friendship`, `fetchFriendships`, `parseFriendships`, `friendOf`, `removeFriendship`, `isFriendshipDelete`, `isFriendsList`, `readFriendshipAction`, `parseSentFriendship`, `isPlayerSearch` / `parsePlayerSearch`.
- Notifications : `isNotificationsList`, `markNotificationsRead`. Création de guilde : `createGuild`, `GUILD_NAME_MIN`, `GUILD_NAME_MAX`, `GUILD_DESCRIPTION_MAX`. Chat de guilde : `fetchGuildChat`, `sendGuildMessage`, `fetchGuildSender`, `parseGuildMessage`, `GUILD_MESSAGE_MAX_LENGTH`.

### `site/realtime`
`decodeBroadcast` : diffusions binaires de Supabase Realtime (canaux privés du site) en JSON. `openRealtimeChannel(options)` : canal à nous sur notre propre WebSocket, avec la session du site, rejoint comme le site rejoint ses canaux publics (`postgres_changes`, `joinPayload`), battement, jeton renouvelé, reconnexion (2 / 5 / 15 / 30 s) ; `onStatus('joined')` après chaque connexion pour relire ce qui a pu être manqué. Client du site (`client.ts`) : `findSiteRealtime(nœud)` (dans les `useRef` des composants au-dessus), `readSiteRealtime(supabase)` → `link(nom)` (`live`, `connecting`, `down`), `reconnect(nom)` (WebSocket fermée et canal en erreur relancés aussitôt).

### `site/modals`
`SITE_OVERLAY` (sélecteur du fond d'une modale du site, hors copies qui s'effacent : à utiliser pour toute recherche), `isSiteOverlay` (écarte aussi les feux d'artifice des légendaires et les modales intégrées), `readSiteModal` (lit aussi un fond déjà retiré), `findSiteModals`, `isSiteModalOpen` (une modale cachée par une fonctionnalité compte), `topSiteModal`, `escapeTarget` (fermeture, sinon « Annuler », jamais le fond), `isCornerCross`.

### `site/cards`
- `face-card.ts` : `readFaceCard` (carte d'une face des grilles, props de son composant).
- `face.ts` : `FACE`, `SMALL_FACE` (faces des grilles), `FACE_TEXT`, `FACE_BOTTOM` (bas du texte), `FACE_STATS` (ATK · DEF), `FACE_CORNER_BUTTON`, `FACE_SELECTION_BOX`, `findFaceImage`, `findFaceBottomPlace` (où poser une pastille comme celles de son emplacement du bas), `cloneSiteFace(face, { inert })`.
- `modal.ts` : `findCardModals` (toute modale de carte, reconnue à ses onglets Détails / Marché), `readModalCard` (sa carte, lue dans l'état React) ; `CardModal.kind` : un de mes exemplaires, vue catalogue (sans favori ; liste de souhaits) ou exemplaire d'un ami (« Proposer un échange »), déduit de ce qu'elle affiche ; `tradeButton`, `tradePending`, `sideActions` (bloc échange et liste de souhaits de la colonne de droite) ; `readModalView` (carte, exemplaire et origine : catalogue, exemplaire d'un ami, le mien, d'après ses props), `findModalFaces` (toute modale qui montre une carte en grand, celle d'un exemplaire d'un ami comprise).
- `findCardGrids` (rangée `flex-wrap` au-dessus d'une face), `findAuctionModal` / `parseDuration`, `findDiscardConfirm`, `findStarButton`, `readStarChange` / `readTagAdded` / `readTagRemoved`, `CardRef` / `parseCardRef`.

### `site/pulls`
Paquet ouvert (`isPackOpening`, `parsePack`, `isCopiesQuery`, `parseCopies`, `copiesByCard`), carrousel (`findCarousel`, `carouselCards` : cartes lues dans son état React), cadre des paquets disponibles (`findPackCounter`), bouton du paquet (`findPackButton`), pack PRO du jour (`findProPack`, `proClaimDate`, `isProDaily`, `isProDailyStatus`, `findProDailyStates` : états de la page), encart de vérification humaine (`findHumanCheck`, `isHumanCheckSubmit`).

### `site/collection`
- Liste et compteurs : `isCollectionList`, `isCollectionStats` (sans `owned_by` : pas la collection d'un ami), `parseCollection`, `findCollectionFaces`, `COLLECTION_CARD_BOX` (case d'une carte), `SELECTION_OVERLAY` (calque du mode sélection), `LIST_LOADING_VEIL` ; filtres : `readCollectionQuery`, `withCollectionFilters`, `findCollectionFilters`, `findCollectionSearchField`, `findCollectionRefresh`, `UNTAGGED_OPTION`, `collectionList` (`ListSource`).
- Pagination : `findCollectionPaginationBars`, `findCollectionPageSetter`, `isPageLoading`.
- Mode sélection : `findSelectionToggle`, `findSelectionMode` (bouton du site, sinon état de la page : `findSelectionState`), `findSelectionBar`, `selectionMarkOf`, `findBulkTagModal`, `isBulkDiscard`, `readBulkDiscard`, `readBulkDiscardFailures`, `findBulkDiscardConfirm`.
- Étiquettes : `applyTagChange` (pose ou retire des étiquettes dans l'état de la page, sans recharger), `findTagManager`, `tagManagerOpener`, `findManageTagsOption`, `tagChipStyle`, `TAG_PALETTE`, `randomTagColor`, `normalizeTagName`, `TAG_NAME_MAX`.

### Autres listes
- `site/global-collection` : `globalCollectionList`, `findGlobalCollectionFilters`, `findGlobalCollectionSearchNotice`, `isGlobalCollectionLoading`, `readGlobalCollectionChoice`, `withGlobalCollectionFilters`, pages gardées en `sessionStorage` (`forgetGlobalCollectionPages`, `forgetGlobalCollectionPagesSoon`), états de la page (`findGlobalCollectionStates`, `findGlobalCollectionReload`), amis qui ont une carte et cartes possédées (`findFriendOwnersPills`, `readFriendOwners`, `readCatalogOwnedCards`).
- `site/marketplace` : onglet « Parcourir » (`marketplaceList`, `findMarketplaceFilters`, `findMarketplaceLoadMore`, `findMarketplaceRefresh`, `isMarketplaceMineRefresh`, `readMarketplaceChoice`, `withMarketplaceFilters`) ; vignettes (`TILE`, `TILE_LINK`, `TILE_FACE`, `OWN_TILE`, `OWN_TIME`, `findMarketplaceSellers`, `findSiteAuctionTiles`, `findTileDurations`, `readTileEndAt` ; `findAuctionTiles` (site et nôtres : colonne, face), `readTileAuction` (carte, montant, statut), `ownTileData` (annonce de nos vignettes en attributs)) ; page d'une enchère (`AUCTION_MARKET_BUTTON`, `auctionChannel`, `findAuctionPlayers`, `findAuctionReport`, `findAuctionNotFound`) ; `findMarketplaceTabs` (onglet du site choisi, `addedActive` : un onglet à nous choisi).
- `site/profile` : `profilePath(pseudo)` (encodé), en-tête d'un profil, le sien ou celui d'un autre (`findProfileHeader`, `findUniqueCardsStat`, `isProfileVisibilityChange`, `splitProfileLine` ; id du joueur dans l'état de la page : `readProfilePlayer`), demande d'ami sous l'en-tête (`findProfileFriendRequest`), « Retirer des amis » (`findUnfriendButton`, `parseUnfriendConfirm`), `showsProfileNotFound`, « Choisir une carte » de la vitrine (`findCardPicker`), collection d'un ami (`profileCollectionList`, `findProfileCollectionFilters`, `findProfileCollectionPaginationBars`, `findProfileCollectionStates`, `findProfileCollectionReload`, `isProfileCollectionLoading`, `hasProfileCollectionCards`, `readProfileCollectionChoice`, `PROFILE_COLLECTION_SPINNER`, `findProfileCollectionFaces` : cartes et `owned_by_viewer`, état de l'onglet ; `readProfileOwnedCards` : pour la modale d'un exemplaire).

### Pages sociales
- `site/friends` : `findFriendsPage` (en-tête, section « Amis (n) » et sa recherche ou son cadre de liste vide, lignes et leurs boutons reconnus à leur icône, demandes reçues et envoyées) ; fenêtre « Rechercher un joueur » (`findPlayerSearch`) ; état de la page : `readFriendRow`, `readFriendsData`, `friendsOwner`, `applyFriendsChange` (changement confirmé appliqué comme le montrerait la relecture, rejouable sans effet), `dropFriendship`.
- `site/trades` : `findTradesPage` ; fenêtre « Échanger avec » / « Contre-offre » (`findTradeComposer`, `parseTradeSummarySide`, `readTradeRarities`, `readTradeFilter`, `readTradeWikibidousButton`, `readTradeWikibidousEditor`, `tradeCardsSide`, `reloadTradeCards`) ; `parseTradeWikibidous`, `TRADE_WIKIBIDOUS_MAX` ; « Choisir un ami » (`findFriendPicker`, `acceptedFriends`, `friendshipDates`) ; ouvrir la fenêtre d'échange avec un ami là où le site ne l'offre pas (`openTradeComposer`, `locateTradeComposer`, `TradeComposerUnavailable`).
- `site/dms` : `findDmsPage`, `dmsRowAt` ; conversations (`findChatWindows` : fond, cadre, fermeture, interlocuteur ; `GUILD_CHAT_CLASS`) ; messages (`findChatList`, `readChatDays`, `readChatMessageDates` : `created_at` dans l'état React, `CHAT_ROW_DATA` sur nos lignes).
- `site/guild` : en-tête (`findGuildHeader`), `GUILD_GRADIENT_LAYER`, onglet Chat (`findGuildChatTab`), liste de souhaits (`findGuildWishRequesters` : autres membres, `parseRequesterLabel`, `findGuildWishes` : je possède la carte, état de l'Accueil ; `findOwnGuildWishImage` : « Ma demande »), création (`findNoGuildCard`, `reloadSiteGuild` : le chargeur de la page, pris dans son état), guilde du joueur (`myGuild` : retenue dans `wm-guild-v1`, relue dans Supabase au plus toutes les 4 h, `GUILD_CHECK_MS` ; `trackGuildMembership` au démarrage ; `readGuildsResponse`, `forgetMyGuild`).
- `site/notifications` : cloches du site (`findSiteBells`, `SITE_BELL`), état React (`readSiteNotifications` : liste, `markAsRead`, `markAllAsRead`, `fetchNotifications`) ; `parseNotification`, `notificationLabel`, `notificationText`, `notificationPath`, `wishlistCardOf`, `formatNotificationDate` ; `openSiteNotification` (clic relayé à sa liste cachée : fenêtre d'une sanction).

## ui : interface Preact générique

Aux couleurs du site, ne dépend que de `core`. Toujours dans un conteneur `.wm-root` à nous.

- `mount.ts` : `mountUi(vnode, { parent, before, after, inline, className, signal })` (posé une fois) ; `createSlot(signal)` / `createSlots(signal)` : `render(vnode, placement)` met à jour si l'interface est encore au bon endroit (`isPlaced`), sinon la remonte ; `clear`, `prune`, `clearAll`. `inline` : conteneur `display: contents` (`INLINE_CLASS`) pour glisser un bouton dans une rangée du site, sans style de base.
- `theme.ts` : `tokens` (variables CSS du thème du site, avec repli), `palette` (Tailwind v4 pour ce que le thème n'a pas), `alpha(couleur, %)`, `DISABLED_OPACITY` (0,5 partout, demande de l'utilisateur), `layers` (z-index de nos calques : `widget` < `pageOverlay` < `window` < `modal` < `menu` < `toast`, tous au-dessus du site), `ensureBaseStyle`.
- `button.ts` : `buttonClass(forme, { tone, fill, size, pill })`. Formes : `standard` (largeur du texte), `window` (moitié d'une rangée Annuler · action), `wide`, `square`, `round`. Couleurs : `neutral`, `danger`, `info`, `accent` (vert du site), `warning`, `pro` (dégradé). Remplissage : `solid`, `outline`, `ghost`. Tailles : `lg` 48 px, `md` hauteur des champs (≈ 45 px), `sm` 30 px, `xs` 20 px (« tiny », texte 10 px) ; une taille = une hauteur pour toutes les formes. `pill` : bords arrondis à 100 % (formes longues). `applyButtonClass` habille un bouton du site. Tout dans notre feuille, hors couches : l'emporte sur Tailwind.
- `icons.tsx` : `Icon` (lucide, même jeu que le site ; `spinner` tourne d'office ; `busy` : la roue à la place), `ICON_NAMES`. Marché = `market` (`chart-line`) ; temps réel = `wifi` / `wifi-off`.
- `lock.ts` : `lockControl` (plusieurs propriétaires, info-bulle, rétabli tel qu'il était, `busy` : roue à la place de l'icône lucide ou devant le texte, `aria-busy`), `lockReason`, `unlockAll`.
- `stamp.ts` : **toute carte grisée ou verdie** (demande de l'utilisateur : même teinte, même fondu partout). `STAMPS` (« Défaussée » grisée en rouge, « En vente » et « Vendue » en vert, « Pas vendue » en gris ; `greyed` : grisée sans texte, carte non cochée en sélection, enchère finie ; tons `danger`, `success`, `neutral`), `stampFace(face, owner, stamp)`, `syncStamps`, `isStamped`, `stampedFaces`, `unstampAll`. Teinte = filtre de couleur sur les enfants de la face (le texte reste net), **jamais de transparence** (demande de l'utilisateur : même rendu sur tout fond), au même assombrissement pour toutes les couleurs (luminosité 55 %, 80 % au survol) ; une nouvelle couleur s'ajoute dans `TONES`. Halo retiré ; fondu de 300 ms (celui des faces du site, qui effacent leur halo au même rythme) à la pose comme au retrait, texte compris. Option `lightenOnHover` : teinte atténuée au survol (activée sur tous les `STAMPS` pour l'instant). Une face porte un seul tampon ; une simple teinte cède la place à un tampon avec texte, et revient une fois la face libre. Dans une modale (`revealable`), clic sur la carte pour la revoir sans tampon.
- `site.ts` : `siteClass`, classes Tailwind relevées dans le balisage du site (`npm run site:classes` les vérifie).
- `toast/` : `toast.error(message, { title, sticky, durationMs, action })` (8 s, en haut à droite sous le solde) ; `toast.show`, `toast.success`, `toast.info` (en bas à droite, 6 s ; pile remontée au-dessus d'un encart fixe par la variable `TOAST_BOTTOM_VAR` sur `body`) réservés à `services/notifications` et aux outils de dev (ESLint). Action avec `href` : un vrai lien (Ctrl, Maj, clic du milieu laissés au navigateur, puis `onOpenElsewhere`), qui ferme le toast comme un clic. Minuté : barre du temps restant, arrêtée sous le curseur ; sortie en fondu (`leaving.ts`), aucune avec moins d'animations demandé. Allure : fond uni du site, bordure et halo de la couleur, icône seule en haut, jamais de liseré latéral ni de dégradé (demande de l'utilisateur).
- `modal/` : `Modal` (titre, `titleBefore`, `subtitle`, `actions` avant la croix, `width`, `height`, `maxHeight`, `padded`, `locked` : ni Échap, ni fond, ni croix), `openConfirm` (confirmation comme celle du site : titre, texte, Annuler · action rouge, roue pendant l'action), `useModalBehavior({ overlay, frame, onClose, locked })` (comptée par `isModalOpen`, Échap pour celle du dessus seulement, fond gardé des glisser, focus, fondu), `useSmoothExit`, `useBackdropGuard`, `leaveSmoothly(overlay, …)` (copie inerte `GHOST_CLASS` à la place d'une modale retirée : canevas, saisies et défilement recopiés via `trackScrolls`), entrée et sortie en 180 ms.
- `controls/` : `CloseButton` (petit rond gris ghost), `Switch`, `NumberField`, `ChoiceField`, `StepSlider` (curseur cranté), `CaseFilter` (cases collées, cochées en bordure intérieure de leur couleur, croix qui décoche tout), `Listbox` (la liste déroulante du site, menu dans `body`, au-dessus des modales), `Pagination` (|< < Page [n] / total > >|, page visée affichée aussitôt et demandée 300 ms après le dernier clic ; `pageTargets`, `parsePage`), `ReportButton` (« Signaler l'image » en pastille sur l'image), `LoadError` (liste en échec : `wifi-off`, texte, « Réessayer » avec roue).
- `cx.ts` : `cx(...classes)`. `hooks.ts` : `useLatest(valeur)`.

## services : logique partagée entre fonctionnalités

- `list-search/` : recherche des quatre pages de listes (Collection, Toutes les cartes, Marché, collection d'un ami), décrites chacune par un `ListSource` de `site/` (`collectionList`, `globalCollectionList`, `marketplaceList`, `profileCollectionList`).
  - `defineListSearchFeature(config)` : la fonctionnalité « Empêcher le rechargement automatique » entière (bouton vert au bout des filtres, Entrée, verrous) ; `HOLD_SETTING` (textes communs, interne).
  - `trackListHold` (interne) : un changement de choix ou de recherche reçoit la liste affichée ; `heldReply: 'none'` : sans réponse (la page garde sa liste) ; `toShown` : réponse resservie ramenée à ce que la page a changé sur place depuis (étiquettes de la Collection) ; recherche que le site lance seul (frappe, sa croix) retenue comme un choix.
  - `trackListDelay` : 700 ms (`SEARCH_DELAY`) après le dernier changement, intercepteur `last`, requêtes remplacées jamais envoyées ; `staleResponses: 'applied'`, `immediate`, `hideWhileWaiting`. `submitAfterTyping` : recherche lancée après la frappe, sauf si la frappe est retenue.
  - `trackListMemory` : filtres retenus (`savedFiltersStore`, `parseSavedFilters`), première liste chargée avec eux, contrôles remis (`applyRarities`, `applySearch`), leurs requêtes servies ; marques entre suivis (`markRestored` / `restoredQuery`, `markLaunched` : interne, `marks.ts`).
  - Composants : `SearchButton` (`SEARCH_BUTTON_CLASS`, `snugSearchButtonCss`), `RarityFilter` et `placeRarityFilter` (cases de rareté qui cliquent les pastilles du site, cachées par `setHidden`), `WishlistToggle`, `filterLineCss` (ligne des filtres de Toutes les cartes et du Marché), `SEARCH_PLACEHOLDER` / `applySearchPlaceholder`.
- `site-pagination/` : `replaceSitePagination({ list, findBars, isLoading, jump, settleWithoutRequest? }, { signal, log })` : barres du site cachées, `Pagination` à la place, roue sur le bouton cliqué ; `jumpByPageState(findPage)`.
- `card-display/` : `cardDisplayFeature({ id, category, routes, description, siteGap, container? })` : réglages taille (`CARD_SCALES`) et espacement (`CARD_GAP`) d'un conteneur, section « Apparence » (`CARD_DISPLAY_NAME`) ; chaque réglage ne touche que ses grilles (`cardGridClass`) ; `container` : conteneur réglé à part où qu'il s'ouvre, exclu des réglages des pages ; `OWN_CARD_GRID` : grille à nous qui suit son conteneur ; aux valeurs du site, aucune règle.
- `pulls-pack/` : paquet ouvert sur /pulls (`trackPack`, `currentPack`, `onPackChange`, `packCarousel`, `markDiscarded`, `markBusy(pack, index, owner, label)` : une action à la fois par carte), verrou du carrousel (`lockCarousel`, `unlockCarousel`, `carouselLock`, `onCarouselLockChange`, `clickThrough` : clic de programme qui traverse le verrou), boutons d'action par carte (`packActions(render, { place })`, `PackActionButton`, `onPackActionsChange`, `injectCarouselStyle`).
- `pulls-grid/` : grille « toutes les cartes d'un coup » (`createPullsGrid`, `findPullsGrid`, `readPullsGrid`, `setSlotFace`, `markArrived`, zone d'actions sous chaque carte) ; `onPullsGridChange` / `notifyPullsGridChange` (la grille échappe à `watchDom`).
- `pulls-sound/` : `pullsSoundSettings` (réglage partagé entre pulls-sound et pulls-bar).
- `quick-discard/` : `quickDiscardSettings` (réglages communs), `quickDiscardProtection`, `protectionReason(faits, règles)` ; `value` / `minValue` : protection par la valeur, prévue (à garder).
- `site-confirm/` : `confirmStep` (deux clics : « Confirmer ? » inactif `CONFIRM_DELAY_MS` = 750 ms, puis actif `CONFIRM_ACTIVE_MS` = 3,5 s ; `confirmStage`) ; `autoConfirm` (confirmation du site cachée et acceptée si elle s'ouvre dans les 2 s après le clic ; refus ou sans réponse : refermée par son « Annuler »).
- `card-marks/` : `markModalCard(modal, owner, 'discarded' | 'listed' | undefined)` (actions verrouillées, carte tamponnée), `CARD_MARK_REASONS`.
- `listings/` : exemplaires mis aux enchères suivis dans les requêtes (`trackListings`, `listingOf` par exemplaire, `listedCardTitle`, `onListingsChange`).
- `market/` : historique des ventes d'une carte. Cache IndexedDB `wm-market` (`MARKET_DATABASE`, version 3 : magasins `sales` ici et `listings` de la mise aux enchères ; forme de l'ancien script : son cache est repris), durée réglable (48 h), une requête à la fois par carte, ventes demandées par le site mises en cache (`trackMarket`, `onMarketChange`, `cachedMarket`, `fetchMarket`, `isStale`, `cacheInfo`, `clearCache`). `openMarketModal(carte)` : une à la fois, par-dessus tout ; cache récent, sinon le site ; site en échec : cache même ancien + toast ; sans cache : toast seul. Compte sans PRO (`marketNeedsPro`) : offre PRO du site dans notre modale. `showMarketModal`, `showProOffer`, `closeMarketModal`, `ProBadge`, `marketSettings`. Bouton du prix moyen d'une page (`trackPrices` : cache lu une fois par carte puis suivi, clic = charger, actualiser ou historique ; `PriceButton`). Prix moyen d'une carte (`marketPrice` : 7 dernières ventes de sa rareté, arrondi au-dessus, et nombre de ventes). Statistiques et modèle du graphique sans DOM (`stats.ts`, `chart.ts`, `price.ts`) ; `formatNumber`, `ageText`, `plural`, `shortDate`, `formatTime`. Limite du site sur les ventes (30 par minute de son horloge, `SALES_PER_MINUTE`) : `trackSalesRate` compte toutes les requêtes de ventes dès leur départ, du site comme les nôtres, et les refus `automation_limit` (`wm-sales-rate-v1`, commun aux onglets, gardé au rechargement) ; `salesRate`, `onSalesRateChange`.
- `market-tile/` : carte standardisée du marché (vignettes du site et nôtres) : `ensureMarketTileStyle`, `showsEnded` (la vignette affiche « Terminée »), `TILE_ENDED`, `AuctionTime` (court « 3h », « 59min », « 59s », « Terminée » ; précis au survol ; horloge du serveur).
- `notifications/` : `notify` (succès, info : liste de la cloche `wm-notifications-v1`, 50 dernières, et toast ; avec `href`, son lien s'ouvre aussi dans un autre onglet et la marque lue), `toastNotification`, `notificationsSettings`, `localNotifications`, `markLocalRead`, `onLocalNotificationsChange`.
- `friends/` : `confirmUnfriend` (même confirmation partout : liste des amis, profil).
- `header-items/` : `placeHeaderItem(rang, render, { signal, shown? })` → `{ sync() }` : notre bouton devant chaque bouton du solde, à son rang.
- `tab-line/` : `placeTabLineButton(ctx, { find, label, narrowLabel?, size, className, scrolling? })` : bouton au bout d'une rangée d'onglets (celui du site caché et cliqué), trait du menu arrêté avant lui.
- `site-dialog/` : `mirrorSiteDialog(ctx, { find, render, onClose? })` : notre fenêtre tant que celle du site (cachée, moteur) est là.
- `main-column/` : `flexMainWhile(ctx, className, shows)` : `<main>` en colonne flex tant qu'un bloc tient lieu de page (centrage prévu par le site).
- `profile-link/` : `ProfileLink` : pseudo (ou contenu, ligne d'une liste) en lien vers le profil, navigation du site sans recharger, Ctrl / Maj / clic du milieu laissés au navigateur.
- `report-button/` : `siteReportButton(bouton)` : « Signaler l'image » du site en `ReportButton`.

## features

Une fonctionnalité par dossier, listées dans l'ordre de montage par `src/features/index.ts` (seul fichier, avec `main.ts`, qui importe `features/`). L'ordre compte entre certaines : mémoire des filtres avant la recherche (elle marque les requêtes que celle-ci lit), recherche avant le délai et avant la pagination (qui lit ses verrous). `debug`, `showcase` et `market-search` n'existent qu'en dev (`__DEV__`) : rien de leur dossier ne doit rester dans le fichier de production (`build.mjs` le vérifie).
