# Marché (`/marketplace`) et page d'une enchère (`/marketplace/<id>`)

Dates en jj/mm (2026). Routes et forme des annonces : [api.md](../api.md#marché). Commun aux listes filtrées : [README](README.md#listes-filtrées). Mise aux enchères depuis la modale de carte : [README](README.md#mise-aux-enchères).

## Règles du marché

_Relevé : code du site et réponses, 29 et 30/09._

- Durées proposées : 10 min, 30 min, 1 h, 3 h, 6 h, 12 h.
- Au plus 5 ventes simultanées, 10 pour un compte PRO (`maxConcurrentAuctions` du serveur ; constantes `MAX_CONCURRENT_AUCTIONS_REGULAR` / `_PRO` du code du site).
- Statuts d'une annonce : `active`, `settled_sold` (vendue), `settled_unsold` (terminée sans mise), `cancelled` (retirée par le vendeur).
- Mise refusée si trop basse (`bid_too_low`, avec le minimum) ou solde insuffisant (`insufficient_balance` : le site ouvre la boutique). Les wikibidous misés sont bloqués, remboursés en cas de surenchère.
- Une nouvelle mise peut repousser la fin (`end_at` de la diffusion `BID`).
- Le vendeur peut baisser **une fois** sa mise de départ, passé la moitié de la durée, sans mise reçue (`base_repriced_at`, `listing_base_amount`).
- Une enchère terminée se finalise (`POST …/settle`) ; une annonce se retire tant qu'elle est active (`DELETE`, l'exemplaire revient dans la collection).
- Annonces farfelues possibles (mise de départ à 2 147 483 647, le maximum accepté).

## Onglets

_Relevé : captures du 29/09._

- Dans `div.flex-1.p-4.md:p-6.space-y-6`, après l'en-tête : `div.flex.overflow-x-auto.border-b` › un bouton par onglet : Parcourir, Mes ventes (n/max), Mes enchères (n), Gagnées (n), Historique (n) ; choisi : `border-b-2`. Le contenu de l'onglet choisi suit, en frères.
- Tous remplis par la même requête (`mine=1`) : aucun appel au changement d'onglet.
- **Mes ventes** : mes annonces actives. **Mes enchères** : annonces encore actives où j'ai misé, avec un bandeau au-dessus de la vignette : « Vous menez » (vert, `bg-emerald-500/15`, je suis `current_bidder_id`) ou « Surenchéri » (ambre, `bg-amber-500/15`). **Gagnées** : les 50 dernières enchères remportées. **Historique** : les 50 dernières de mes ventes terminées (vendues, invendues, annulées). Du plus récent au plus ancien ; les compteurs de ces deux derniers plafonnent donc à 50.
- Listes vides : « Vous n'avez aucune vente en cours. », « Vous n'êtes en lice sur aucune enchère. », « Vous n'avez encore remporté aucune enchère. ».
- Lecture : `src/site/marketplace/tabs.ts` (`findMarketplaceTabs`).

## Parcourir

_Relevé : code du site, 30/09._

