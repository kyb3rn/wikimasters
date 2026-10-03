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
- Lecture : `src/site/profile/header.ts` (`findProfileHeader`, `findUniqueCardsStat`, `splitProfileLine`, `isProfileVisibilityChange`).

## Profil d'un autre joueur

_Relevé : captures du 01/10 (un ami, un non-ami) ; code du 01/10._

```
div.flex-1.p-4.md:p-6.space-y-5
  a « ← Amis » (href /friends)                    selon ?from= : « ← Classement » (/leaderboard), « ← Guilde » (/guild)
  div.card-frame.p-3.sm:p-4.animate-fade-in-up    même composant que l'en-tête de son profil
    div.-mt-0.5.mb-1.flex.justify-end
      button[title="Signaler <pseudo>"] (lucide flag) « Signaler »                     non-ami
      div.flex.items-center.gap-1 › « Signaler », button[title="Retirer des amis"]     ami
    div.flex.items-center.gap-3.flex-wrap
      div.w-12.h-12.rounded-full… › img (style object-position) ou span initiales      pas un bouton
      div.flex-1.min-w-0 › h1 pseudo, p « 45 583 cartes · Depuis août 2026 · Vu il y a 10 min »
  ami : div.flex.border-b (onglets Vitrine / Collection)
  non-ami : div.animate-fade-in-up › button.w-full « + Envoyer une demande d'ami » (« Envoi... » pendant l'envoi),
            ou div.card-frame.p-4 « Demande d'ami envoyée » / « <pseudo> vous a envoyé une demande d'ami » + Accepter, Refuser
  vitrine (div.card-frame…)
```

- Le site ne passe que `cardCount`, `joinedAt` et, pour un ami, `lastSeenAt` : ni photo modifiable, ni étiquettes (toujours vides), ni visibilité, ni « Cartes uniques » (`/api/profile/<pseudo>/stats` ne rend que `{ total }`).
- « Vu il y a » : « En ligne récemment » sous 5 min, puis `n min`, `n h`, `n j`, `n mois`, « plus d'un an ». Photo sensible (réglage du joueur) : floue (`filter: blur(8px)` et `scale(1.25)` dans son style, `alt` vide).
- « Signaler » : absent si on n'est pas connecté ou sur son propre pseudo ; ouvre la fenêtre de signalement, rendue hors de l'en-tête.
- « Retirer des amis » : petit bouton `title="Retirer des amis"` (lucide `user-minus` ; « … » et désactivé pendant le retrait). Confirmation par **`window.confirm`** (« Retirer <pseudo> de votre liste d'amis ? »), puis `DELETE /api/friends/<id de l'amitié>` (refus ignoré, rien à l'écran), puis relecture du profil (403 : profil privé → `/friends`).
- Ni bouton d'échange (seulement « Proposer un échange » dans la modale d'un exemplaire de l'ami, qui y charge la fenêtre d'échange : [trades.md](trades.md#ouverte-par-le-script)) ni bouton de message : le script ajoute les deux. La page n'a pas le code de la conversation ([dms.md](dms.md#ouverte-par-le-script)).
- Code chargé (captures du 30/09) : la page du profil et un morceau commun ; ni la conversation (morceaux de /dms, de la page Amis), ni la fenêtre d'échange (morceau à part, chargé par la modale d'un exemplaire).
- État de la page (code du 01/10) : `profile` de `GET /api/profile/<pseudo>` (`{ id, username, avatar_url, avatar_pos_x, avatar_pos_y, created_at, … }`), `isFriend`, `friendshipId`, `pendingRequest`, `lastSeenAt`. L'en-tête du site ne reçoit pas l'`id` du joueur : `readProfilePlayer` le lit dans cet état.
- Compte suspendu (`banned`) : page « Compte suspendu » (icône lucide `ban`) avec le lien de retour.
- Demande d'ami : « Envoyer » désactivé (« Envoi... ») pendant `POST /api/friends` `{ addressee_id }`, rien d'affiché si refusée ; Accepter / Refuser (`PATCH /api/friends/<id>` `{ action }`) jamais désactivés, et l'état change même si la requête échoue (acceptée : ami, onglets, mais pas de « Vu il y a » avant un rechargement).
- Lecture : `src/site/profile/header.ts` (`findProfileHeader`, `actions`, `seen`, `readProfilePlayer`), `src/site/profile/friend-request.ts` (`findProfileFriendRequest`), `src/site/profile/unfriend.ts` (`findUnfriendButton`, `parseUnfriendConfirm`).

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
- Grille `div.flex.flex-wrap.justify-center` : une case `div.relative` par exemplaire (clé React = son `id`) › face (`card`, `tags`, « Échange en attente »). Exemplaires gardés tels que l'API les donne : chacun a `owned_by_viewer` (je possède aussi la carte), que le site n'affiche pas ici (seulement dans la fenêtre d'échange, « Possédée »).
- Clic sur une carte : modale de carte de l'exemplaire (cas « exemplaire d'un ami » : ses étiquettes en lecture seule, « Proposer un échange »), sans actions ni « Possédée » ([README](README.md#modale-de-carte)).
- La fenêtre d'échange lit la même route, du même ami : seul le profil affiché est la page.
- Lecture : `src/site/profile/collection.ts` (`profileCollectionList` ; états : `findProfileCollectionStates`, `findProfileCollectionReload` ; roue : `PROFILE_COLLECTION_SPINNER` ; cartes : `findProfileCollectionFaces`, `readProfileOwnedCards`).

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
