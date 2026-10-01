# Toutes les cartes (`/global-collection`)

Catalogue de toutes les cartes du jeu (modèles, pas d'exemplaires), 50 par page ; seul endroit du site qui montre la liste de souhaits en entier. Dates en jj/mm (2026). Commun aux listes filtrées : [README](README.md#listes-filtrées). Route : [api.md](../api.md#catalogue-et-liste-de-souhaits).

## Liste

_Relevé : code du site, 30/09._

- Une requête par chargement : `GET /api/cards?page=&q=&rarity=…&sort=[&wishlist=1]` (paramètres dans cet ordre, `page` à partir de 0), total et compteurs compris.
- Recherche (3 caractères au moins) : ni total ni compteurs, `searchHasMore` à la place.
- Requête précédente interrompue (`AbortController`), réponse périmée ignorée.
- Pendant un chargement, une roue (`div.flex.items-center.justify-center.py-16`) **remplace** la grille, sœur du cadre des filtres ; pas de voile.
- **Pages gardées** : chaque réponse est gardée en `sessionStorage` sous `gc_v11_<adresse de la requête>`. Une page déjà vue dans l'onglet ne redemande rien : elle s'affiche aussitôt. Les pages « Liste de souhaits » ne sont jamais gardées (relues à chaque fois).
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

_Relevé : code du site, 30/09._

- Dans l'ordre : cartes, total, suite disponible, compteurs, amis, possédées, liste de souhaits, offres en cours, filtre « Liste de souhaits », erreur, chargement, champ de recherche, **tri, raretés (`Set`), page** (à partir de 0), carte ouverte, recherche en cours.
- La liste se charge dans un effet qui dépend de la page, de la recherche en cours, des raretés, du tri et du filtre : un nouvel ensemble de raretés (mêmes raretés) la recharge telle quelle.
- La page est le premier composant à états au-dessus de la ligne des filtres.
- Lecture : `src/site/global-collection/state.ts` (`findGlobalCollectionStates`, `findGlobalCollectionReload`).

## Pagination

_Relevé : code du site, 30/09._

- Une barre sous la grille (`div.flex.items-center.justify-center.gap-2.py-4`) : « ← Précédent », « Page x / y » (pendant une recherche : « Page x · suite disponible » ou « Page x »), « Suivant → ».
- Un clic change l'état `page`, puis fait défiler `<main>` tout en haut.

## Liste de souhaits

_Relevé : captures du 29/09, code du 30/09._

- Elle porte sur la carte (modèle), pas sur un exemplaire. Une carte de la liste mise en vente par un autre joueur déclenche la notification `marketplace_wishlist_listed`. Elle sert aussi de filtre dans la fenêtre d'échange (`wishlisted_by`, `wishlisted_by_me`).
- Elle se gère depuis la modale de carte en **vue catalogue** : « Ajouter à / Retirer de la liste de souhaits » ([README](README.md#modale-de-carte)).
- Changement **optimiste** : le bouton change avant la réponse, puis revient en arrière si la requête échoue. Un clic pendant la requête sur la même carte est ignoré.
- Requêtes Supabase directes (`wishlist_items`, [api.md](../api.md#catalogue-et-liste-de-souhaits)). Lecture : `isWishlistChange`.
- Liste complète : pastille « Liste de souhaits » → `wishlist=1`, 50 cartes par page, combinable avec raretés, recherche et tri ; vide : « Aucune carte dans votre liste de souhaits. ».

## Dans le script

`global-collection-filters`, `global-collection-search`, `global-collection-search-delay`, `global-collection-pagination`, `global-collection-memory`, `global-collection-card-display` ; `card-modal` (vue catalogue). Détail : section « Toutes les cartes » de [features.md](../features.md).