- Liste : `GET /api/marketplace?page=&limit=50&sort=[&mine=1][&q=][&rarity=…]` (`page` à partir de 1 ; `mine=1` tant que la page n'a pas reçu ses listes personnelles).
- Filtres, dans `div.space-y-3` : ligne `div.flex.flex-col.sm:flex-row.gap-2` avec le champ `type="search"` « Rechercher une carte… » (dans `div.relative.flex-1`, loupe lucide à gauche, croix « Effacer la recherche »), le bouton d'accent « Rechercher » (désactivé tant que le champ sans ses espaces vaut la recherche en cours) et le `<select>` natif du tri `sm:w-56` (Récemment listées, Mise la plus basse, Mise la plus haute, Fin imminente) ; puis les pastilles de rareté (« Réinitialiser »). Champ et select sur `bg-[var(--color-surface)]` (ceux de la Collection : `surface-light`).
- **La recherche ne part qu'à Entrée ou « Rechercher »** ; la croix vide le champ et lance aussitôt la recherche vide.
- Tri et raretés rechargent la page 1 aussitôt, **sans aucune roue** : la grille change à la réponse. Seul le premier chargement fait tourner la page.
- « Charger la suite » (« Chargement… » pendant sa requête), sous la grille, ajoute la page suivante.
- Actualisation : `onRefresh` du « tirer pour rafraîchir » (aussi « Rafraîchir » d'une liste vide) : page 1 avec les filtres tels qu'ils sont, `mine=1` compris.
- Pour relire seulement ses listes personnelles, le site demande `page=1&limit=1&mine=1`.
- Lecture : `src/site/marketplace/list.ts` (`marketplaceList`, `isMarketplaceMineRefresh`, `isMarketplaceAppend`, `findMarketplaceFilters`, `findMarketplaceRefresh`).

### Retour d'une annonce

- Au clic sur une annonce, la page garde son état en `sessionStorage['marketplace_list_v3']` : `activeTab`, `browse` (annonces chargées), `browseHasMore`, `nextBrowsePage`, `search` (texte du champ), `submittedSearch` (recherche lancée), `sort`, `rarityFilter`, `mine`, `scrollTop`, `focusAuctionId`.
- À la prochaine arrivée sur /marketplace dans l'onglet (retour, mais aussi après d'autres pages, ou F5), la page le relit puis l'efface : liste et filtres remis **sans requête de liste** ; seules les listes personnelles sont relues (`page=1&limit=1&mine=1`).
- Lecture : `readMarketplaceKeptQuery`, à appeler avant que la page ne s'affiche (le site efface l'entrée en la lisant).

## Vignette d'annonce

_Relevé : captures du 29/09, balisage identique dans tous les onglets._

```
div#marketplace-auction-<id>                           case de la grille
  a.card-frame.block.p-3.w-[172px].md:w-[184px][href="/marketplace/<id>"]
    div.flex.flex-col.items-center.gap-2.5
      span « Vous menez » / « Surenchéri »              (Mes enchères seulement)
      div.overflow-hidden.rounded-2xl > face            (taille sm)
      div.w-full.flex.justify-between                   libellé du prix et montant · « Durée » et compte à rebours
      p.w-full.truncate                                 « Vendu par <pseudo> »
```

- Pastille « Possédée » sur la face (`owned` de l'annonce, `title="Dans ta collection"`, `bg-emerald-600/90`).
- Montant : `current_bid` s'il y a un enchérisseur, sinon `base_amount`. Libellé selon le statut : « Mise actuelle » ou « Mise de départ » (active), « Vendue pour » ou « Achetée pour » (si je suis l'acheteur), « Non vendue », « Annulée ».
- « Durée » (lucide `gavel`) et compte à rebours calculé sur **l'horloge du PC** (`Date.now()`) : ambre sous 5 min, « Terminée » à zéro ; format `2h 27m`, `9m 38s`, `1j 3h`. La fin (`end_at`) se lit dans les props du composant de la vignette (l'annonce entière, même `id`), au dernier rendu : une mise de dernière minute peut la repousser.
- « Vendu par <pseudo> » : le vrai pseudo, même pour ses propres ventes (pas de « Vous »), tel quel ; il peut contenir espaces, `!`, émojis (« Production Prod-Prod »).
- Lecture : `src/site/marketplace/tiles.ts` (`TILE`, `TILE_LINK`, `TILE_FACE`, `findMarketplaceSellers`, `findSiteAuctionTiles`, `findTileDurations`, `readTileEndAt` ; `OWN_TILE`, `OWN_TIME` : vignettes du script au même balisage).

## Page d'une enchère

_Relevé : captures du 29 et du 30/09._

