# Guilde (`/guild`)

Page de sa guilde (Accueil, Chat, Membres, Classement), ou, sans guilde, création et classement. Dates en jj/mm (2026). Routes : [api.md](../api.md#guildes). Modales de la guilde (Accueil de guilde, Classement des guildes, Inviter des amis, Modifier la guilde, Invitation) : [README](README.md#modales).

## En-tête et onglets

_Relevé : capture du 01/10._

```
div.flex-1.flex.flex-col.gap-4
  div.flex.items-center.justify-between   en-tête : [icône + h1 (nom) + description] · div.flex.items-center.gap-2
                                         [span « 52 membres » (hidden sm:inline) + button « + Inviter »]
  div.flex.gap-1.rounded-xl.p-1          onglets en segments (overflow-x-auto) : Accueil, Chat, Membres (n), Classement
  …                                      contenu de l'onglet
```

- « + Inviter » (`px-3 py-1.5 text-xs`, accent teinté) ouvre « Inviter des amis ».
- Onglets en segments ([README](README.md#onglets)) ; sans guilde : Guilde · Classement.
- Accueil : le premier cadre (« Semaine en cours ») a en fond un calque `absolute inset-0 bg-gradient-to-br from-[var(--color-accent)]/5 via-transparent to-amber-500/3 pointer-events-none`.
- `GET /api/guilds` (guilde, adhésion, nombre de membres, Accueil) n'est demandé que sur /guild. Canaux temps réel rejoints dès qu'une guilde est affichée : `guild-chat:<guilde>`, `guild-members:<guilde>` ([README](README.md#temps-réel)).
- Lecture : `src/site/guild/page.ts` (`findGuildHeader`, `GUILD_GRADIENT_LAYER`, `findGuildChatTab`).

## Accueil, liste de souhaits

_Relevé : capture du 01/10._

- Cadre « Liste de souhaits » : rangée `flex flex-wrap justify-center gap-3 sm:gap-[22px] md:gap-[26px]` ; d'abord sa propre demande (« Ma demande ») ou, sans elle, « Ajouter ma demande » (bouton `border-dashed` de la taille d'une carte), puis une face `sm` par demande d'un autre membre, chacune dans `div.flex.flex-col.items-center.gap-1.5 > div.relative.rounded-xl`.
- Composant d'une demande (code du 01/10) : `{ card, label, canDonate, isSelf, recipientReceivedToday, onDonate, onEdit, onClear, actionsDisabled }`, de clé `id` de la demande pour les autres membres, sans clé pour la sienne ; sa case est son premier nœud. Les demandes viennent de l'état de l'Accueil (premier état : `home`, lu dans `GET /api/guilds` puis relu par `GET /api/guilds/home` après un don ou un changement) : `wishlist[]` (les autres membres), `my_wishlist`.
- Sous la description de la face, au-dessus d'ATK · DEF (emplacement du bas de la face, [README](README.md#face-de-carte)) :

```
div.mt-auto.flex.flex-col.items-start.gap-0.5.pt-1
  div.min-w-0.max-w-full.shrink-0 > span.rounded-full.text-[9px][title]   « pseudo » ou « pseudo · reçu aujourd'hui » (bg-black/55) ; « Ma demande » (accent)
  div.flex.justify-between.border-t                                       ATK · DEF
```

- « reçu aujourd'hui » : `recipient_received_today`, le membre a déjà reçu une carte aujourd'hui. Un pseudo ne contient pas « · ». Sa propre demande : « Reçu aujourd'hui — 1 carte max par jour » sous la case, et « Modifier · Retirer ».
- Je peux donner (`can_donate`) : anneau accent autour de la case, bouton « Donner » sur le coin haut droit de la face (« Bordure verte = tu peux donner »). Le don envoie le premier de `owned_copy_ids` (mes exemplaires de la carte). Le site n'affiche pas « Possédée » ici. Toutes les captures du 01/10 ont `owned_copy_ids` vide : on ne sait pas s'il liste tous mes exemplaires ou seulement ceux que je peux donner.
- Piège : la pastille « Possédée » des annonces du marché (vignettes et page d'une enchère, `title="Dans ta collection"`) occupe le même emplacement de la face ; seule la case de la demande (`div.flex.flex-col.items-center.gap-1.5 > div.relative.rounded-xl`) les distingue.
- La guilde a sa propre « Choisir une carte » (Annuler / Valider, sans pastilles de rareté).
- Lecture : `src/site/guild/wishlist.ts` (`findGuildWishRequesters` : autres membres seulement, `parseRequesterLabel`, `findOwnGuildWishImage` : « Ma demande », `findGuildWishes` : je possède la carte).

## Chat

_Relevé : code et capture du 01/10._

- Onglet « Chat » (lucide `message-circle`). Contenu : cadre `flex-1 flex flex-col card-frame` : liste (`flex-1 overflow-y-auto px-4 py-3 space-y-1`, mêmes jours, bulles et heures que les conversations privées, [dms.md](dms.md#messages)) puis barre « Message à la guilde… ».
- Annonces de la guilde (`type: 'event'`, « X a rejoint la guilde. Dites bonjour ! ») en pastille centrée (`flex justify-center my-2 > span.rounded-full`), sans auteur.
- Au-dessus de chaque message d'un autre, son pseudo (`div.mb-0.5.flex.gap-2` : cale `h-8 w-8` de 32 px de haut, ce qui l'écarte de la bulle, puis `span.text-[10px]`) ; chaque message a sa photo.
- Liste lue à la première ouverture de l'onglet (`GET /api/guilds/chat`), suivie par le canal `guild-chat:<guilde>`, qui donne les nouvelles lignes **sans leur auteur** : le site le reprend de sa liste des membres.
- Envoi : `POST /api/guilds/chat` `{ content }` (1 000 caractères au plus) ; refus : le site remet le texte dans le champ.

## Sans guilde : créer une guilde

_Relevé : code du site, 01/10._

- Sous les onglets, carte « Vous n'êtes dans aucune guilde » (`card-frame p-8`, château lucide `size-14`, bouton « Créer une guilde »).
- Au clic, React la remplace **dans la page** (pas une modale) par le formulaire `card-frame p-6 space-y-4` : en-tête (`h2` « Créer une guilde », « Annuler » en texte), nom (`input maxlength=30`), description facultative (`textarea maxlength=200`), compteurs, erreur de l'API (`p.text-red-400`), « Créer la guilde » pleine largeur.
- « Créer la guilde » : désactivé si le nom a moins de 2 caractères, et pendant `POST /api/guilds` `{ name, description? }` (« Création… »).
- Réussite : formulaire fermé, guilde relue par le chargeur de la page (`useCallback` : `GET /api/guilds`, puis guilde, adhésion, nombre de membres et, avec `{ seedHome: true }`, l'Accueil), qui remplace la carte. Ce chargeur n'est appelé qu'au montage de la page et après une action (création, invitation acceptée, exclusion, passation). Échec réseau : rien d'affiché. « Annuler » garde les valeurs saisies pour la prochaine ouverture.
- Lecture : `src/site/guild/creation.ts` (`findNoGuildCard`, `reloadSiteGuild`) ; création : `createGuild` (`src/site/api/guild.ts`).

## Guilde du joueur

_Relevé : code du site et capture, 01/10._

- Le site ne demande la guilde du joueur que sur /guild (`GET /api/guilds` : `guild` nul sans guilde) ; le départ passe par `POST /api/guilds/leave` (après `window.confirm`).
- Ailleurs, le script la lit dans Supabase (`guild_members`, puis `guilds`) : [api.md](../api.md#guildes). Règles d'accès supposées, non vérifiées sur le vrai site au 01/10.
- Lecture : `src/site/guild/membership.ts` (`myGuild`, `trackGuildMembership`, `readGuildsResponse`, `forgetMyGuild`).

## Dans le script

`guild-layout`, `guild-chat-tab` (onglet Chat caché), `guild-chat` (le chat dans /dms), `guild-create-modal`, `guild-card-display`, `site-tabs`, `player-links`. Détail : section « Guilde » de [features.md](../features.md).
