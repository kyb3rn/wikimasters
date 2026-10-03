# Collection (`/collection`)

Exemplaires possédés, 50 par page. Dates en jj/mm (2026). Commun aux listes filtrées (requêtes, listes déroulantes, pastilles de rareté, pagination, « tirer pour rafraîchir ») : [README](README.md#listes-filtrées). Routes et paramètres : [api.md](../api.md#collection-et-étiquettes).

## Liste et compteurs

_Relevé : captures et code du site, 29/09._

- `GET /api/my-collection` (liste, `stats=0`) et `GET /api/my-collection/stats` (total, compteurs par rareté et par étiquette) partent ensemble : les compteurs juste avant la liste, et en page 0 seulement.
- Grille `div.flex.flex-wrap.justify-center` › `div.relative.isolate.group` › face `sm`, dans l'ordre de la liste. Le composant de la face reçoit `{ card, size, onClick, tags, pendingTradeLabel, topRight }` : `card` est la carte (modèle, avec sa rareté), lue par `readFaceCard` (code du site, 01/10). Un exemplaire mis aux enchères n'est plus dans la liste.
- Premier chargement : rond de page ; le champ, les listes et les pastilles n'apparaissent qu'à la première liste reçue. Ensuite : voile avec roue sur la grille (`div.absolute.inset-0.z-20[aria-busy="true"]`), « Chargement… » dans la pagination, ses boutons désactivés.
- La fenêtre d'échange lit la même route avec `owned_by=<ami>` : ce n'est pas la page ([trades.md](trades.md#chargement-des-cartes)).
- Lecture : `src/site/collection/collection.ts` (`isCollectionList`, `isCollectionStats`, `parseCollection`, `findCollectionFaces`, `LIST_LOADING_VEIL`).

## Filtres

_Relevé : code du site, 29/09._

- Recherche « Rechercher par titre ou catégorie... », prise en compte 300 ms après la frappe, 3 caractères au moins. Champ à 45 px, listes à 42 px ([Champs](README.md#champs-de-saisie)).
- « Filtrer par étiquette » : toutes, « Sans étiquette » (valeur `__untagged__`), `#nom (n)`, « Gérer les étiquettes… » (valeur `__manage_tags__` : ouvre la fenêtre sans toucher au filtre). « Trier la collection » : Rareté, Nom, Favoris, Date d'ajout.
- Pastilles de rareté sous la barre.
- Valeurs de départ en dur (tri Rareté, rien d'autre), rien dans l'adresse ni dans le stockage : chaque visite repart de là.
- Tout changement remet la page à 0 et relance **aussitôt** la liste et ses compteurs.
- L'état « chargement » est posé juste avant la requête, et dessiné au rendu suivant de React (tâche ultérieure).
- Une réponse périmée est ignorée, liste comme compteurs ; des compteurs en échec ne changent rien (`fetchMyCollectionStats` du site rend `null`). Le script s'en sert : une requête remplacée reçoit une réponse 499 inventée, que la page ignore.
- La page s'actualise en entier (étiquettes, échanges, liste) par `onRefresh` de son « tirer pour rafraîchir », appelé aussi après une défausse, une action groupée, la gestion des étiquettes.
- Lecture : `src/site/collection/filters.ts` (`collectionList`, `findCollectionFilters`, `findCollectionRefresh`).

## États de la page

_Relevé : code du site, 29/09._

- Dans l'ordre : exemplaires affichés, total, compteurs des étiquettes (`tagOptions`), étiquettes de l'utilisateur (lues dans Supabase, `null` avant), échanges en cours (`Set`), chargements, recherche, tri, raretés (`Set`), étiquette, « Sans étiquette », page, carte ouverte, mode sélection, cochés (`Set`)…
- La page est le premier composant à états au-dessus de son « tirer pour rafraîchir ».
- Carte ouverte (code du 03/10) : la ligne de la liste (`card` aux valeurs de l'exemplaire, `effectiveCardListItem`) ; la modale reçoit `count` = lignes de la même carte dans la liste affichée. Rien n'est rendu (ni la modale) tant que la première liste n'est pas arrivée : rond de page à la place.
- Une étiquette changée dans la modale de carte met à jour l'exemplaire dans la liste et ajoute une nouvelle étiquette au catalogue, sans rien recharger (les compteurs restent tels quels).
- Piège : une réponse gardée puis resservie à la page (rechargement évité, changement retenu) date d'avant ces changements faits sur place ; resservie telle quelle, elle efface les étiquettes posées depuis.
- Lecture : `src/site/collection/page-state.ts` (`applyTagChange` : même chose pour plusieurs exemplaires, compteurs compris ; `shownCollectionReply` : réponse gardée ramenée aux étiquettes affichées).

## Pagination

_Relevé : code du site, 29/09._

- Une barre au-dessus et une au-dessous de la grille (`div.flex.items-center.justify-center.gap-2.py-3`, dans `div.scroll-mt-4.space-y-3`), seulement quand le total des compteurs donne plus d'une page.
- Le numéro change en texte seul (hors `watchDom`), par exemple quand les compteurs arrivent après la liste. Total inconnu (compteurs en échec) : l'ancien reste.
- Un clic change l'état `page` (à partir de 0 ; les seuls états numériques de la page sont le total et la page), puis fait défiler jusqu'en haut du cadre. La liste part dans l'effet qui suit le rendu, sans les compteurs : un premier rendu montre déjà la nouvelle page, pas encore en chargement.
- Lecture : `src/site/collection/pagination.ts` (`findCollectionPaginationBars`, `findCollectionPageSetter`, `isPageLoading`).

## Après une défausse ou une mise aux enchères

_Relevé : captures du 29/09._

- Depuis la modale de carte, dès la réponse, le site recharge tout : liste et compteurs (mêmes adresses que la liste affichée), échanges en cours, étiquettes, solde (`get_my_profile`).
- Ce rechargement peut échouer (500 relevé) : « Le chargement de la collection a échoué. Réessaie dans un instant. », grille vide.

## Mode sélection

_Relevé : code et captures du site, 29/09 ; case à cocher : 30/09._

- « Sélectionner » / « Quitter la sélection » (lucide `square-check-big` / `x`) à droite du `h1` « Collection », seulement quand le total des compteurs est non nul : il n'apparaît qu'à leur réponse, parfois bien après la liste, jamais s'ils échouent. Entrer ou sortir vide la sélection.
- Le mode lui-même est un état de la page : le booléen juste avant l'ensemble des cochés (`Set`), seul couple de ce genre parmi ses états.
- En sélection, chaque case reçoit après sa face un calque `div.pointer-events-none.absolute.inset-0.z-10` (`transition-all duration-300`) : anneau d'accent `ring-4` si la carte est cochée (il dépasse de la case, donc du voile de chargement au bord de la grille), `bg-black/50` si elle est en échange (pas sélectionnable), sinon transparent ; et une case à cocher dans le coin (`z-30`, [README](README.md#grilles-de-cartes)). Le clic de la carte est sur sa face (`onClick`).
- Barre fixe en bas (portail `div.fixed.bottom-4.z-[80] … card-frame`, calée sur la largeur du contenu) : « n cartes sélectionnées » (« Actualisation… » avec une roue pendant un chargement), « Tout sélectionner (page) » / « Désélectionner la page » (`square-check-big` / `square`), « Étiqueter », « Retirer l'étiquette » (deux lucide `tag`), « Défausser (+n) » (`trash-2`, rouge) ; sous la rangée, l'erreur de la dernière défausse. Tout est désactivé pendant un chargement.
- La sélection est vidée à chaque changement de filtre ou de page, et réduite aux cartes encore affichées après un rechargement.
- Lecture : `src/site/collection/selection.ts` (`findSelectionToggle`, `findSelectionState`, `findSelectionMode`, `findSelectionBar`, `selectionMarkOf`).

### Étiqueter, Retirer l'étiquette

- Modale « Appliquer une étiquette » / « Retirer une étiquette » (portail `div.fixed.inset-0.z-[60]`, cadre `card-frame … max-w-md`, croix ronde) : champ « Chercher ou créer une étiquette… », un bouton par étiquette (clé React = id de l'étiquette ; en retrait, seulement celles des cartes sélectionnées, avec leur nombre), ligne « Créer » + sélecteur de couleur quand le nom tapé n'existe pas. Les exemplaires sélectionnés sont dans ses props.
- Un clic sur une étiquette l'applique (`upsert`) ou la retire **aussitôt**, à toute la sélection : écran « n cartes étiquetées » + « Terminé », message au-dessus de la grille, actualisation complète de la page.
- En « Sans étiquette », les cartes étiquetées disparaissent aussitôt : impossible d'en poser une deuxième.
- Requêtes : [api.md](../api.md#collection-et-étiquettes). Lecture : `findBulkTagModal`.

### Défausser (+n)

- Confirmation (portail `div.fixed.inset-0.z-[90]`, cadre `card-frame max-w-sm`) : « Défausser n cartes ? », raretés, avertissement pour les L, UR, SR, titres, gain ; « Annuler » · « Défausser » (rouge, « … » pendant l'envoi). Le fond la ferme, sauf pendant l'envoi.
- `POST /api/user-cards/bulk-discard` `{ card_ids }` : un exemplaire de chaque carte.
- Réussie : fermée, message au-dessus de la grille, sélection vidée, solde et page actualisés. Refusée : reste ouverte avec l'erreur (« Erreur lors de la défausse », « Erreur réseau »…).
- Lecture : `findBulkDiscardConfirm`, `isBulkDiscard`, `readBulkDiscard`, `readBulkDiscardFailures` (forme des éléments de `failed` inconnue : le site n'en lit que le nombre).

## Gérer les étiquettes

_Relevé : code du site, 29/09 ; aucune capture._

- Ouverte par l'option « Gérer les étiquettes… », la dernière de la liste des étiquettes : le `onChange` de la page reçoit `__manage_tags__`.
- Portail `div.fixed.inset-0.z-[90] … bg-black/70 p-4`, cadre `card-frame-solid relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden`, croix ronde dans le coin, en-tête `h2` « Gérer les étiquettes ».
- Création : sélecteur de couleur, « Nouvelle étiquette… », « Créer ».
- Liste défilante (`min-h-0 flex-1 overflow-y-auto`), par étiquette `div.rounded-xl.border.p-3` › `div.flex.items-center.gap-2.min-w-0` › pastille, nom (`min-w-0 truncate`), « n carte(s) » (`text-xs`, coupé sur deux lignes quand le nom est long), Couleur · Renommer · Supprimer (`ml-auto`) ; sous la ligne, l'éditeur de couleur (code hexadécimal, « Appliquer ») ou de nom.
- Suppression confirmée par `window.confirm`.
- Lecture : `src/site/collection/tag-manager.ts` (`findTagManager`, `tagManagerOpener`, `findManageTagsOption`).

## Étiquettes

_Relevé : code du site, 29/09._

- Table `tags` : nom de 48 caractères au plus, unique par joueur (`23505` sinon), couleur `#rrggbb` ; une nouvelle reçoit une couleur tirée au hasard d'une palette.
- Pastille `rounded-full border` teintée de sa couleur (`tagChipSurfaceStyles` du site). Noms comparés sans accents ni casse, espaces réduits (`normalizeCardSearchText` du site).
- Lecture : `src/site/collection/tags.ts` (`TAG_PALETTE`, `TAG_NAME_MAX`, `randomTagColor`, `tagChipStyle`, `normalizeTagName`), `src/site/api/tags.ts`.

## Dans le script

`collection-filters`, `collection-search`, `collection-search-delay`, `collection-memory`, `collection-pagination`, `collection-selection`, `collection-selection-key`, `collection-bulk-tags`, `collection-prices`, `collection-stay`, `tag-manager`, `collection-card-display`. Détail : section « Collection » de [features.md](../features.md).
