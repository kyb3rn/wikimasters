# Profils (`/profile`, `/profile/<pseudo>`)

Son profil : `/profile` ; celui d'un joueur : `/profile/<pseudo>` (pseudo encodé : il peut contenir espaces, `!`, émojis ; `profilePath`). En-tête, onglets Vitrine (galeries nommées) et Collection (amis seulement). Sur le sien : vitrine modifiable, profil public ou privé. Signaler un joueur. Dates en jj/mm (2026). Routes : [api.md](../api.md#joueurs-amis-vitrine-signalements).

## En-tête de son profil

_Relevé : captures du 29/09._

```
div.card-frame.p-3.sm:p-4.animate-fade-in-up
  div.flex.items-center.gap-3.flex-wrap
    button[title="Modifier la photo de profil"].group.relative.w-12.h-12.rounded-full   ouvre « Photo de profil »
      img.w-full.h-full.object-cover (style object-position) ou span initiales (accent)
      span voile au survol, span pastille (lucide pencil) au survol
    div.flex-1.min-w-0
      h1 pseudo
      p.text-xs › span › span.whitespace-nowrap « 1 416 cartes », span › span.whitespace-nowrap « · Depuis sept. 2026 »
      div.mt-2.flex.flex-wrap.gap-1 › étiquettes : span pastille (couleurs en style) › span nom, span « ×966 »
    div
      span « Visible de tous » / « Amis seulement »
      button[aria-label="Rendre privé" | "Rendre public"]   interrupteur
      span.sm:hidden « Profil public »
div.animate-fade-in-up › div.card-frame.p-4.text-center › « 1 416 » (accent) / « Cartes uniques »   (à part, dessous)
```

- Étiquettes : celles de ses cartes, avec leur nombre (pastilles `text-[11px]`).
- Interrupteur : piste `bg-[var(--color-accent)]` ou `bg-[var(--color-surface-light)]`, bouton `translate-x-5` / `translate-x-0` ; il envoie `PATCH /api/profile/<pseudo>` `{ is_public }`.
- Lecture : `src/site/profile/header.ts` (`findOwnProfileHeader`, `findUniqueCardsStat`, `splitProfileLine`, `isProfileVisibilityChange`).

## Profil d'un autre joueur

_Relevé : captures du 29/09 ; « Retirer des amis » : code du 30/09._

