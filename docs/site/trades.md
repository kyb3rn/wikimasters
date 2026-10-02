# Échanges (`/trades`) et fenêtre d'échange

Offres d'échange entre amis : cartes et wikibidous des deux côtés, contre-offre, accepter, refuser. Dates en jj/mm (2026). Routes : [api.md](../api.md#échanges).

## Page /trades

_Relevé : code du site, 30/09._

```
div.space-y-6
  div.flex.items-center.justify-between   en-tête : [h1 « Échanges » + sous-titre] · button « + Proposer un échange »
                                          (« Échanger » sous sm)
  div.flex.border-b                       onglets soulignés (flex-1 py-3) : Reçues, Envoyées, Historique
  div.space-y-3                           offres de l'onglet
```

- « Proposer un échange » (anciennement « Nouvel échange ») ouvre « Choisir un ami ».
- Les échanges en cours (`GET /api/trades?active=1`) sont dans l'état de la page.
- Lecture : `src/site/trades/page.ts` (`findTradesPage`).

## « Choisir un ami »

_Relevé : code du site, 30/09._

- Portail dans `body`, fond `fixed inset-0 z-50`, cadre `max-w-md max-h-[80vh]`, en-tête (`h2` « Choisir un ami », croix), champ « Rechercher... » au-delà de 3 amis (filtre local sur le pseudo), liste `div.overflow-y-auto` : roue pendant le chargement, « Aucun ami pour le moment. » / « Aucun résultat. », ou une ligne `button` par ami (clé React = id du joueur : photo, pseudo, « Échanger → »).
- Composant `{ currentUserId, onSelect, onClose }`, états : amis (`{ id, username, avatar_url, avatar_pos_x, avatar_pos_y }`), chargement, recherche.
- À l'ouverture, `GET /api/friends` : l'autre joueur de chaque amitié acceptée. Réponse en erreur ou échec réseau : liste vide, comme sans ami (« Aucun ami pour le moment. »).
- Photo floutée selon le réglage des images sensibles (`blurredAvatarUrls` du site).
- Clic sur une ligne : `onSelect(ami)`, la page ferme la fenêtre et ouvre « Échanger avec … ». Pas d'Échap.
- Lecture : `src/site/trades/friend-picker.ts` (`findFriendPicker`, `acceptedFriends`, `friendshipDates`).

## Fenêtre d'échange

_Relevé : code du site, 30/09._