```
main … div.flex.flex-col.md:flex-row.gap-6
  div.flex-shrink-0.flex.flex-col.items-center.gap-2
    face w-72 h-[420px]
    div.space-y-1.5 > button « Signaler l'image » (lucide flag, parfois désactivé)
  div.flex-1.space-y-4
    h1 titre, bouton carré « Vue du marché » (lucide chart-line)
    p « Mis en vente par <span accent>pseudo</span> »
    div.card-frame : « Mise actuelle » / « Mise de départ », p « Meneur : <span>pseudo</span> », temps restant
    div.card-frame.p-4.text-sm « Remportée par <span>pseudo</span> pour <span>n</span> wikibidous. »   (vendue)
div.space-y-3 : h2 « Historique des mises (n) », ul.card-frame > li (span pseudo, span date et montant)
```

- Chargée par `GET /api/marketplace/<id>` (`{ auction, bids }`). Formulaire de mise : `POST /api/marketplace/<id>/bid` ([Règles](#règles-du-marché)) ; les mises des autres arrivent en temps réel.
- « Meneur : » seulement s'il y a une mise. Le texte de son `span` change sur place à chaque mise reçue en temps réel (`auction:<id>`), sans ajout de nœud.
- Historique : pseudo en premier `span` (« Joueur » si la mise n'a pas de pseudo), puis date et montant ; une nouvelle mise est ajoutée en tête. Sans mise : `p` « Aucune mise placée pour l'instant. ».
- « Remportée par » : relevé dans le code du site (30/09).
- Pseudos en simple texte, sans lien.
- Lecture : `src/site/marketplace/auction-page.ts` (`findAuctionPlayers`, `findAuctionReport`), `readAuctionRequest`, `parseAuctionCard`.

## Enchère introuvable

_Relevé : capture du 30/09._

- `GET /api/marketplace/<id>` en 404 : unique enfant de `<main>`, `div.flex-1.p-6.text-center.text-[var(--color-foreground)]/50`, dont le seul contenu est le texte « Enchère introuvable. » (ni icône ni lien, contrairement à « Profil introuvable »), collé en haut.
- Lecture : `findAuctionNotFound` (`src/site/marketplace/not-found.ts`, reconnu à son premier nœud texte).

## Historique des ventes et offre PRO

_Relevé : captures et code du site, 30/09._

- Ventes d'une carte : `GET /api/marketplace/cards/<card_id>/sales`, toutes raretés mélangées (chaque vente porte sa rareté), **sans indication shiny**. **Réservé aux comptes PRO** : erreur de l'API pour les autres (constat de l'utilisateur, 30/09).
- Vue du site : onglet Marché de la modale de carte, bouton « Vue du marché » de la page d'une enchère (graphique « Évolution des prix », « 10 dernières ventes »).
- Sans PRO (`marketViewRequiresPro` du site : tout sauf `is_pro === true`) :
  - ses boutons de marché portent un badge violet (`span.absolute.-top-1.-right-1 … bg-violet-600`, lucide `sparkles`, info-bulle « Vue du marché (PRO) ») ;
  - le clic ne demande aucune vente et ouvre une modale d'offre : « Vue du marché » + titre de la carte, encadré violet (courbe en filigrane) « Vue du marché PRO » et étiquette PRO, « Découvre l’historique des ventes de « … » et fixe le bon prix avant d’acheter ou de vendre. », deux avantages (lucide `trending-up`), « Débloquer avec WikiMasters PRO » (événement `wikimasters:open-pro-upgrade` : la boutique du solde s'ouvre sur l'abonnement), « 9,99 $ CAD / mois · annulable à tout moment ».
- Lecture : `fetchCardSales`, `readSalesRequest`, `src/site/pro.ts`.

## Dans le script

`marketplace-filters`, `marketplace-search`, `marketplace-search-delay`, `marketplace-memory`, `marketplace-tiles`, `marketplace-card-display`, `player-links`, `auction-market`, `auction-report`, `auction-not-found`, `auction-stay`, `market`, `market-search` (dev) ; services `market`, `market-tile`, `listings`. Détail : section « Marché » de [features.md](../features.md).