- Ni photo modifiable, ni étiquettes, ni visibilité, ni « Cartes uniques ». « Signaler » et, pour un ami, « Retirer des amis » en haut à droite ; « · Vu il y a … » dans la ligne sous le pseudo.
- « Retirer des amis » : petit bouton `title="Retirer des amis"` (lucide `user-minus` ; « … » et désactivé pendant le retrait). Confirmation par **`window.confirm`** (« Retirer <pseudo> de votre liste d'amis ? »), puis `DELETE /api/friends/<id de l'amitié>` (refus ignoré, rien à l'écran), puis relecture du profil (403 : profil privé → `/friends`).
- Lecture : `src/site/profile/unfriend.ts` (`findUnfriendButton`, `parseUnfriendConfirm`).

## Profil introuvable

_Relevé : capture du 30/09._

- Profil inexistant ou refusé : unique enfant de `<main>`, `div.flex-1.flex.flex-col.items-center.justify-center.gap-4.p-6` › cadenas lucide `lock`, `p` « Profil introuvable », lien « ← Retour aux amis » (`/friends`).
- `<main>` n'étant pas flex, le message reste en haut ([README](README.md#chargement-dune-page)).
- Lecture : `showsProfileNotFound` (`src/site/profile/not-found.ts`, reconnu au cadenas et au lien, pas au texte).

## Collection d'un ami

_Relevé : code du site, 30/09._

- Onglet « Collection » de `/profile/<pseudo>`, amis seulement. Dans `div.space-y-4` : filtres, « n cartes dans la collection de … », roue de chargement, grille, pagination.
- Liste : `GET /api/profile/<pseudo>/collection?page=&sort=&stats=&q=&rarity=…&tag_id=&pending=1`, 50 par page, `page` à partir de 0. `stats=1` en page 0 seulement : total et étiquettes de l'ami ne sont relus que là.
- Filtres (`div.space-y-3`) : ligne `div.flex.flex-col.gap-3.md:flex-row` avec le champ « Rechercher par titre ou catégorie... », puis la rangée des listes « Filtrer par étiquette » (étiquettes de l'ami, s'il en a) et « Trier la collection » (Rareté, Nom, Date d'ajout) ; pastilles de rareté dessous ; texte ambre sous 3 caractères.
- La recherche part **300 ms après la frappe** ; tri, étiquette, raretés rechargent aussitôt, en page 0.
- **Aucune requête interrompue, toute réponse affichée, même périmée.** Une erreur vide la grille (« Le chargement de la collection a échoué… »).
- Pendant un chargement : roue `div.flex.justify-center.py-4` au-dessus de la grille. **Grille vide : roue à la place de tout l'onglet, filtres compris** (le champ disparaît pendant la frappe).
- Grille vide : « Aucune carte avec ces filtres. » ou « Collection vide. » ; une recherche sans résultat affiche « Collection vide. » (le total relu vaut 0).
- Pagination : une barre « ← Précédent · Page x / y · Suivant → », qui fait défiler `<main>` en haut.
- Revenir sur l'onglet recrée la page, aux filtres par défaut.
- États de l'onglet, dans l'ordre : exemplaires, total, étiquettes, cartes en échange, chargement, champ, recherche en cours, **tri, raretés (`Set`), étiquette (`null` ou id), page**, exemplaire ouvert, erreur. La liste se charge dans un effet qui dépend de la page, du tri, de la recherche en cours, des raretés et de l'étiquette.
- La fenêtre d'échange lit la même route, du même ami : seul le profil affiché est la page.
- Lecture : `src/site/profile/collection.ts` (`profileCollectionList` ; états : `findProfileCollectionStates`, `findProfileCollectionReload` ; roue : `PROFILE_COLLECTION_SPINNER`).

## « Choisir une carte » de la vitrine

_Relevé : code du site, 30/09._

- Ouverte par une case « Ajouter » de sa vitrine : portail dans `body` (`fixed inset-0 … backdrop-blur-md`), cadre `w-full max-w-md max-h-[85vh] flex flex-col`. En-tête : `h3` « Choisir une carte », nom de la galerie dessous s'il y en a plusieurs, croix SVG maison.
- `div.px-5.py-3.space-y-3` : champ « Rechercher une carte... » et pastilles de rareté en petit (« Réinitialiser » dès qu'une est cochée). Zone qui défile (`flex-1 overflow-y-auto px-5 pb-5`) : grille `gap-4 py-2`, 20 cartes par page, pagination ← n / total →.
- Liste : `GET /api/my-collection?sort=rarity&q=&rarity=…&page=n&stats=0` (+ `/api/my-collection/stats` en page 0 pour le total), 300 ms après la frappe ; cartes déjà en vitrine retirées.
- Le halo des cartes (`glow-*`) dépasse largement les 8 px laissés au-dessus de la première ligne : la zone qui défile le coupe.
- Choisir une carte : `PUT /api/showcase` `{ position, user_card_id }`, sans attendre la réponse.
- La guilde a sa propre « Choisir une carte » (Annuler / Valider), sans pastilles.
- Lecture : `src/site/profile/card-picker.ts` (`findCardPicker`).

## Dans le script

`profile-header`, `profile-unfriend`, `profile-not-found`, `profile-collection-filters`, `profile-collection-search`, `profile-collection-search-delay`, `profile-collection-pagination`, `profile-card-picker`, `profile-card-display`, `player-links` ; service `friends` (`confirmUnfriend`). Détail : section « Profil » de [features.md](../features.md).
