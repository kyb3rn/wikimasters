# Le site wiki-masters.com

Ce qu'il faut savoir du site pour écrire ou réparer le script : comportements, balisage utile, états React, requêtes, temps réel, pièges. Relevé sur les captures (`test/fixtures/captures/`, hors git) et le code JavaScript du site, de septembre à octobre 2026 (dates en jj/mm, sous chaque titre). Le site change : revérifier une information datée (capture récente) avant de s'en servir. Pour les sélecteurs, le code de `src/site/` fait foi.

Routes et données : [`../api.md`](../api.md). Anciens relevés, plus détaillés sur le balisage mais à revérifier : `../old/docs/site.md` et `../old/docs/api.md` (hors du dépôt, 18 au 25/09).

| Fichier | Contenu |
|---|---|
| README.md (ici) | règles, stack, pages, joueur connecté, cartes et raretés, face, grilles, modale de carte, mise aux enchères, défausse, listes filtrées, temps réel, modales, champs, boutons, onglets, en-tête et cloche |
| [pulls.md](pulls.md) | Paquets `/pulls` : ouverture, pack PRO, vérification humaine, carrousel, sons |
| [collection.md](collection.md) | Collection `/collection` : filtres, pagination, sélection, étiquettes |
| [global-collection.md](global-collection.md) | Toutes les cartes `/global-collection`, liste de souhaits |
| [marketplace.md](marketplace.md) | Marché `/marketplace`, page d'une enchère, historique des ventes et offre PRO |
| [profile.md](profile.md) | Profils, collection d'un ami, « Choisir une carte » de la vitrine |
| [friends.md](friends.md) | Amis `/friends` |
| [trades.md](trades.md) | Échanges `/trades`, fenêtre d'échange, « Choisir un ami » |
| [dms.md](dms.md) | Messages `/dms`, conversation privée |
| [guild.md](guild.md) | Guilde `/guild` : en-tête, liste de souhaits, chat, création |

## Règles pour le script

