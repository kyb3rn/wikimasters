# API du site

Routes et données de wiki-masters.com, relevées du 29/09 au 01/10/2026 sur les captures et le code du site (dates en jj/mm). Aucune n'est documentée par le site : c'est un relevé, pas un contrat. Ce que les pages en font : [`site/README.md`](site/README.md) et un fichier par page.

Colonne « Script » : ce qui, dans `src/`, reconnaît la requête du site (observée, retenue, resservie) ou l'envoie lui-même ; vide : le script n'y touche pas.

## Conventions

- **`SB`** = Supabase (`https://<projet>.supabase.co`). Le client du site y ajoute la clé publique (`apikey`) et le jeton de session (`Authorization: Bearer <jeton>`, valable une heure, renouvelé par son client). Le script reprend ceux de la dernière requête du site, et le jeton de chaque renouvellement (`trackSupabaseSession`) ; ses appels : `supabaseRequest`, `supabaseFetch`. Essai à la main en dev : `wm.debug.sb('<table>?select=…')` (GET seulement).
- **Routes `/api/…`** : cookies de session. Le script les appelle par `siteRequest`, une seule tentative.
- **Identifiants** : `uid` = joueur (`sub` du jeton : `supabaseUserId`) ; **carte** = modèle (`card_id`) ; **exemplaire** = carte possédée (`user_card_id`, `id` d'une ligne de collection). Piège : `POST /api/marketplace` attend l'exemplaire dans un champ nommé `card_id`.
- **Erreurs** : corps `{ error }` (message que le site affiche tel quel), parfois avec un `code` (`bid_too_low`, `insufficient_balance`, `automation_limit`). Supabase : `{ code, message }` de Postgres (`23505` : doublon ; `57014` : délai dépassé) ; 401 : session expirée. Script : `SiteApiError`, `siteErrorMessage`, `siteErrorText`, `watchSiteRefusal` (`src/site/api/errors.ts`).
- **Horloge** : en-tête `Date` des réponses `/api/…` et `/rest/v1/…` (à la seconde ; une réponse avec `Age` sort d'un cache). Script : `trackServerClock`, `serverNow`.
- **Pagination** : `page` à partir de 0, sauf au marché (1). Listes de 50 ; au marché, `limit` > 50 : `403 automation_limit`.
- Temps réel (canaux, événements) : [site/README.md](site/README.md#temps-réel).

## Profil, solde, compte PRO

| Requête | Réponse | Script |
|---|---|---|
| `POST SB /rest/v1/rpc/get_my_profile` `{}` | profil complet ([Formes](#formes-des-données)) ; relu par le site après chaque action qui touche au solde | `isMyProfileRpc` : joueur connecté (`trackMe`), compte PRO (`trackProStatus`) |
| `POST SB /rest/v1/rpc/sync_profile_packs` `{ user_id }` | même profil, paquets recalculés (à chaque régénération) | idem |
| `GET SB /rest/v1/profiles?select=is_pro&id=eq.<uid>` (aussi `id,is_pro`, `is_admin`) | `[{ is_pro }]` ; gardé 5 min par le site, relu au retour sur l'onglet | `isProStatusRead` |
| `GET /api/wikibidous` | `{ balance }` (fenêtre d'échange) | |
| `PATCH /api/profile/<pseudo>` `{ is_public }` | `{ profile }` | `isProfileVisibilityChange` |
| `GET /api/image-reports/mine` | `{ cardIds }` : images signalées par soi | |

## Notifications

| Requête | Réponse | Script |
|---|---|---|
| `GET /api/notifications` | `{ notifications: [50 dernières] }` ; pas de pagination connue (`?offset=` sans effet, essai de l'utilisateur, 30/09) | `isNotificationsList`, `parseNotificationList` |
| `PATCH /api/notifications` `{ ids: [id] }` | `{ success }` : notifications marquées lues (clic sur une non lue) | `markNotificationsRead`, `readNotificationsMarkRead` |
| `PATCH /api/notifications` `{}` | `{ success }` : toutes marquées lues | `markNotificationsRead`, `readNotificationsMarkRead` |

Notification : `{ id, user_id, type, data, read, created_at }` ; `data.title` et `data.message` présents dans toutes les captures (le code du site prévoit leur absence). Nouvelles notifications : canal `notifications:<uid>`.

Titres entre guillemets : captures du 29/09 ; libellés, champs lus et pages ouvertes : code du site du 30/09 (`src/site/notifications/model.ts` : `notificationLabel`, `notificationText`, `notificationPath`).

| `type` | Libellé de la liste | `data` en plus | Page ouverte |
|---|---|---|---|
| `marketplace_outbid` | Surenchéri (« 📉 Vous avez été surenchéri ») | `auction_id, card_id, card_title, new_bid, previous_bid` | `/marketplace/<auction_id>` |
| `marketplace_auction_won` | Enchère gagnée (« 🏆 Enchère gagnée ! ») | `auction_id, card_id, card_title, final_price` | idem |
| `marketplace_auction_sold` | Carte vendue (« 💰 Carte vendue ! ») | `auction_id, card_id, card_title, final_price` | idem |
| `marketplace_auction_unsold` | Enchère terminée (« Enchère terminée sans acheteur ») | `auction_id, card_id, card_title` | idem |
| `marketplace_auction_midpoint_nudge` | Enchère sans mise (« Personne n'a encore enchéri — vous pouvez baisser votre prix de départ. ») | | idem |
| `marketplace_wishlist_listed` | Liste de souhaits (« Carte de votre liste de souhaits ») | `auction_id, card_id, card_title` | idem |
| `trade_offer` | Offre d'échange (« 🔄 Nouvelle offre d'échange ! ») | `trade_id, initiator_id, initiator_username` | `/trades` |
| `trade_countered` | Contre-offre reçue (« ↩️ Contre-offre reçue ! ») | `trade_id, initiator_id, initiator_username` | `/trades` |
| `trade_accepted`, `trade_declined` | Échange accepté, refusé | `recipient_username` | `/trades` |
| `friend_request` | Demande d'ami (« Nouvelle demande d'ami ! ») | `requester_id, requester_username, message` (pas l'id de l'amitié) | `/friends` |
| `chat_message` | Message (« 💬 <pseudo> ») | `sender_id, sender_username, preview` | `/dms` |
| `admin_cheat_warning` | Contrôle anti-triche | `message` | `/dms` |
| `admin_sanction` | Sanction | `sanction_id, title, message, preview` | fenêtre du site (texte complet, contestation : `POST /api/appeals`) |
| `battle_invite` | Défi de bataille | `challenger_username, battle_id` | `/battle/<battle_id>` |
| `battle_accepted` | Défi accepté | `opponent_username, battle_id` | `/battle/<battle_id>` |
| `guild_invite` | Invitation de guilde | `inviter_username, guild_id, guild_name` | `/guild?invite=<guild_id>&name=<nom>` |
| `guild_join` | Nouveau membre | `username` | `/guild` |
| `custom` | Message | `duel_id` | `/battle/duels/<duel_id>` |
| autre | le type, `_` remplacés par des espaces | | `/trades` |

## Paquets

| Requête | Réponse | Script |
|---|---|---|
| `POST /api/packs/verify-human` `{ website: "" }` | `{ pack_human_verified_at }` (`website` : champ-piège pour robots) | `isHumanCheckSubmit` |
| `POST /api/packs/open` | `{ cards: [5 cartes], packs_remaining, packs_last_regen_at, owned_copies }` ; refus `human_verification_required` quand une vérification humaine est due | `isPackOpening`, `parsePack` |
| `GET /api/packs/pro-daily`, en-tête `x-wiki-calendar-tz: <fuseau de l'appareil>` (ex. `Europe/Brussels`) | `{ eligible, claimed_today, claim_date: "AAAA-MM-JJ" }` : `claim_date` est le jour en cours dans ce fuseau, **même non réclamé** (relevé : `{"eligible":true,"claimed_today":false,"claim_date":"2026-09-30"}`) | `fetchProDaily` (même requête), `isProDailyStatus`, `parseProDaily` |
| `POST /api/packs/pro-daily` (même en-tête) | `{ cards: [15 cartes], claimed_today: true, eligible: false, claim_date }`, sans `owned_copies` ; 409 `{ error, claim_date }` si déjà réclamé | `isProDaily`, `isPackOpening`, `claimDateOf` |
| `GET SB /rest/v1/user_cards?select=id,card_id,starred,is_shiny,user_card_tags(tag:tags(*))&user_id=eq.<uid>&card_id=in.(…)` | exemplaires des cartes du pack PRO (le site les demande après l'ouverture) | `isCopiesQuery` |
| `POST /api/user-cards/<user_card_id>/discard` | `{ balance }` (+1 wikibidou) ; 409 si l'exemplaire n'existe plus | `discardUserCard` (même requête), `readDiscard` |

Carte d'un paquet : champs de la carte, plus `summary, content_length, rarity_order, in_global_collection, search_document, nsfw_image, nsfw_reviewed_at, …_refreshed_at`. Paquet : 30/09 pour le pack PRO, 29/09 pour le reste.

## Collection et étiquettes

| Requête | Réponse | Script |
|---|---|---|
| `GET /api/my-collection?sort=&page=&stats=0[&filtres]` | `{ collection: [50 exemplaires], total: null, rarityCounts: {}, tagOptions: [], pendingTradeCardIds }` | `isCollectionList`, `collectionList` ; avec `owned_by` (fenêtre d'échange) : `tradeCardsSide` |
| `GET /api/my-collection/stats?sort=[&filtres]` | `{ total, rarityCounts: { C, PC, R, SR, UR, L }, tagOptions: [étiquette + cardCount] }` | `isCollectionStats` |
| `GET SB /rest/v1/tags?select=*&user_id=eq.<uid>&order=name.asc` | `[étiquette]` | |
| `POST SB /rest/v1/tags` `{ user_id, name, color }` | nouvelle étiquette ; `23505` si le nom existe déjà | `createTags` : plusieurs d'un coup (`?select=*`, tableau, `Prefer: return=representation` → lignes créées) ; sur `23505`, rien n'est créé : celles qui existent sont reprises par leur nom (`tags?select=*&user_id=eq.<uid>`), les autres créées |
| `POST SB /rest/v1/user_card_tags` `{ user_card_id, tag_id }` | 201, corps vide : étiquette ajoutée à un exemplaire (modale de carte) | `readTagAdded` |
| `DELETE SB /rest/v1/user_card_tags?user_card_id=eq.<id>&tag_id=eq.<id>` | étiquette retirée (modale de carte) | `readTagRemoved` |
| `POST SB /rest/v1/user_card_tags?on_conflict=user_card_id,tag_id` `[{ user_card_id, tag_id }…]`, `Prefer: resolution=ignore-duplicates, count=exact` | 201, corps vide, `Content-Range: */<ajoutées>` : une étiquette sur toute la sélection (captures du 29/09) | `addTagsToCards` : toutes les étiquettes choisies en une requête (`return=minimal`, sans comptage) |
| `DELETE SB /rest/v1/user_card_tags?tag_id=eq.<id>&user_card_id=in.(…)` (par 100) | étiquette retirée de la sélection | `removeTagsFromCards` : tout en une requête (`tag_id=in.(…)`) |
| `PATCH SB /rest/v1/user_cards?user_id=eq.<uid>&card_id=eq.<card_id>` `{ starred }` | favori mis ou retiré, sur tous les exemplaires de la carte | `readStarChange` |
| `POST /api/user-cards/bulk-discard` `{ card_ids: [user_card_id…] }` | `{ discarded_count, failed: [] }` : un exemplaire de chaque carte sélectionnée défaussé (forme des éléments de `failed` inconnue) ; `{ error }` sinon | `isBulkDiscard`, `readBulkDiscard`, `readBulkDiscardFailures` |
| `GET SB /rest/v1/cards?select=summary&id=eq.<card_id>` | `{ summary }` (résumé Wikipédia, parfois `null`) | |

Relevé : 29/09 (captures et code du site), essais de l'utilisateur du 30/09.

- `page` commence à **0**, toujours 50 lignes (`limit`, `per_page`, `pageSize` ignorés) ; une ligne = un exemplaire (`count` : 1).
- `sort` : `rarity` (L → C, puis ajout le plus récent d'abord ; aussi sans `sort`), `name` (A → Z), `starred`, `added` (plus récent d'abord). Toute autre valeur : tri par nom, sans erreur. **Aucun sens de tri** : 15 écritures essayées (`order=desc`, `dir=`, `name_desc`, `-name`, `name.desc`…), toutes ignorées.
- Filtres : `q` (titre ou catégorie), `tag_id`, `untagged=1`, `rarity` (répétable : `rarity=SR&rarity=R` ; rareté de l'**exemplaire**, `snapshot_rarity`, pas celle de la carte aujourd'hui), `owned_by=<pseudo>` (marque `owned_by_peer`), `wishlisted_by=<pseudo>` (liste de souhaits de ce joueur).
- **Une seule étiquette** : `tag_id` répété → seul le premier compte ; `tag_id=A,B` → 0 ligne ; `tag_ids`, `tags`, `exclude_tag_id`, `not_tag_id` ignorés ; `untagged=1` l'emporte sur `tag_id`. Pas de filtre favori ni shiny (`starred=1`, `favorites=1`, `shiny=1`, `is_shiny=1` ignorés).
- `/stats` : `rarityCounts` suit `q`, ignore `rarity` et `untagged` (compteurs de toute la collection), vide avec `tag_id`. `total` suit `untagged` et `tagOptions` reste complet (capture du 02/10 : 85 cartes sans étiquette, toutes les étiquettes).

### Supabase en direct : collection

Sonde de lecture du 30/09 (outil de dev retiré depuis ; résultats bruts : `test/fixtures/captures/wm-sonde-collection-20260930-002148.json`, hors git). Seule la lecture des cartes sans étiquette sert au script (page Revente, version de dev ; forme optimisée validée par l'utilisateur le 03/10) :

| Requête | Réponse | Script |
|---|---|---|
| `GET SB /rest/v1/user_cards?select=id,card_id,starred,is_shiny,obtained_at,snapshot_rarity,snapshot_atk,snapshot_def,card:cards(wikipedia_title,wikipedia_url,category,image_url,hide_image,rarity,atk,def,q_score,pageviews),user_card_tags(tag_id)&user_id=eq.<uid>&user_card_tags=is.null&order=obtained_at.desc,id.desc&limit=1000&offset=<n>` | exemplaires sans étiquette, carte jointe (le filtre exige la jointure dans `select`), sans comptage ; tranches de 1 000 (plafond `max-rows` supposé) jusqu'à une tranche incomplète | `fetchUntaggedCopies`, `parseOwnedCopy` |
| `PATCH SB /rest/v1/user_cards?id=eq.<exemplaire>` `{ starred }` | favori d'un exemplaire, comme la Collection du site (son étoile, sa modale) | `setCopyStarred` |

Relevés de la sonde :

- Avec la session du site, les tables de la collection se lisent comme n'importe quelle table PostgREST, filtres et tris compris : 0,5 à 1 s, contre 2 à 5 s pour `/api/my-collection`.
- `user_cards` : `id, user_id, card_id, count, starred, obtained_at, is_shiny, snapshot_rarity, snapshot_atk, snapshot_def, snapshot_title, snapshot_category, eff_rarity_order` (colonnes `snapshot_*` et `eff_rarity_order` absentes des lignes de `/api/my-collection`) ; `user_card_tags` : `user_card_id, tag_id` ; `tags` : `id, user_id, name, created_at, color` ; `cards` : champs de la carte plus `summary, content_length, rarity_order, search_document, in_global_collection, nsfw_*, …_refreshed_at`.
- Toute la collection en **une** requête (`limit=5000` → 1 459 lignes sur 1 459, pas de plafond atteint) ; total par `Prefer: count=exact` (`Content-Range`).
- Étiquettes : l'une ou l'autre `select=id,user_card_tags!inner(tag_id)&user_card_tags.tag_id=in.(A,B)` ; toutes `select=id,a:user_card_tags!inner(tag_id),b:user_card_tags!inner(tag_id)&a.tag_id=eq.A&b.tag_id=eq.B` (acceptée ; les deux étiquettes essayées n'avaient aucune carte en commun : résultat à revérifier) ; sans A `select=id,x:user_card_tags(tag_id)&x.tag_id=eq.A&x=is.null` ; sans étiquette `user_card_tags=is.null` (mêmes totaux que le site).
- Rareté `snapshot_rarity=eq.SR` (= filtre du site ; `cards.rarity` en donne moins, la rareté d'une carte évolue) ; recherche `cards!inner(search_document)&cards.search_document=ilike.*olymp*` (= `q` du site).
- Tris dans les deux sens, y compris sur la carte : `order=cards(atk).desc`, `order=cards(rarity_order).asc,obtained_at.asc`, `order=obtained_at.asc`.
- Schéma (`GET SB /rest/v1/`, OpenAPI) : **401**, fermé aux joueurs.

## Catalogue et liste de souhaits

| Requête | Réponse | Script |
|---|---|---|
| `GET /api/cards?page=[&q=][&rarity=…]&sort=[&wishlist=1]` (dans cet ordre) | `{ cards: [carte], total, searchHasMore, rarityCounts, friendOwners, ownedCardIds, wishlistCardIds, friendPendingOfferKeys }` ; avec une recherche (capture du 30/09, `q=mesrine`) : `total: null`, `rarityCounts: {}`, `searchHasMore` | `isGlobalCollectionList`, `globalCollectionList` |
| `POST SB /rest/v1/wishlist_items` `{ user_id, card_id }` | 201, corps vide : carte ajoutée à la liste de souhaits (409, code 23505 si elle y est déjà, ignoré par le site) | `isWishlistChange`, `readWishlistChange`, `addToWishlist` |
| `DELETE SB /rest/v1/wishlist_items?user_id=eq.<uid>&card_id=eq.<card_id>` | carte retirée de la liste | `isWishlistChange`, `readWishlistChange`, `removeFromWishlist` |

Relevé : code du site, 30/09.

- `page` commence à **0**, 50 cartes par page ; `sort` : `rarity`, `name`, `atk`, `def` ; `q` utilisé à partir de 3 caractères (pas de total, `searchHasMore`) ; `wishlist=1` : seulement les cartes de ma liste.
- `friendOwners` : `{ <card_id>: [{ id, username, … }] }`, amis qui possèdent la carte (le premier sert à « Proposer un échange ») ; `friendPendingOfferKeys` : `"<id de l'ami>:<card_id>"` quand une offre est déjà en cours ; `ownedCardIds`, `wishlistCardIds` : identifiants de cartes.

## Marché

| Requête | Réponse | Script |
|---|---|---|
| `GET /api/marketplace?page=&limit=50&sort=[&rarity=…][&q=][&mine=1]` | `{ auctions: [annonce], page, limit, hasMore }` ; avec `mine=1`, en plus `mine: true`, `selling, bidding, won, history` (annonces) et `maxConcurrentAuctions` | `isMarketplaceList`, `marketplaceList` ; `limit=1` : `isMarketplaceMineRefresh` ; `page=1&limit=1&mine=1` (ses ventes en cours, page Revente) : `fetchMySales`, `parseMySales` |
| `GET /api/marketplace/<auctionId>` | `{ auction, bids: [mise] }` ; `auction` : `card_id`, `snapshot_rarity` (rareté de l'exemplaire en vente), `card` (la carte : `id`, `wikipedia_title`, `rarity`…), `seller`, `effective_bid`… (capture du 30/09) | `readAuctionRequest`, `parseAuctionCard` |
| `GET /api/marketplace/mine` | `{ sellingCount, maxConcurrentAuctions }` (modale de carte, mise aux enchères) | |
| `POST /api/marketplace` `{ card_id: <user_card_id>, base_amount, duration_minutes }` | 201 `{ auction_id }` ; vérification due (depuis le 02/10) : 403 `{ error: "Vérification anti-bot requise.", code: "human_verification_required" }` | `readAuctionCreation` |
| `POST /api/human-check` `{ token }` | jeton Cloudflare Turnstile de la « Vérification rapide » (mise aux enchères) ; refus : `{ error }` | |
| `POST /api/marketplace/<auctionId>/bid` `{ amount }` | `{ auction_id, current_bid, bidder_balance }` ; refus : `{ error, code: "bid_too_low", min }` ou `code: "insufficient_balance"` | |
| `POST /api/marketplace/<auctionId>/settle` | finalise une enchère terminée (code du site) | |
| `DELETE /api/marketplace/<auctionId>` | `{ status: "cancelled" }` | `readAuctionCancel` |
| `GET /api/marketplace/cards/<card_id>/sales` | `{ wikipedia_title, sales: [vente, du plus ancien au plus récent], recent: [10 dernières, du plus récent] }` ; **comptes PRO seulement** (erreur sinon, constat de l'utilisateur, 30/09) | `fetchCardSales` (même requête), `readSalesRequest`, `parseCardSales` |
| `GET /api/marketplace/cards/<card_id>/sales?scope=summary` | `{ wikipedia_title, summary: { <rareté>: { average, count, latest } }, isPro }` | `isProStatusRead` (lit `isPro`) |

Relevé : 29/09 (captures et code du site), sauf mention.

- `page` commence à **1** ; `limit` > 50 → `403 { code: "automation_limit" }`. Pas de total.
- `sort` : `recent`, `price_asc`, `price_desc`, `ending_soon`.
- Les onglets du marché n'appellent rien : tout vient de `mine=1`. Pour relire seulement ces listes, le site demande `page=1&limit=1&mine=1`.
- Listes de `mine=1` : `selling` = mes annonces `active` ; `bidding` = annonces `active` d'autres vendeurs où j'ai misé, que je mène ou non (`current_bidder_id` le dit) ; `won` = les 50 dernières que j'ai gagnées (`settled_sold`, `winner_id` = moi) ; `history` = les 50 dernières de mes ventes terminées (`settled_sold`, `settled_unsold`, `cancelled`). `won` et `history` vont du plus récent au plus ancien.
- `maxConcurrentAuctions` : 5 pour un compte normal, 10 pour un compte PRO.
- **Limite des ventes d'une carte** (mesurée le 02/10 sur deux captures, refus provoqués par l'utilisateur) : **30 requêtes par minute de l'horloge du serveur** (fenêtre fixe, libérée à hh:mm:00 ; heure du serveur : `serverNow`) ; la 31e et les suivantes reçoivent `403 { error: "Trop de requêtes automatisées. L'automatisation n'est pas autorisée — voir le règlement.", code: "automation_limit" }`, sans en-tête de quota ni `Retry-After` (refus de la route elle-même, `x-matched-path`, pas du pare-feu Vercel). Les refus ne comptent pas et ne prolongent rien : la première requête après la fin de la fenêtre passe. Compteur propre à cette route (7 autres requêtes `/api/…` dans la même fenêtre n'ont rien avancé). Exclus : fenêtre glissante, exacte ou approchée (refus mal placés), et fenêtre de 60 s ouverte par la première requête (36 passées en 36 s, 16 avant la minute et 20 après). Inconnu : par compte ou par adresse ; `scope=summary` dans le même compteur ou non.
- Ventes d'une carte : toutes raretés mélangées (`rarity` de l'exemplaire vendu), sans indication shiny ; liste vide pour une carte jamais vendue (`{ wikipedia_title, sales: [], recent: [] }`). Le script les garde en cache dans la base IndexedDB `wm-market` (magasin `sales`, `{ id: <card_id>, fetchedAt, title, sales }`, ventes au format du site : forme de l'ancien script).
- Mises en vente acceptées (historique de la mise aux enchères) : même base, magasin `listings` de l'ancien wm-vente, `{ id: <card_id>, title, attempts: [{ at, price, minutes, rarity, shiny, auctionId }] }` ; mise et durée lues dans `POST /api/marketplace` (`readAuctionCreation`), numéro de l'enchère dans sa réponse. Entrées de l'ancien script relues : `duration: { secs, text }`, `ok` (seuls les essais publiés, `ok: true`, comptent), rareté `SHINY` = L shiny.

### Supabase en direct : enchères

Essais à la main du 30/09, lecture seule. La table `auctions` se lit avec la session du site (le site, lui, passe toujours par `/api/marketplace`).

- Exemple : `select=id,card_id,end_at,base_amount,current_bid,snapshot_rarity,is_shiny&status=eq.active&end_at=gte.<date>&snapshot_rarity=in.(L,UR,SR)&or=(and(current_bid.gte.100,current_bid.lte.500),and(current_bid.is.null,base_amount.gte.100,base_amount.lte.500))&order=end_at.asc&limit=50` : 50 lignes en **193 ms**. Filtres que `/api/marketplace` n'offre pas (prix, temps restant) : exception à la règle « comme le site », à décider avant tout usage hors du dev.
- `Prefer: count=exact` : **500** `57014` (`statement timeout`, ≈ 10 s), même avec `limit=1` : jamais de comptage exact sur cette table (au plus `count=estimated`).
- `current_bid` est `null` tant que personne n'a misé (réponses de `/api/marketplace` : 5 427 annonces sans enchérisseur, toutes à `null`) ; `snapshot_search_document` : titre et catégorie en minuscules, sans accents.
- Colonnes complètes et `effective_bid` (présente dans les réponses de `/api/marketplace`, peut-être calculée par la route) : à relever (`select=*&limit=1`).
- Onglet de dev « Recherche avancée » (`market-search`, absent de la version de production) : `auctions?select=id,card_id,seller_id,end_at,created_at,base_amount,current_bid,current_bidder_id,snapshot_rarity,snapshot_atk,snapshot_def,is_shiny&status=eq.active&…`, sans comptage, page suivante par curseur sur la clé du tri (`order=end_at.asc,id.asc`…) ; puis `cards?select=id,wikipedia_title,category,image_url,hide_image&id=in.(…)` et `profiles?select=id,username&id=in.(…)` par lots de 100 identifiants (profils des autres joueurs lisibles : à confirmer sur le vrai site), `wishlist_items?select=card_id&user_id=eq.<uid>`.

## Échanges

| Requête | Réponse | Script |
|---|---|---|
| `GET /api/trades?active=1` | `{ trades: [échange] }` (état de la page /trades) | |
| `POST /api/trades` `{ recipient_id, items: [{ user_card_id, card_id, offered_by }], initiator_wikibidous, recipient_wikibidous }` | 201 `{ trade }` (`status: "pending"`) ; une contre-offre crée un nouvel échange lié par `parent_trade_id` ; refusé si un montant dépasse le solde | |
| `PATCH /api/trades/<tradeId>` `{ action: "accept" \| "decline" }` | `{ status: "accepted" \| "declined" }` | |

Relevé : 29/09. Cartes de la fenêtre d'échange : `GET /api/my-collection?…&owned_by=<ami>` et `GET /api/profile/<ami>/collection?…&pending=1` ([site/trades.md](site/trades.md#chargement-des-cartes) ; script : `tradeCardsSide`).

## Joueurs, amis, vitrine, signalements

| Requête | Réponse | Script |
|---|---|---|
| `GET /api/profile/<pseudo>` | `{ profile: joueur + is_public, created_at, activity_blocked_until, isOwn, isFriend, friendshipId, pendingRequest, lastSeenAt }` (`pendingRequest` toujours `null` dans les captures) | `isProfileRead`, `parseProfileFriendship` (notifications : id de l'amitié d'une demande reçue) |
| `GET /api/profile/<pseudo>/stats` | `{ total }` | |
| `GET /api/profile/<pseudo>/showcase` | `{ showcase: [{ position, user_card_id, user_card }], galleries: [{ gallery_index, name }] }` | |
| `GET /api/profile/<pseudo>/collection?page=&sort=&stats=[&q=][&rarity=…][&tag_id=]&pending=1` (dans cet ordre ; code du 30/09) | `{ collection, total, rarityCounts, tagOptions, pendingTradeCardIds, profileId }` ; exemplaires avec `owned_by_viewer` ; 50 par page, `page` à partir de 0 ; `stats=1` en page 0 seulement ; tri `rarity`, `name`, `added`. `wishlisted_by_me=1` : seulement dans la fenêtre d'échange | `profileCollectionList` (pseudo du profil affiché seulement) ; fenêtre d'échange : `tradeCardsSide` |
| `GET /api/showcase`, `PUT /api/showcase` `{ position, user_card_id }`, `DELETE /api/showcase` `{ position }` | sa propre vitrine ; `{ ok }` | |
| `GET /api/friends` | `{ friendships: [{ id, status, requester_id, addressee_id, requester, addressee, created_at, … }], counts: { accepted, incoming, outgoing } }` : **tout d'un coup**, amis et demandes (aucun paramètre, pas de pagination ; captures : 20 amitiés = 17 + 0 + 3 des compteurs) | `isFriendsList` (`friends-layout` la resservit sans réseau), `fetchFriendships` (même requête), `parseFriendships`, `parseFriendsList` (illisible : `undefined`) ; joueur connecté (`trackMe`) ; demandes d'ami des notifications |
| `GET /api/friends/search?q=` | `{ users: [{ id, username, avatar_url, avatar_pos_x, avatar_pos_y }] }` (à partir de 2 caractères ; 10 pour « ed » le 01/10, limite probable) | `isPlayerSearch`, `parsePlayerSearch` ; `player-search` suit sa durée |
| `POST /api/friends` `{ addressee_id }` | 201 `{ friendship }` (`status: "pending"` ; joueurs `requester` / `addressee` joints ou non : pas encore vu) ; « Ajouter » de « Rechercher un joueur », réponse non lue par le site | `readFriendshipAction`, `parseSentFriendship` |
| `DELETE /api/friends/<friendshipId>` | `{ success }` : retirer un ami, annuler une demande | `removeFriendship` (même requête), `isFriendshipDelete`, `readFriendshipAction` |
| `PATCH /api/friends/<friendshipId>` `{ action: "accept" \| "decline" }` (`Content-Type: application/json`) | `{ status: "accepted" }` (capture du 30/09) : demande reçue acceptée ou refusée (page Amis, profil ; réponse non lue par le site) | `answerFriendRequest` (même requête), `readFriendshipAction` |
| `POST /api/friends/accept-all` | toutes les demandes reçues acceptées | `readFriendshipAction` |
| `POST /api/reports` `{ reportedUserId, reason, details }` | `{ ok }` | |
| `GET /api/reports?reportedUserId=<uid>` | `{ report: { reason, details, created_at } }` : son signalement déjà fait sur ce joueur | |

Relevé : 29/09, code du site du 30/09 pour les amis.

## Messages

| Requête | Réponse | Script |
|---|---|---|
| `GET /api/chat` | `{ conversations: [{ peer_id, peer_username, peer_avatar_url, peer_avatar_pos_x, peer_avatar_pos_y, last_message, last_message_at, unread_count }] }` (page /dms) | |
| `GET /api/chat/<peerId>` | `{ messages: [message privé] }` (une conversation) | |
| `POST /api/chat/<peerId>` `{ content }` | `{ message }` | |

Relevé : 29/09. Nouveaux messages : canaux `dms-list:<uid>`, `chat:<ami>:<uid>` ([site/dms.md](site/dms.md)).

## Guildes

| Requête | Réponse | Script |
|---|---|---|
| `GET /api/guilds` (capture du 01/10) | `{ guild, membership, member_count, home }` (`guild` nul sans guilde) ; `home` : `guild` (`karma_this_week`, `donations_this_week`), `wishlist[]` (demandes des membres : `id`, `card` (modèle), `user_id`, `username`, `avatar_url`, `is_self`, `can_donate`, `owned_copy_ids[]`, `recipient_received_today`, `created_at`), `my_wishlist`, `leaderboard`, `my_contribution`, `recent_donations[]` (`card`, `donor`, `recipient`, `karma_awarded`), `weekly_karma_donors[]`, `received_donation_today`, `reset_in_ms` | `trackGuildMembership`, `readGuildsResponse` |
| `POST /api/guilds` `{ name, description? }` (nom de 2 à 30 caractères, description de 200 au plus, vide = absente) | création ; erreur : `{ error }`, affiché tel quel dans le formulaire ; réussite : le site relit sa guilde (`GET /api/guilds`) | `createGuild` |
| `PATCH /api/guilds` `{ name, description \| null }` | « Modifier la guilde » (chef) ; `{ guild }` ou `{ error }` | |
| `POST /api/guilds/leave` | quitter la guilde (après `window.confirm`) ; `{ error }` en cas de refus (`alert`) | `trackGuildMembership` |
| `GET /api/guilds/chat` (`cache: 'no-store'`, capture du 01/10) | `{ messages: [message de guilde] }` triés (106 messages relevés) ; demandée seulement à l'ouverture de l'onglet Chat | `fetchGuildChat` (même requête) |
| `POST /api/guilds/chat` `{ content }` (1 000 caractères au plus) | `{ message }` (même forme) ; refus : `{ error }` (le site remet le texte dans le champ) | `sendGuildMessage` |

Relevé : code du site du 30/09 (réponses non capturées, sauf mention). Temps réel : `guild-chat:<guilde>` (INSERT `guild_messages`, sans l'auteur), `guild-members:<guilde>` ([site/guild.md](site/guild.md)).

Lectures directes du script (Supabase, colonnes utiles), **non vérifiées sur le vrai site au 01/10** (règles d'accès supposées : le site rejoint en temps réel `guild_members` de sa guilde) :

- guilde du joueur : `guild_members?select=guild_id&user_id=eq.<uid>&limit=1` (`[]` sans guilde), puis `guilds?select=id,name&id=eq.<id>` (`myGuild`, au plus toutes les 4 h) ;
- auteur d'un message reçu par le temps réel : `profiles?select=id,username,avatar_url,avatar_pos_x,avatar_pos_y&id=eq.<uid>` (`fetchGuildSender`).

## Session

| Requête | Réponse | Script |
|---|---|---|
| `POST SB /auth/v1/token?grant_type=refresh_token` `{ refresh_token }` | `{ access_token, … }` : nouveau jeton (toutes les heures) | `trackSupabaseSession` (jeton renouvelé) |
| `GET SB /auth/v1/.well-known/jwks.json` | clés publiques de vérification des jetons | |

Le jeton de session et la clé publique se lisent au passage dans les requêtes Supabase du site ; le `sub` du jeton est l'`uid`. Le site peut ne faire aucune requête Supabase de toute une visite (02/10 : marché rechargé, statut PRO non redemandé) : le jeton se relit alors dans son cookie (client `@supabase/ssr`, code du 02/10) `sb-<projet>-auth-token`, lisible par la page, la session en JSON écrite `base64-<base64url>`, découpée en `<nom>.0`, `<nom>.1`… si elle est longue (`readSessionCookie`) ; la clé publique, absente du cookie (écrite dans le code du site), est gardée de la dernière requête vue (`wm-supabase-v1`).

## Formes des données

- **Profil** : `id, username, is_pro, is_vip, is_admin, is_public, avatar_url, avatar_pos_x, avatar_pos_y, created_at, deleted_at, wikibidous_balance, packs_remaining, packs_last_regen_at, last_normal_pack_opened_at, special_pack_last_claimed_at, pack_human_verified_at, pity_counter, cheat_strikes, last_sanction_at, last_sanction_type, activity_blocked_until, hide_sensitive, avatar_user_card_id, username_changed_at, leaderboard_excluded`. La version diffusée en temps réel (`profile:<uid>`) contient en plus l'e-mail d'inscription et des identifiants Stripe / Apple (masqués dans les captures).
- **Joueur** (joint aux réponses : amitiés, recherche, messages) : `{ id, username, avatar_url, avatar_pos_x, avatar_pos_y }`, cadrage de la photo en % (50 par défaut). Script : `parsePlayer`.
- **Carte** : `{ id, wikipedia_title, wikipedia_url, category, rarity, atk, def, q_score, pageviews, image_url, hide_image, lang, created_at }` (+ `is_shiny` dans une annonce). Script : `parseCardRef`.
- **Exemplaire** (ligne de collection) : `{ id, card_id, card, tags, count, starred, is_shiny, obtained_at, user_id }`, plus `owned_by_viewer` (collection d'un autre : je la possède aussi) ou `owned_by_peer`. Dans `owned_copies` (ouverture de paquet) : `{ id, card_id, starred, is_shiny, user_card_tags: [{ tag }] }`.
- **Étiquette** : `{ id, name, color, user_id, created_at }` (nom de 48 caractères au plus, couleur `#rrggbb`).
- **Annonce** : `id, card_id, card, seller_id, seller, status ("active", "settled_sold", "settled_unsold", "cancelled"), base_amount, listing_base_amount, base_repriced_at, current_bid, current_bidder_id, current_bidder, effective_bid (mise actuelle, sinon de départ), end_at, created_at, settled_at, winner_id, winner, final_price, snapshot_rarity, snapshot_atk, snapshot_def, is_shiny, snapshot_search_document, owned (je possède cette carte)`.
- **Mise** : `{ id, auction_id, bidder_id, bidder, amount, placed_at }`.
- **Vente** : `{ id, final_price, settled_at, rarity }` (pas d'indication shiny). Script : `parseSale`.
- **Échange** : `{ id, status, initiator_id, initiator, recipient_id, recipient, items, initiator_wikibidous, recipient_wikibidous, parent_trade_id, created_at, updated_at }` ; élément : `{ id, trade_id, user_card_id, card_id, card, offered_by, is_shiny, snapshot_rarity, snapshot_atk, snapshot_def }`.
- **Message privé** : `{ id, sender_id, recipient_id, content, read, created_at, sender: joueur }`.
- **Message de guilde** : `{ id, guild_id, sender_id, content, type, created_at, sender: joueur }` ; `type: 'event'` : annonce de la guilde (« X a rejoint la guilde. Dites bonjour ! »), sans auteur affiché ; `sender` parfois en tableau d'un élément (jointure Supabase) ; absent des lignes du temps réel. Script : `parseGuildMessage`.
