# Toutes les cartes (`/global-collection`)

Catalogue de toutes les cartes du jeu (modèles, pas d'exemplaires), 50 par page ; seul endroit du site qui montre la liste de souhaits en entier. Dates en jj/mm (2026). Commun aux listes filtrées : [README](README.md#listes-filtrées). Route : [api.md](../api.md#catalogue-et-liste-de-souhaits).

## Liste

_Relevé : code du site, 30/09._

- Une requête par chargement : `GET /api/cards?page=&q=&rarity=…&sort=[&wishlist=1]` (paramètres dans cet ordre, `page` à partir de 0), total et compteurs compris.
- Recherche (3 caractères au moins) : ni total ni compteurs, `searchHasMore` à la place.
- Requête précédente interrompue (`AbortController`), réponse périmée ignorée.
- Pendant un chargement, une roue (`div.flex.items-center.justify-center.py-16`) **remplace** la grille, sœur du cadre des filtres ; pas de voile.
- **Pages gardées** : chaque réponse est gardée en `sessionStorage` sous `gc_v12_<adresse de la requête>` (`gc_v11_` avant le 10/10 : le numéro change avec les versions du site, qui efface les autres `gc_v…` à l'arrivée). Une page déjà vue dans l'onglet ne redemande rien : elle s'affiche aussitôt. Les pages « Liste de souhaits » ne sont jamais gardées (relues à chaque fois).
- La réponse porte aussi `wishlistCardIds` (cartes de la page dans ma liste de souhaits), ajoutées à l'ensemble de la page, qui ne fait que grandir (une carte retirée ailleurs y reste jusqu'au rechargement).
- Lecture : `src/site/global-collection/list.ts` (`isGlobalCollectionList`, `forgetGlobalCollectionPages`, `forgetGlobalCollectionPagesSoon`).

## Filtres

_Relevé : code et capture du site, 30/09._

- Dans `div.space-y-3`, une ligne `div.flex.flex-col.gap-3.md:flex-row` : rangée du champ (`div.flex.w-full.min-w-0.flex-1.gap-2` : champ « Rechercher par titre ou catégorie... » dans `div.relative` avec sa croix « Effacer la recherche », puis bouton d'accent « Rechercher »), puis la liste « Trier les cartes » (Rareté, Nom, ATK, DEF) dans son `div.relative`.
- Dessous, la rangée des pastilles : « Liste de souhaits » (la première, lucide `bookmark`, active : `ring-2` accent), raretés, « Réinitialiser rareté ».
- **La recherche ne part qu'à Entrée ou « Rechercher »**, désactivé tant que le champ sans ses espaces vaut la recherche en cours. La croix vide le champ et lance aussitôt la recherche vide.
- Tri, raretés, liste de souhaits rechargent aussitôt, en page 0.
- Sous 3 caractères : texte ambre « Saisis au moins 3 caractères… », `q` envoyé quand même.
- Au-dessus des filtres, un `div.card-frame` : compteurs par rareté (pastille de couleur, « L: », nombre) ; pendant une recherche, à la place : « Recherche active : pas de décompte par rareté ni de total exact (évite de parcourir des millions de lignes). » et « Résultats paginés — utilise Suivant / Précédent. ».
- Lecture : `src/site/global-collection/filters.ts` (`globalCollectionList`, `findGlobalCollectionFilters`, `findGlobalCollectionSearchNotice`).

## États de la page

_Relevé : code du site, 30/09 et 10/10._

- Dans l'ordre : cartes, total, suite disponible, compteurs, amis, possédées, liste de souhaits, offres en cours, filtre « Liste de souhaits », erreur, chargement, champ de recherche, **tri, raretés (`Set`), page** (à partir de 0), carte ouverte, (ceux de `useUserId`), mode sélection, cartes cochées (`Set`), requête de la sélection en cours, erreur de la barre, message, recherche en cours.
- La liste se charge dans un effet qui dépend de la page, de la recherche en cours, des raretés, du tri et du filtre : un nouvel ensemble de raretés (mêmes raretés) la recharge telle quelle.
- La page est le premier composant à états au-dessus de la ligne des filtres.
- Amis : `friendOwners` tel quel (`{ <card_id>: [{ id, username }] }`) ; possédées : `Set` de `ownedCardIds` ; liste de souhaits, offres en cours : `Set` (code du 01/10).
- Lecture : `src/site/global-collection/state.ts` (`findGlobalCollectionStates`, `findGlobalCollectionReload`).

## Pastilles des cartes

_Relevé : code du site, 01/10._

- Chaque face de la grille (dans sa case `div.relative.isolate.group` depuis le 10/10, comme la Collection ; avant, la face était la case ; clé React = id de la carte) a, dans l'emplacement du bas ([README](README.md#face-de-carte)), `div.flex.w-fit.max-w-full.flex-col.gap-0.5` › « Possédée » (`ownedCardIds`, `bg-emerald-600/90`, `title="Dans ta collection"`), puis les amis qui l'ont (`friendOwners`) : `span.inline-flex…rounded-full.bg-sky-300/65.text-[9px].text-black/80`, lucide `users` (`size-2.5 shrink-0 opacity-90`), « pseudo +n » (le premier ami, puis le nombre des autres), `title` = tous leurs pseudos séparés par « , ».
- Clic sur la face : modale de carte en vue catalogue (`catalogView`, `friendUsername` du premier ami pour « Proposer un échange »), **sans « Possédée »** (le site ne lui passe pas `ownedCardIds`).
- Lecture : `src/site/global-collection/owners.ts` (`findFriendOwnersPills`, `readFriendOwners` : au clic, `readCatalogOwnedCards`) ; cases et faces de la grille : `src/site/global-collection/grid.ts` (`findGlobalCollectionCards`).

## Mode sélection

_Relevé : code et capture du site, 10/10._

- Nouveau le 10/10, avec les composants de la Collection (`BulkSelectionToolbar`, `SelectionMarker` : [collection.md](collection.md#mode-sélection)). Titre « Collection Globale » et « Toutes les cartes existantes dans le jeu » dans `div.flex.items-start.justify-between`, à droite « Sélectionner » / « Quitter la sélection » (lucide `square-check-big` / `x`), seulement connecté ; « Sélectionner » désactivé tant qu'il n'y a aucune carte. Entrer vide la sélection, l'erreur et le message ; sortir vide la sélection et l'erreur.
- En sélection, un clic sur une carte la coche ou la décoche (rien pendant un chargement ou une requête de la sélection), sans ouvrir sa modale. Dans la case : calque (anneau si cochée), case à cocher en haut à droite, et en haut à gauche un signet (`span.pointer-events-none.absolute.top-1.5.left-1.5.z-30.size-6`, lucide `bookmark` plein, `title="Dans ta liste de souhaits"`) si la carte est dans ma liste.
- Barre du bas : « n cartes sélectionnées », « Tout sélectionner (page) » / « Désélectionner la page », « Retirer des souhaits (n) » (`bookmark-minus` ; n = cartes cochées dans ma liste), « Ajouter aux souhaits (n) » (`bookmark-plus`, accent ; n = celles qui n'y sont pas). Les deux derniers sont désactivés pendant un chargement, pendant leur requête ou à 0.
- Une requête pour toute la sélection ([api.md](../api.md#catalogue-et-liste-de-souhaits)) : réussie, ensemble de la page mis à jour (avec le filtre « Liste de souhaits », les cartes retirées quittent la grille et le total), message « n cartes ajoutées à ta liste de souhaits. » / « … retirées de ta liste de souhaits. » dans un `div.card-frame.p-3` sous le titre (croix « Fermer »), sélection quittée ; refusée : « Impossible d'ajouter ces cartes à la liste de souhaits. » / « Impossible de retirer… » sous la rangée de la barre, sélection gardée.
- La sélection est réduite aux cartes encore affichées après chaque chargement (changer de page la vide).
- Lecture : `src/site/selection` (`findSelectionToggle`, `siteSelectionMode`, `findSelectionBar`, `selectionMarkOf`, `SELECTION_BADGE`).

## Pagination

_Relevé : code du site, 30/09._

- Une barre sous la grille (`div.flex.items-center.justify-center.gap-2.py-4`) : « ← Précédent », « Page x / y » (pendant une recherche : « Page x · suite disponible » ou « Page x »), « Suivant → ».
- Un clic change l'état `page`, puis fait défiler `<main>` tout en haut.

## Liste de souhaits

_Relevé : captures du 29/09, code du 30/09._

- Elle porte sur la carte (modèle), pas sur un exemplaire. Une carte de la liste mise en vente par un autre joueur déclenche la notification `marketplace_wishlist_listed`. Elle sert aussi de filtre dans la fenêtre d'échange (`wishlisted_by`, `wishlisted_by_me`).
- Elle se gère depuis la modale de carte en **vue catalogue** : « Ajouter à / Retirer de la liste de souhaits » ([README](README.md#modale-de-carte)).
- Changement **optimiste** : le bouton change avant la réponse, puis revient en arrière si la requête échoue. Un clic pendant la requête sur la même carte est ignoré.
- Requêtes Supabase directes (`wishlist_items`, [api.md](../api.md#catalogue-et-liste-de-souhaits)). Lecture : `isWishlistChange`, `readWishlistChanges` (une carte, ou toute la sélection).
- Par lot depuis le [mode sélection](#mode-sélection).
- Liste complète : pastille « Liste de souhaits » → `wishlist=1`, 50 cartes par page, combinable avec raretés, recherche et tri ; vide : « Aucune carte dans votre liste de souhaits. ».

## Dans le script

`global-collection-filters`, `global-collection-selection`, `global-collection-selection-key`, `global-collection-search`, `global-collection-search-delay`, `global-collection-pagination`, `global-collection-memory`, `global-collection-friends`, `global-collection-prices`, `global-collection-load-prices`, `global-collection-sales-limit`, `global-collection-card-display` ; `card-modal` (vue catalogue). Détail : section « Toutes les cartes » de [features.md](../features.md).