« Échanger avec … » / « Contre-offre avec … », ouverte depuis /trades, la page Amis (« Échanger ») et la modale de carte du catalogue (« Proposer un échange ») : elle peut apparaître sur toutes ces pages. Le script l'ouvre aussi sur le profil d'un ami ([Ouverte par le script](#ouverte-par-le-script)).

- Portail dans `body`, fond `fixed inset-0 z-50` (`p-2`), cadre `max-w-5xl h-[90vh]` (modale « en-tête en barre », [README](README.md#modales)).
- En-tête : `h2` avec le pseudo de l'ami dans un `span` accent. Résumé « Moi : n cartes · m wb ⇄ … ».
- Onglets soulignés « Mes cartes » / « Cartes de … » (`py-2`) : seul le contenu de l'onglet choisi est rendu (clé React `tab-mine` / `tab-theirs`).
- Zone qui défile : « Sélectionnées (n) » s'il y en a, les filtres, la zone des cartes. Puis Annuler · « Envoyer l'offre ».
- Échap ou le fond : fermeture, confirmée (« Modifications non enregistrées », Rester / Quitter) s'il y a des changements.
- Envoi : `POST /api/trades`, refusé si un montant dépasse le solde.
- Lecture : `src/site/trades/composer.ts` (`findTradeComposer`).

### Filtres

- Bloc `div.mb-4.flex.flex-col.gap-3` de chaque onglet : rangée `div.flex.flex-col.gap-3.sm:flex-row` avec le champ « Rechercher... » (`py-2`) et, à droite, un groupe `div.order-1` de petits boutons `px-3 py-1.5 text-xs`.
- Recherche : filtre local de la page chargée, puis requête 300 ms après la frappe ; texte ambre sous 3 caractères.
- « Ajouter des WB » : composant `{ value, onExpand }`, montant en badge ambre quand il y en a ([Wikibidous](#wikibidous)).
- « Rareté » : liste à plusieurs choix, composant `{ filter: Set, onChange }` ; un changement revient en page 1.
- « Filtre » : composant `{ tags, activeTagId, onSelect, wishlistLabel, wishlistTitle, wishlistActive, onWishlistToggle }` : « Souhaits de … » côté mes cartes, « Mes souhaits » côté ami, puis « Toutes les cartes » et les étiquettes `#nom` avec leur nombre.
- Menus en portail (`z-index: 70`) ; Échap ferme le menu **et** la fenêtre (les deux écoutent `window`).
- Lecture : `readTradeRarities`, `readTradeFilter`.

### Wikibidous

- Un clic sur « Ajouter des WB » retire le bouton et ouvre, sous la rangée, un champ : composant `{ label, value, onChange, onClose, balanceHint, maxBalance }`. « Wikibidous que j'offre » avec le solde (relu par `GET /api/wikibidous` à l'ouverture), ou « Wikibidous demandés à … » sans limite.
- Entier de 0 à 10 000. « Enregistrer » (ou Entrée) appelle `onChange(montant)` puis `onClose()`. Aucune annulation.
- Lecture : `readTradeWikibidousButton`, `readTradeWikibidousEditor`, `parseTradeWikibidous`, `TRADE_WIKIBIDOUS_MAX` (`src/site/trades/wikibidous.ts`).

### Chargement des cartes

- Chaque côté se charge dans un effet : les deux à l'ouverture, puis à chaque changement de page, de recherche, de raretés (identité du `Set`), d'étiquette ou de liste de souhaits. 50 cartes par page.
  - « Mes cartes » : `GET /api/my-collection?sort=rarity[&q][&rarity…][&tag_id][&wishlisted_by=<ami>]&page=&stats=0&owned_by=<ami>` (+ `/api/my-collection/stats` en page 1) ;
  - « Cartes de … » : `GET /api/profile/<ami>/collection?page=&sort=rarity&stats=[&q][&rarity…][&tag_id][&wishlisted_by_me=1]&pending=1`.
- Zone des cartes `div.relative.min-h-[200px]` : voile avec roue pendant un chargement, grille ([README](README.md#grilles-de-cartes)), pagination ← n / m →, ou « Aucune carte » / « Collection vide ».
- **Réponse en erreur** : grille vidée, `p[role=status]` rouge sous la rangée (« Le chargement de tes cartes a échoué. Réessaie dans un instant. » ; 504 : « La recherche a pris trop de temps… »). **Échec réseau** : rien (exception non rattrapée, l'ancienne liste reste).
- Aucune requête interrompue.
- Lecture : `tradeCardsSide` (côté qu'une requête charge, pour l'ami de la fenêtre ouverte), `reloadTradeCards` (même liste rechargée par un nouvel ensemble de raretés).

### Cartes choisies et résumé

- Bloc `div.mb-4` au-dessus des filtres : « Sélectionnées (n) », grille, trait `border-b mt-4`.
- Chaque case est un `button.relative.rounded-2xl.overflow-hidden.border-2` : choisie, trait accent, ombre, voile teinté avec un rond ✓ ; bloquée (échange en attente, 100 cartes atteintes), `opacity-50 cursor-not-allowed`, sans `onClick`.
- Résumé sous l'en-tête (`div.justify-center`) : deux `span` « Moi : n carte(s)[ · m wb] » et « <ami> : … », flèche lucide `arrow-left-right` ; accent pour un côté non vide.
- Lecture : `parseTradeSummarySide`.

### Ouverte par le script

_Relevé : code du site, 02/10._

- Composant `{ friendUsername, friendProfileId, preselectedFriendCard, preselectedFriendCards, parentTradeId, preselectedMyCards, preselectedMyWikibidous, preselectedFriendWikibidous, onClose, onSent }`, export par défaut de son module (`273271`), rendu en portail dans `body`. La page Amis lui passe `{ friendUsername, friendProfileId, onClose, onSent }` (`friendProfileId` : id du joueur) ; `onSent`, appelé après un envoi réussi, ferme la fenêtre comme `onClose`.
- Importé directement par la page Amis et /trades. Sur un profil, seule la modale d'un exemplaire de l'ami le charge, par un import dynamique : enveloppe `function $({ friendUsername, friendProfileId, preselectedFriendCard, onClose })`, qui attend `e.A(<chargeur>)` (`799047`) puis rend le composant, avec une roue `fixed inset-0 z-[60]` en attendant. Le profil n'a pas d'autre bouton d'échange.
- Contextes lus : le joueur connecté (`useUserId`, qui lève une erreur hors de son `AuthProvider`) et le réglage des images sensibles (cartes floutées). Aucun routeur.
- Ouverte par le script (profil d'un ami) : React et react-dom/client de la page trouvés parmi ses modules, composant par son module s'il est déjà inscrit, sinon par le chargeur de l'enveloppe, rendu dans une racine React à nous, sous les contextes de l'arbre de la page (valeurs au moment de l'ouverture). Les fonctionnalités de la fenêtre (`routes: 'all'`) s'y appliquent comme ailleurs.
- Lecture : `src/site/trades/open.ts` (`openTradeComposer`, `locateTradeComposer`).

## Dans le script

`trade-filters`, `trade-wikibidous`, `trade-cards-error`, `trade-summary`, `trade-selection`, `trade-friend-picker`, `trades-tab-line`, `trades-card-display`, `player-links` (pseudo de l'ami dans le titre). Détail : section « Échanges » de [features.md](../features.md).