- **Aucune automatisation d'action** (mise, ouverture, défausse en série, échanges) : une action = un geste de l'utilisateur. Le site a une garde anti-automatisation (`403 automation_limit` au-delà de 50 annonces par page), une vérification humaine des paquets ([pulls.md](pulls.md#vérification-humaine)), et le profil porte `cheat_strikes`, `last_sanction_*`, `activity_blocked_until`.
- **Site peu fiable, surtout en journée** (constat de l'utilisateur) : 403, 404, 500 fréquents, réponses de 0,3 à 18 s, temps réel coupé plusieurs minutes. Exemple du 29/09 : deux défausses en 500, non appliquées (la même, renvoyée 1 à 2 s plus tard, a réussi), `sales?scope=summary` en 500. Tout code réseau prévoit l'échec, la lenteur et la coupure : ne jamais supposer qu'une requête ou une diffusion arrive.
- **Une partie des données n'arrive que par le temps réel** (surenchère, solde, notification) : rien dans `fetch` ([Temps réel](#temps-réel)).
- **Carte ≠ exemplaire**, **rareté par les données**, jamais par les classes CSS ([Cartes](#cartes-raretés-identifiants)).
- **Horloge du PC parfois décalée** : calculer les temps restants avec l'en-tête `Date` des réponses. Le site, lui, compte sur l'horloge du PC (comptes à rebours du marché, jour du pack PRO).
- **Navigation Next.js** : la page suivante est chargée (requête RSC) **avant** `pushState`.
- **`<html>` et `<body>` sont rendus par React** : une classe posée dessus est effacée (constaté le 30/09). Un conteneur posé dans `<body>` pendant le chargement est retiré quand React y affiche la page.
- **Le code JavaScript du site se lit** (chunks `/_next/static/chunks/…?dpl=dpl_…`, minifiés mais clairs, renommés à chaque déploiement) : y chercher les paramètres réels d'une route plutôt que deviner.
- **Ne jamais toucher à la boutique ni aux paiements.**

## Stack

_Relevé : 29/09 (`card-frame` : 30/09)._

- **Next.js App Router** (Vercel) : navigation sans rechargement (`history.pushState`), chaque page chargée par `GET /<page>?_rsc=…` avant le changement d'adresse. Le site navigue par `router.push(…)` du routeur de `useRouter()`, trouvé dans l'état React (`src/site/router.ts` : `guardRouterPush`, `navigateTo`).
- **React** : props et états lisibles par `__reactFiber$…` ; la plupart des données passent aussi par des routes `/api/…` lisibles dans le réseau.
- **Tailwind v4** : ses utilitaires sont dans `@layer utilities`, une règle hors couche l'emporte sans `!important`. Icônes **lucide** (`svg.lucide-<nom>`, presque partout), polices Outfit (titres) et Inter.
- **`card-frame`**, cadre de presque tous les panneaux : `backdrop-filter: blur(14px)`, fond `#131615e0`, bordure `1px solid #c8d0cb1f`, `border-radius: 16px` ; thème clair (`html.light`) : fond `#f7f8f7eb`, bordure `#0f172a14`. Il existe aussi `card-frame-solid` (Gérer les étiquettes).
- **Supabase** : REST (`/rest/v1/…`), RPC (`/rest/v1/rpc/…`), authentification (`/auth/v1/…`), Realtime (WebSocket). Le client du site y envoie la clé publique et le jeton de session ([api.md](../api.md#conventions)).
- PWA installable (« Banner not shown » en console : normal). Sons en Web Audio ([pulls.md](pulls.md#sons)).

## Pages

_Relevé : 29/09 (guilde : 01/10)._

Menu : Paquets, Collection, Échanges, Marché, Profil, Toutes les cartes, Guilde, Amis, Messages, Bataille, Succès, Classement, Paramètres. Pas d'accueil à part : c'est `/pulls`. Routes utilisées par le script : `src/site/routes.ts`.

| Page | Adresse | Fichier |
|---|---|---|
| Paquets | `/pulls` | [pulls.md](pulls.md) |
| Collection | `/collection` | [collection.md](collection.md) |
| Toutes les cartes | `/global-collection` | [global-collection.md](global-collection.md) |
| Marché, page d'une enchère | `/marketplace`, `/marketplace/<auctionId>` | [marketplace.md](marketplace.md) |
| Profil | `/profile` (le sien), `/profile/<pseudo>` | [profile.md](profile.md) |
| Amis | `/friends` | [friends.md](friends.md) |
| Échanges | `/trades` (la fenêtre d'échange s'ouvre aussi ailleurs) | [trades.md](trades.md) |
| Messages | `/dms` | [dms.md](dms.md) |
| Guilde | `/guild` | [guild.md](guild.md) |
| Bataille | `/battle`, `/battle/<id>`, `/battle/duels/<id>` (pages ouvertes par les notifications) | non relevée |
| Boutique | modale du bouton du solde | « Acheter des WikiBidous » (2 500 WB à 4,99 $, 5 000 WB à 8,99 $…) : paiement réel, ne jamais y toucher |

Non relevées en détail : Bataille et Succès (captures du 29/09 : leurs modales seulement, voir [Modales](#modales)), Paramètres, Classement (en maintenance le 29/09). Les capturer quand une fonctionnalité en a besoin.

### Chargement d'une page

_Relevé : code du site, 29/09._

- Tant que ses données manquent, chaque page (Paquets, Collection, Marché, page d'une enchère, Échanges, Amis, profils) rend à la place de son contenu un rond, unique enfant de `<main>` : `div.flex-1.flex.items-center.justify-center` › `div.w-8.h-8.border-2.border-[var(--color-accent)].border-t-transparent.rounded-full.animate-spin`.
- `<main>`, commun à toutes les pages (`min-h-0 flex-1 overflow-y-auto`), **n'est pas flex** : ce rond, comme « Profil introuvable » et « Enchère introuvable », reste collé en haut, centré en largeur seulement.
- Les listes et les fenêtres ont leurs propres ronds (`flex justify-center py-12`, `fixed inset-0 …`).
- Lecture : `src/site/page-spinner.ts` (`soleMainChild`, `showsPageSpinner`).

### Adresse inconnue

_Relevé : capture de `/wm-ui`, 30/09._

Page 404 de Next.js (« 404 · This page could not be found. »), rendue dans la mise en page commune (feuilles de style, variables du thème, polices) sans rien d'autre : ni en-tête, ni solde, ni `<main>`, aucune requête. Son `<style>` force le fond du `body` (blanc, noir en thème sombre). Le script y pose sa vitrine (`showcase`, dev seulement).

## Joueur connecté et compte PRO

_Relevé : code du site, 30/09._

- Le pseudo du joueur connecté n'est affiché en entier nulle part (son lien de profil est `/profile`, « Moi » dans les échanges). Il arrive dans son profil (`rpc/sync_profile_packs`, `rpc/get_my_profile` : `id`, `username`…) et dans ses amitiés (`GET /api/friends`). Son id est le `sub` du jeton de session. Lecture : `src/site/me.ts` (`myUsername`), `supabaseUserId`.
- Compte PRO : `profiles.is_pro`, demandé par `GET SB /rest/v1/profiles?select=is_pro&id=eq.<uid>` (gardé 5 min, relu au retour sur l'onglet), reçu aussi de `get_my_profile`, `sync_profile_packs` et du résumé des ventes (`isPro`). Chaque changement est annoncé par l'événement `wikimasters:is-pro-changed` (`detail` : booléen).
- Réservé aux comptes PRO : ventes d'une carte ([marketplace.md](marketplace.md#historique-des-ventes-et-offre-pro)), pack PRO du jour, 10 ventes simultanées au lieu de 5. L'événement `wikimasters:open-pro-upgrade` ouvre la boutique sur l'abonnement.
- Lecture : `src/site/pro.ts` (`proStatus`, `onProStatusChange`, `openProUpgrade`).

## Cartes, raretés, identifiants

_Relevé : 29/09._

- Raretés, de la plus basse à la plus haute, selon les vues mensuelles de l'article Wikipédia : **C** commune (< 50), **PC** peu commune (50+), **R** rare (250+), **SR** super rare (1 000+), **UR** ultra rare (5 000+), **L** légendaire (20 000+). Ordre du site (filtres, tris) : L UR SR R PC C. Couleur : `var(--color-rarity-<c|pc|r|sr|ur|l>)`. Lecture : `src/site/rarity.ts`.
- Les vues évoluent : une carte sortie L un jour peut sortir UR le lendemain. Une même carte a donc des ventes à plusieurs raretés (chaque vente garde la sienne).
- **La rareté n'est pas figée sur l'exemplaire** (constat de l'utilisateur, 29/09) : une L mise aux enchères qui revient (invendue, retirée) alors que ses vues ont baissé peut revenir en UR. Un exemplaire qui passe par le marché **perd aussi ses étiquettes**. Seules l'annonce et la vente gardent la rareté du moment (`snapshot_rarity`, `rarity`).
- **Shiny** (`is_shiny`, vu sur des L) : autre visuel ([Face de carte](#face-de-carte)), sans la classe `glow-l`. **Repérer les raretés par les données, jamais par les classes `glow-*`.** Valeur très supérieure (Olympique lyonnais : 29 000 en shiny, 5 000 en L normale).
- Deux identifiants à ne pas confondre : la **carte** (modèle commun à tous, `cards.id`, `card_id`) et l'**exemplaire** (carte possédée, `user_cards.id`, `user_card_id`). Le favori et la liste de souhaits portent sur la carte ; les étiquettes, la défausse, la mise aux enchères sur un exemplaire. Piège : `POST /api/marketplace` attend l'exemplaire dans un champ nommé `card_id`.

## Face de carte

_Relevé : captures du 29/09 ; cadrage de l'image : code du 01/10._

Composant commun, le même partout ; seule la taille change : `lg` `w-72 h-[420px]` (modale de carte, carrousel, page d'une enchère), `sm` dans les grilles (`w-[clamp(8.4rem,43vw,10rem)] h-[clamp(11.8rem,60vw,14rem)]`, 160 × 224 px sur ordinateur, `hover:scale-105`), `w-28 h-40` (mise aux enchères).

```
div[class*="glow-"].relative.rounded-2xl.overflow-hidden     face (onClick : modale de carte)
  div.absolute.top-0.left-0.right-0.h-[45%].z-20             image (dégradé noir en bas)
  div.absolute.top-2.left-2                                  badge de rareté
  div.absolute.top-[45%].bottom-0.flex.flex-col.p-3.z-20     texte
    h3 (nom) · p (description)
    div.mt-auto.flex.flex-col.pt-1
      div.flex.flex-wrap.pb-0.5                              étiquettes (Collection, Échanges)
      div.flex.justify-between.border-t.pt-1.py-1            ATK · DEF (lucide swords, shield)
```

- Halo `glow-<rareté>` : ombres floues de 10 px (C) à 28 px (L), 30 px en shiny.
- Shiny : `glow-shiny shiny-card` au lieu de `glow-l`, fond `/shiny/onyx-art.webp` et couches `shiny-onyx-*`, reflet qui suit la souris (`--shiny-mx`, `--shiny-my`, classe `shiny-hover`, inclinaison), badge « L✦ » (`shiny-badge`), texte blanc.
- Étoile du favori (modale, grille de la Collection, carrousel) : « Ajouter aux favoris » (contour, `text-amber-200/65`) ou « Retirer des favoris » (remplie, `fill="currentColor"`, `text-amber-200`).
- Image (`loading="lazy"`, `crossOrigin="anonymous"`), cadrage choisi à son chargement : transparente (réduite à 96 px au plus sur un canevas, un pixel non opaque suffit) : `object-contain object-center`, `transform: scale(0.9)` ; sinon portrait (`naturalHeight >= naturalWidth`) : `object-cover`, `object-position: center 28%` ; sinon `object-cover object-center` (aussi avant le chargement). Image en erreur : vignette de remplacement. Reproduit par `src/features/market-search/face-image.ts`.
- Lecture : `src/site/cards/face.ts` (`FACE`, `SMALL_FACE`, `FACE_TEXT`, `FACE_STATS`, `findFaceImage`, `cloneSiteFace`), `findStarButton`.

## Grilles de cartes

_Relevé : captures du 29/09 ; case à cocher : code du 30/09._

Rangée `flex flex-wrap justify-center` dont chaque enfant est une case contenant une face `sm`. La grande face (modale de carte, carrousel) n'est dans aucune rangée `flex-wrap`.

| Page | Rangée | Case |
|---|---|---|
| Collection | `gap-3 sm:gap-[22px] md:gap-[26px]` | `div.relative.isolate.group` › face (+ calque et case à cocher en sélection) |
| Toutes les cartes | idem | la face elle-même |
| Profils (vitrines de 4 cases, collection d'un ami) | idem | `div.relative` › face |
| « Choisir une carte » de la vitrine (modale) | `gap-4 py-2` | non relevée |
| Liste de souhaits de guilde (01/10) | idem que la Collection | `div.flex.flex-col.items-center.gap-1.5 > div.relative.rounded-xl` › face ([guild.md](guild.md#accueil-liste-de-souhaits)) |
| Marché (tous les onglets) | `gap-4 md:gap-5` | vignette `div#marketplace-auction-<id>` ([marketplace.md](marketplace.md#vignette-dannonce)) |
| Fenêtre d'échange (cartes à choisir) | `grid grid-cols-2 gap-1.5` sous 500 px, sinon `flex flex-wrap gap-3` | `button` › face forcée à `10rem × 14rem` |

- « Retirer de la vitrine » (son profil) : bouton `absolute -top-2 -right-2 z-30 w-6 h-6 rounded-full`, à côté de la face dans sa case, en débord sur son coin (centre à 4 px du coin). La face grandit au survol, pas lui.
- Case à cocher du mode sélection (Collection) : `span.pointer-events-none.absolute.top-1.5.right-1.5.size-6`, à 6 px du coin ; même comportement au survol.
- Lecture : `src/site/cards/grid.ts` (`findCardGrids`), `FACE_CORNER_BUTTON`, `FACE_SELECTION_BOX`.

## Modale de carte

_Relevé : captures du 29/09 ; état React et vue catalogue : 30/09._

Ouverte au clic sur une carte (paquet, Collection, Toutes les cartes, profils…), portail dans `body` :

```
div.fixed.inset-0.z-50 … bg-black/70 (fond)
  div.card-frame (cadre)
    button[aria-label=Fermer]
    div.flex.flex-col.md:flex-row
      colonne gauche : face (« Ajouter aux favoris » en haut à droite)
      colonne droite : h2 titre, ligne « rareté en toutes lettres · onglets Détails / Marché »,
                       description, « Étiquettes » (champ « Ajouter une étiquette… »), ATK / DEF,
                       Q-Score, exemplaires, vues (30 j), lien Wikipédia, bloc « Signaler l'image » (lucide flag)
    div.mt-3 > div.flex (rangée d'actions) : « Mettre aux enchères » (marteau), « Défausser » (corbeille, « +1 »)
```

- Badge de rareté : fond `var(--color-rarity-…)`, texte blanc sur C, foncé ailleurs (`rarityBadgeStyle`). Onglets : petit sélecteur `role="tablist"` (Détails · Marché · Toile).
- ATK / DEF de la colonne de droite : `div.grid.grid-cols-2`, deux `div.card-frame` aux icônes `swords` / `shield`, déjà écrits sur la face.
- Étiquettes de l'exemplaire associé, chacune avec un bouton « Retirer l'étiquette <nom> ». Favori sur la carte (tous ses exemplaires), étiquettes sur l'exemplaire : requêtes Supabase directes ([api.md](../api.md#collection-et-étiquettes) ; `readStarChange`, `readTagAdded`, `readTagRemoved`).
- Actions seulement si la carte a un exemplaire associé et pas d'offre d'échange en cours (sinon « Carte réservée dans un échange »).
- À l'ouverture, `GET /api/marketplace/mine` : limite d'enchères atteinte, « Mettre aux enchères » est désactivé (info-bulle « Maximum n enchères actives », texte « Enchères actives : n/max — annulez une vente… »).
- Onglet Marché : vue du site (`GET /api/marketplace/cards/<card_id>/sales`), badge « PRO » sans compte PRO ([marketplace.md](marketplace.md#historique-des-ventes-et-offre-pro)).
- **État React** : le composant reçoit `{ card, starred, count, onClose, userCardId, tags, tagsCatalog, … }` (`card` : `id`, `wikipedia_title`, `rarity`…) et rend lui-même son fond (`createPortal`). Pas de fermeture par Échap.
- **Vue catalogue** (Toutes les cartes) : même modale sans exemplaire, donc ni favori, ni étiquettes, ni rangée d'actions. Dans la colonne de droite, bloc `div.space-y-2 > div.space-y-1.5 > (bouton, p d'aide)` : « Ajouter à la liste de souhaits » (pleine largeur, fond accent léger, « Recevez une alerte si cette carte est mise en vente. » dessous) ou « Retirer de la liste de souhaits » (bordure accent, sans le texte), lucide `bell`. Au-dessus, « Proposer un échange » si un ami possède la carte, ou « Échange en attente » (lucide `refresh-cw`, ambre) si une offre est déjà en cours avec lui. Comportement : [global-collection.md](global-collection.md#liste-de-souhaits).
- Lecture : `src/site/cards/modal.ts` (`findCardModals`, `readModalCard` : à lire au clic, c'est un parcours de l'arbre React), `src/site/cards/actions.ts`.

### Mise aux enchères

_Relevé : code du site, 29/09._

Modale ouverte par « Mettre aux enchères », par-dessus la modale de carte :

```
div.fixed.inset-0.z-[60] (fond, un clic ferme)
  div.card-frame
    button[aria-label=Fermer]
    h2 « Mettre aux enchères », « Un exemplaire sera mis en réserve… »,
      « Enchères actives : n/max » (seulement une fois GET /api/marketplace/mine revenu)
    petite face (w-28 h-40) et résumé du marché
    « Mise de départ » : Diminuer · input[aria-label="Mise de départ"] (10 au départ) · Augmenter
    « Durée » : 10 min · 30 min · 1 h (défaut) · 3 h · 6 h · 12 h (l'active : bg-[var(--color-accent)])
    p.text-red-500 : erreur (message de la réponse, « Erreur réseau »…)
    « Annuler » · « Lancer l'enchère » (« Mise en vente… » pendant l'envoi ; désactivé pendant l'envoi,
      mise invalide ou limite atteinte)
```

- Tout l'état (mise, durée, envoi, erreur) vit dans React ; le champ de la mise est contrôlé par React.
- Composant chargé à la première ouverture : en attendant, une roue (`div.fixed.inset-0.z-[60]` sans `h2`) est rendue **dans** la modale de carte. La vraie modale est un portail dans `body`, sœur de la modale de carte ; fermer la modale de carte la fait disparaître.
- Envoi : `POST /api/marketplace` `{ card_id: <exemplaire>, base_amount, duration_minutes }`. Réussite : le rappel `onListed` de la modale de carte ferme la modale d'enchère, puis `router.push('/marketplace/<id>')`.
- Lecture : `src/site/cards/auction-modal.ts` (`findAuctionModal`, `parseDuration`), `readAuctionCreation`.

### Défausse

_Relevé : capture et code du site, 29/09._

- « Défausser » ouvre une confirmation `div.fixed.inset-0.z-[70]` rendue **dans** le fond de la modale de carte : `div.card-frame` › `h3` « Défausser cette carte ? », « C'est votre dernière copie — elle sera retirée définitivement », « Vous recevrez 1 wikibidou », « Annuler » · « Défausser » (rouge).
- « Défausser » envoie `POST /api/user-cards/<exemplaire>/discard` (`{ balance }`, +1 wikibidou ; 409 si l'exemplaire n'existe plus). Pendant la requête : les deux boutons désactivés, « Défausser » devient « … ».
- Refus : message du site en `p.text-red-500` dans la confirmation (« Erreur réseau » sans réponse), boutons réactivés après lecture de la réponse.
- Réussite : le site ferme la confirmation et la modale de carte **dans le même rendu** (la modale retirée contient encore la confirmation).
- La page garde en mémoire l'exemplaire associé à chaque carte : après une défausse faite hors de sa modale, défausser la même carte par la modale donnerait un 409 ([pulls.md](pulls.md#exemplaire-de-chaque-carte)).
- Lecture : `src/site/cards/discard-confirm.ts` (`findDiscardConfirm`), `readDiscard`, `discardUserCard`.

## Listes filtrées

_Relevé : code du site, 29 et 30/09._

Ce qui est commun à la Collection, Toutes les cartes, au Marché et à la collection d'un ami ; le détail de chacune est dans son fichier.

- **Requêtes** : `sort=`, `q=` (recherche), `rarity=` répété (une fois par rareté cochée), `page=`, plus les filtres propres à la page. `page` commence à 0, sauf au Marché (1). Lecture : `src/site/list-query.ts`.
- **Recherche** : la Collection, la collection d'un ami et « Choisir une carte » la lancent d'elles-mêmes 300 ms après la frappe (`SITE_TYPING_DELAY`) ; Toutes les cartes et le Marché seulement à Entrée ou par leur bouton « Rechercher ».
- **Filtres, page et liste sont des états React de la page** (`useState`). Toutes les cartes, la collection d'un ami et la fenêtre d'échange chargent leur liste dans un effet qui dépend des filtres ; les raretés cochées y sont un `Set` : un nouvel ensemble de même contenu relance l'effet, la liste est rechargée telle quelle (`renewSet`).
- **« Tirer pour rafraîchir »** (Collection, Marché) : composant qui entoure la page, dont le rappel `onRefresh` l'actualise avec ses filtres tels qu'ils sont. La page est le premier composant à états au-dessus de lui. Lecture : `src/site/list-page.ts` (`refreshAbove`, `statesAboveRefresh`, `uniqueStateRun`).
- **Réponses périmées** : chaque page a sa règle (ignorées, interrompues, ou toutes affichées) : voir son fichier. Le script en dépend pour retenir ou retarder une requête.
- **Pastilles de rareté** (composant commun : Collection, Toutes les cartes, Marché ; en petit, `px-2.5 py-0.5 text-[11px]`, dans « Choisir une carte » de la vitrine) : rangée `div.flex.flex-wrap.gap-2`, L UR SR R PC C, `px-3 py-1 rounded-full text-xs font-semibold`, couleur en style ; cochée `ring-2 ring-white/30`, sinon `opacity-50` ; plusieurs à la fois. « Réinitialiser rareté » (« Réinitialiser » au Marché et dans la vitrine) apparaît dès qu'une est cochée. D'autres boutons peuvent partager la rangée (« Liste de souhaits » de Toutes les cartes). Lecture : `src/site/rarity-pills.ts` (`findRarityPills`).
- **Listes déroulantes à lui** (Collection, Toutes les cartes, collection d'un ami) : bouton `aria-haspopup="listbox"` `min-h-[42px]` dans son propre `div.relative` ; composant `{ ariaLabel, value, options, onChange }` ; `onChange` avec la valeur déjà affichée ne relance rien. Menu en `position: fixed`, rendu dans `body` tant qu'il est ouvert : `ul[role="listbox"]` (id = `aria-controls` du bouton), une option par `li[role="none"] > button[role="option"]` ; fermé par Échap ou un `mousedown` hors du bouton et du menu. Le Marché a un `<select>` natif. Lecture : `src/site/listbox.ts` (`findListbox`, `chooseSelectValue`).
- **Pagination** (Collection, Toutes les cartes, collection d'un ami) : « ← Précédent », libellé, « Suivant → ». Libellé « Page x / y » ; Toutes les cartes pendant une recherche : « Page x · suite disponible » ou « Page x » ; Collection pendant un chargement : roue et « Chargement… ». Ni première ou dernière page, ni saut direct. Un clic change l'état `page`, puis fait défiler. Le Marché n'a que « Charger la suite ». Lecture : `src/site/pagination.ts` (`findPaginationBars`, `parsePageLabel`).

## Temps réel

_Relevé : 29/09 ; chat de guilde : 01/10._

WebSocket `wss://<projet>.supabase.co/realtime/v1/websocket?apikey=…&vsn=2.0.0` (Supabase Realtime, protocole Phoenix). Trames JSON `[join_ref, ref, topic, event, payload]` pour la gestion (`phx_join`, `phx_reply`, `heartbeat` toutes les ~30 s, `phx_leave`, `access_token`) et les canaux publics (`postgres_changes`) ; **binaires** pour les diffusions des canaux privés (format : `src/site/realtime/decode.ts`).

| Canal | Événement | Effet côté site |
|---|---|---|
| `auction:<auctionId>` (privé) | `BID` : `{ bid, end_at, previous_bidder_id }` | Mise affichée à jour sans requête ; l'heure de fin peut changer ; alerte si l'enchérisseur précédent est soi. |
| `auction:<auctionId>` (privé) | `UPDATE` | Relecture de l'annonce. |
| `profile:<uid>` (privé) | `UPDATE` : ligne `profiles` complète | Relecture du solde (`get_my_profile`). Contient e-mail et identifiants de paiement : à masquer. |
| `notifications:<uid>` (privé) | `INSERT` : ligne `notifications` | Nouvelle notification ([En-tête](#en-tête-solde-et-cloche)). |
| `dms-list:<uid>` | `postgres_changes` INSERT `chat_messages` (`recipient_id` = soi) | Liste de /dms à jour, tant que la page est affichée. |
| `chat:<ami>:<uid>`, `chat-trades:<ami>:<uid>` | `postgres_changes` INSERT `chat_messages` (`sender_id` = l'ami) ; INSERT / UPDATE `trades` entre les deux | Messages et échanges de la conversation ouverte : rejoints à son ouverture, quittés (`phx_leave`) à sa fermeture. |
| `guild-chat:<guilde>` | `postgres_changes` INSERT `guild_messages` (`guild_id` = la guilde) : la ligne sans son auteur | Chat de guilde : rejoint par /guild dès qu'elle affiche une guilde, quel que soit l'onglet, quitté en quittant la page. Le site reprend l'auteur de sa liste des membres. |
| `guild-members:<guilde>` | `postgres_changes` `*` `guild_members` | Nombre de membres ; liste relue 3 s plus tard si l'onglet Membres a été ouvert. |
| `friendships-requester-<uid>`, `friendships-addressee-<uid>` | `postgres_changes` | **Refusé par le serveur** (« Unable to subscribe… ») : la page Amis ne se met pas à jour seule. |

- La connexion tombe souvent (29/09 : fermetures 1006 sans ouverture pendant plusieurs minutes, nouvel essai toutes les 3 à 12 s, puis reconnexion et nouveaux `phx_join`). Les diffusions manquées ne sont **pas** rejouées : ne pas compter sur le temps réel seul pour un état qui compte, relire par `fetch` à la reconnexion.
- Le script observe ces messages en lecture seule (`net.observeSocket`). Pour le chat de guilde hors de /guild, il ouvre son propre canal sur sa propre WebSocket (`openRealtimeChannel`, `src/site/realtime/channel.ts`) : `phx_join` avec la configuration qu'envoie le client du site pour un canal public (`broadcast: { ack: false, self: false }`, `presence: { key: '', enabled: false }`, `postgres_changes`, `private: false`, `access_token`) ; les changements arrivent en JSON.

## Modales

_Relevé : 29/09, code des pages capturées et captures (guilde et batailles comprises ; Paramètres non vus)._

- Toutes : `div.fixed.inset-0.z-…` (portail dans `body`, ou enfant d'une autre modale), centré (`p-4` en général), cadre qui arrête le clic. Pas de composant commun.
- **Fermeture par un clic sur le fond** partout (sauf pendant un envoi pour certaines). Attention : dans l'invitation de guilde, **un clic sur le fond décline l'invitation** ; le fond ne doit jamais servir à fermer une modale à la place de l'utilisateur.
- Un clic appuyé dans le cadre et relâché sur le fond (sélection de texte, glisser), ou l'inverse, arrive au fond (ancêtre commun des deux) : le site ferme.
- Pas une modale : le feu d'artifice des L de /pulls (`div.fixed.inset-0.z-[200]`, `pointer-events-none`).
- **Échap** : seulement Signaler, Faire appel, Boutique, ZEVENT et Échanger avec (qui confirme s'il y a des modifications). Ni la modale de carte, ni les autres.
- **Animations** : entrée seulement, sur le cadre (`animate-fade-in-up`) ; le fond apparaît d'un coup (sauf `animate-fade-in` de Choisir une carte et Photo de profil). À la fermeture, React retire tout d'un coup.
- **Fonds** : `bg-black/70 backdrop-blur-sm` presque partout (flou de 8 px en Tailwind v4) ; `/60` (Signaler, Faire appel, Installer), `/75` (ZEVENT), `/80` (Modifications non enregistrées), `backdrop-blur-md` (vitrine, photo), sans flou (Gérer les étiquettes).

Fermetures :

- **Croix ronde dans le coin** (`absolute top-3 right-3 flex h-9 w-9 rounded-full text-[var(--color-foreground)]/45 hover:bg-[var(--color-surface-light)]`, `aria-label="Fermer"`, lucide `x` `size-[18px]` ; `z-20` dans la modale de carte), cadre `card-frame relative … p-6` : modale de carte (`max-w-2xl`, `pt-14 sm:pt-6`, titre `pr-10`), Mettre aux enchères (`max-w-lg`), Vue du marché (`max-w-2xl`), Appliquer / Retirer une étiquette (`max-w-md`), Gérer les étiquettes (`card-frame-solid`, en-tête `border-b p-4 pr-12`, `z-[90]`).
- **En-tête en barre** (titre à gauche, croix `p-1 text-[var(--color-foreground)]/40` lucide `x` `size-5`, sans fond au survol), cadre `rounded-2xl border bg-[var(--color-surface-light)]` (pas `card-frame`), en-tête `p-5 border-b` : Choisir un ami, Échanger avec / Contre-offre (`max-w-5xl h-[90vh]`, fond `p-2`), Détail de l'échange (`max-w-4xl`, aussi depuis les amis). Même croix sans trait sous le titre : Rechercher un joueur (`card-frame max-w-md p-6`).
- **Croix carrée arrondie** (`p-1.5 rounded-lg`, icône `size-4`) : guilde (Accueil de guilde, Classement des guildes, Inviter des amis en feuille), batailles (Bataille de groupe ; Comment fonctionnent les batailles ?, qui a aussi « Compris »), Signaler un joueur et Faire appel d'une sanction (`z-[80]` / `z-[110]`, fond à part `absolute inset-0 bg-black/60`, `role="dialog"`, en-tête icône + titre + sous-titre, Annuler / Envoyer), conversation privée (feuille en bas sur mobile).
- **Autres** : Boutique (feuille en bas sur mobile, `bg-[var(--color-surface)]`, en-tête collant `border-b`, croix `size-7 rounded-full`, `aria-label="Fermer la boutique"`) ; Choisir une carte (vitrine) et Photo de profil (`bg-[var(--color-surface)] rounded-2xl shadow-2xl`, en-tête `px-5 py-4 border-b`, `h3 text-base`, croix en SVG maison sans `aria-label`) ; ZEVENT (thème à part) et Installer l'application (feuille, `card-frame`) : croix `absolute top-4 right-4 p-1 rounded-lg` ; texte « Fermer » à côté du titre : Modifier la guilde (désactivé pendant l'enregistrement).
- **Sans croix** : Comment ça marche ? (/pulls, « Compris ! ») ; Choisir une carte de la guilde (Annuler / Valider), Offrir cette carte, Choisir un adversaire (Annuler) ; Invitation de guilde (Décliner / Rejoindre) ; confirmations « Défausser cette carte ? », « Défausser n cartes ? » (`card-frame max-w-sm p-5`, Annuler / Défausser), « Modifications non enregistrées » (échanges, Rester / Quitter).

Lecture : `src/site/modals/` (`SITE_OVERLAY`, `findSiteModals`, `readSiteModal`, `topSiteModal`, `escapeTarget`, `isSiteModalOpen`, `isCornerCross`).

## Champs de saisie

_Relevé : captures et code des pages capturées, 29/09._

Le site impose `input,textarea,select{font-size:16px!important}` (contre le zoom sur iPhone) : la hauteur d'un champ tient à sa marge et à la hauteur de ligne de sa classe de texte (`text-sm` : 16 px × 1,25 / 0,875 = 22,9 px).

- **Standard, 45 px** : `border px-4 py-2.5 text-sm rounded-lg` (recherches de la Collection, de Toutes les cartes, des amis, du profil, du marché, nom d'utilisateur ; `pr-9` / `pr-10` avec une croix d'effacement). Montants (mise de départ, mise) : champ sans cadre `py-2.5` dans un cadre, même hauteur.
- **41 px** (`py-2 text-sm`) : étiquette de la modale de carte (`px-3`), recherches des échanges, de la bataille (amis) et du catalogue de guilde, nom et description de guilde, barres de message (messages privés, guilde : `rounded-xl`, bouton « Envoyer » `p-2.5` + icône `w-4 h-4` = 36 px, rangée `items-center`).
- **38 px** (`py-2 text-sm leading-5`) : gestion des étiquettes (nouvelle étiquette, code couleur `w-28 font-mono`), à côté d'un sélecteur de couleur carré `size-[2.375rem]` ; le bouton « Appliquer » (`py-2 text-xs`) de la rangée du code couleur est centré, plus petit.
- **Autres** : listes déroulantes à lui `min-h-[42px]` (Collection, Toutes les cartes), `<select>` natifs `py-2.5` (tri du marché, motif d'un signalement), code de bataille `py-2.5 text-lg` (47 px). À part : renommage en ligne (`px-2 py-1 rounded-md`, vitrine), connexion (`py-3`), zones de texte.
- Lecture : `src/site/fields.ts` (`FIELD_HEIGHT` : hauteur du champ standard, sélecteurs des champs et de leurs voisins).

## Boutons

_Relevé : captures de toutes les pages, 29/09._

Pas de composant commun : chaque bouton a ses classes (environ 250 combinaisons).

- **Tailles** : de `px-2 py-0.5 text-[10px]` à `px-8 py-3` (texte de base), arrondis `rounded` à `rounded-xl` ; icônes seules `p-1` à `p-2.5`, `size-7`, `h-9 w-9`, `w-12 h-12` (flèches du carrousel). Cibles tactiles `min-h-[44px]` / `min-h-[2.75rem]` (actions des lignes d'amis, de guilde, de bataille, centrées en `absolute` dans leur case).
- **Couleurs** : accent plein (`bg-[var(--color-accent)]`) ; accent teinté (`bg-[var(--color-accent)]/10`, parfois un trait `/20` à `/40` ; trait plein `border-[var(--color-accent)]` = état choisi, « Retirer de la liste de souhaits ») ; gris bordé (`border-[var(--color-border)]`) ; gris plein (`bg-[var(--color-surface-light)]`, `bg-white/10`) ; texte seul teinté au survol ; rouge plein (`bg-red-500`) ou teinté (`bg-red-500/10`, `text-red-400`), rouge au survol seulement (« Signaler », « Annuler l'offre ») ; teintés `sky` (Message des amis), `emerald` / `green` (Échanger, Accepter), `amber` (Contre-offre, Chef de guilde, prix de la boutique) ; dégradés `from-violet-600` (PRO) et `from-emerald-600` (recharge de paquets).
- **Pas des boutons d'action** (même balise `<button>`) : onglets, pastilles `rounded-full` (raretés, durées, filtres, « Réinitialiser »), listes déroulantes (`aria-haspopup`), lignes de liste `text-left` (conversations, notifications, échanges), puces de filtre des échanges `max-w-full`, emplacements `border-dashed`, photo de profil et tuiles de cartes `overflow-hidden`, paquet à ouvrir et barre du bas `flex-col`, interrupteurs `w-11 h-6`, étoile des cartes `p-0.5`, croix d'un champ (`absolute … -translate-y-1/2`), croix au coin d'une carte (`-top-2 -right-2`), segments, parties d'un champ (`border-l` / `border-r`), liens en texte sans marge (« Comment ça marche ? », « Modifier », « Retour au marché »), points du carrousel.
- Reconnaître un bouton à son icône lucide plutôt qu'à son texte (le script peut l'avoir renommé) : `hasIcon`, `siteButtons` (`src/site/dom.ts`). Classement des boutons par le script : `src/features/site-buttons/rules.ts`.

## Onglets

_Relevé : code du site, 30/09 ; marché : captures du 29/09._

- **Soulignés** (Marché, profil d'un joueur, Échanges, fenêtre d'échange) : rangée `flex border-b border-[var(--color-border)]` (au marché `div.flex.overflow-x-auto.border-b`), onglets `py-3 text-sm font-medium` (`py-2` dans la fenêtre d'échange), choisi `text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]`, les autres `text-[var(--color-foreground)]/50 hover:text-[var(--color-foreground)]`.
- **En segments**, seulement sur /guild (sans guilde : Guilde · Classement ; dans une guilde : Accueil · Chat · Membres (n) · Classement) : cadre `flex gap-1 bg-[var(--color-surface-light)] rounded-xl p-1` (`overflow-x-auto`), onglets à icône `flex-1 py-2 rounded-lg text-sm font-medium`, choisi `bg-[var(--color-accent)] text-[var(--color-accent-foreground)]`. React change ses classes au clic.
- Lecture : `src/site/tabs.ts` (`findUnderlinedTabBars`, `findSegmentTabBars`, `ACTIVE_SEGMENT_TAB`).

## En-tête, solde et cloche

_Relevé : solde 29/09 ; cloche : code du site, 30/09._

- **Solde** (`aria-label="Ouvrir la boutique WikiBidous"`, ouvre la boutique) en deux exemplaires : barre du haut sur mobile (`md:hidden fixed top-0 …`) et boîte fixe en haut à droite sur ordinateur (`hidden md:block fixed top-0 right-0 … pointer-events-none`, bouton `pointer-events-auto`). Lecture : `src/site/header.ts`.
- **Cloches** : deux `button[aria-label="Notifications"]` (`aria-expanded`), une dans le menu latéral à côté du logo (ordinateur), une après le solde dans la barre du haut (mobile). Icône `svg.w-5.h-5` sans classe `lucide`. Pastille rouge du nombre de non lues (« 9+ » au-delà).
- **État** : un fournisseur React autour de toute la navigation (`NotificationsProvider`, props `userId`) garde la liste (50 dernières, triées par date) et ses actions `{ markAsRead(ids), markAllAsRead(), fetchNotifications() }`, qui ne changent que l'état local. Liste relue par `GET /api/notifications` au montage, à chaque abonnement réussi au canal `notifications:<uid>` et à chaque ouverture de la liste ; une diffusion `INSERT` l'ajoute en tête ; une relecture ne rend pas « non lue » une notification lue localement.
- **La cloche**, seule à lire ce fournisseur, fait les `PATCH` : clic sur une ligne non lue → `PATCH { ids }` attendu, puis fermeture et `router.push` vers sa page (une sanction ouvre une fenêtre à lui : texte complet, contestation) ; « Tout marquer lu » (seulement s'il y a des non lues) → `markAllAsRead()` puis `PATCH {}`.
- Liste en portail dans `body` (`card-frame fixed z-[100]`, 320 px, 24 rem au plus, sous la cloche, calée dans l'écran), lignes `button` à clé React = id, fermée par un `mousedown` ailleurs.
- Types, textes et pages ouvertes : [api.md](../api.md#notifications).
- Lecture : `src/site/notifications/` (`findSiteBells`, `readSiteNotifications`, `openSiteNotification`, `notificationLabel`, `notificationText`, `notificationPath`).
