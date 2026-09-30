# API du site

Routes observées le 29/09/2026 (captures et code du site). Aucune n'est documentée par le site : relevé, pas contrat. `SB` = Supabase (`https://<projet>.supabase.co`, en-têtes `apikey` + `Authorization: Bearer <jeton>` ajoutés par le site ; le jeton, valable une heure, est renouvelé par son client, `POST SB /auth/v1/token` → `{ access_token }`). Le script appelle Supabase avec la clé et le jeton de la dernière requête du site (`src/site/api/supabase.ts`). Contexte et règles d'usage : [`site.md`](site.md).

Identifiants : `uid` = joueur, **carte** = modèle (`card_id`), **exemplaire** = carte possédée (`user_card_id`, `id` d'une ligne de collection).

## Profil, solde, notifications

| Requête | Réponse |
|---|---|
| `POST SB /rest/v1/rpc/get_my_profile` `{}` | profil complet (ci-dessous) ; relu par le site après chaque action qui touche au solde |
| `POST SB /rest/v1/rpc/sync_profile_packs` `{ user_id }` | même profil, paquets recalculés (appelé à chaque régénération) |
| `GET SB /rest/v1/profiles?select=is_pro&id=eq.<uid>` (aussi `id,is_pro`, `is_admin`) | `[{ is_pro }]` |
| `GET /api/wikibidous` | `{ balance }` |
| `PATCH /api/profile/<pseudo>` `{ is_public }` | `{ profile }` |
| `GET /api/notifications` | `{ notifications: [50 dernières] }` |
| `PATCH /api/notifications` `{}` | `{ success }` : tout marquer comme lu |
| `GET /api/image-reports/mine` | `{ cardIds }` : images signalées par soi |

**Profil** : `id, username, is_pro, is_vip, is_admin, is_public, avatar_url, avatar_pos_x, avatar_pos_y, created_at, deleted_at, wikibidous_balance, packs_remaining, packs_last_regen_at, last_normal_pack_opened_at, special_pack_last_claimed_at, pack_human_verified_at, pity_counter, cheat_strikes, last_sanction_at, last_sanction_type, activity_blocked_until, hide_sensitive, avatar_user_card_id, username_changed_at, leaderboard_excluded`. La version diffusée en temps réel (`profile:<uid>`) contient en plus l'e-mail d'inscription et des identifiants Stripe / Apple.

**Notification** : `{ id, user_id, type, data, read, created_at }`, `data.title` et `data.message` toujours présents.

| `type` | Titre | `data` en plus |
|---|---|---|
| `marketplace_outbid` | 📉 Vous avez été surenchéri | `auction_id, card_id, card_title, new_bid, previous_bid` |
| `marketplace_auction_won` | 🏆 Enchère gagnée ! | `auction_id, card_id, card_title, final_price` |
| `marketplace_auction_sold` | 💰 Carte vendue ! | `auction_id, card_id, card_title, final_price` |
| `marketplace_auction_unsold` | Enchère terminée sans acheteur | `auction_id, card_id, card_title` |
| `marketplace_wishlist_listed` | Carte de votre liste de souhaits | `auction_id, card_id, card_title` |
| `trade_offer` | 🔄 Nouvelle offre d'échange ! | `trade_id, initiator_id, initiator_username` |
| `trade_countered` | ↩️ Contre-offre reçue ! | `trade_id, initiator_id, initiator_username` |
| `chat_message` | 💬 <pseudo> | `sender_id, sender_username` |

## Paquets

| Requête | Réponse |
|---|---|
| `POST /api/packs/verify-human` `{ website: "" }` | `{ pack_human_verified_at }` (champ-piège pour robots) |
| `POST /api/packs/open` | `{ cards: [5 cartes], packs_remaining, packs_last_regen_at, owned_copies }` |
| `GET /api/packs/pro-daily` (en-tête `x-wiki-calendar-tz: <fuseau de l'appareil>`, ex. `Europe/Brussels`) | `{ eligible, claimed_today, claim_date: "AAAA-MM-JJ" }` : `claim_date` est le jour en cours dans ce fuseau, **même non réclamé** (relevé : `{"eligible":true,"claimed_today":false,"claim_date":"2026-09-30"}`) |
| `POST /api/packs/pro-daily` (même en-tête) | `{ cards: [15 cartes], claimed_today: true, eligible: false, claim_date }`, sans `owned_copies` : le site demande ensuite `SB user_cards?select=id,card_id,starred,is_shiny,user_card_tags(tag:tags(*))&user_id=eq.<uid>&card_id=in.(…)` ; 409 `{ error, claim_date }` si déjà réclamé |
| `POST /api/user-cards/<user_card_id>/discard` | `{ balance }` (+1 wikibidou) ; 409 si déjà défaussé |

Carte d'un paquet : champs de la carte (ci-dessous) plus `summary, content_length, rarity_order, in_global_collection, search_document, nsfw_image, nsfw_reviewed_at, …_refreshed_at`.

## Collection et étiquettes

| Requête | Réponse |
|---|---|
| `GET /api/my-collection?sort=&page=&stats=0[&filtres]` | `{ collection: [50 exemplaires], total: null, rarityCounts: {}, tagOptions: [], pendingTradeCardIds }` |
| `GET /api/my-collection/stats?sort=[&filtres]` | `{ total, rarityCounts: { C, PC, R, SR, UR, L }, tagOptions: [étiquette + cardCount] }` |
| `GET SB /rest/v1/tags?select=*&user_id=eq.<uid>&order=name.asc` | `[étiquette]` |
| `POST SB /rest/v1/user_card_tags` `{ user_card_id, tag_id }` | 201, corps vide : étiquette ajoutée à un exemplaire |
| `DELETE SB /rest/v1/user_card_tags?user_card_id=eq.<id>&tag_id=eq.<id>` | étiquette retirée (code du site) |
| `PATCH SB /rest/v1/user_cards?user_id=eq.<uid>&card_id=eq.<card_id>` `{ starred }` | favori mis ou retiré, sur tous les exemplaires de la carte (code du site) |
| `POST SB /rest/v1/tags` `{ user_id, name, color }` | nouvelle étiquette (code du site ; 23505 si le nom existe déjà) ; le script en crée plusieurs d'un coup (`?select=*`, tableau, `Prefer: return=representation` → lignes créées) |
| `POST SB /rest/v1/user_card_tags?on_conflict=user_card_id,tag_id` `[{ user_card_id, tag_id }…]`, `Prefer: resolution=ignore-duplicates, count=exact` | 201, corps vide, `Content-Range: */<ajoutées>` : une étiquette sur toute la sélection (captures du 29/09/2026) ; le script y met toutes les étiquettes choisies |
| `DELETE SB /rest/v1/user_card_tags?tag_id=eq.<id>&user_card_id=in.(…)` (par 100) | retrait d'une étiquette de la sélection (code du site) ; le script retire tout d'un coup (`tag_id=in.(…)`) |
| `POST /api/user-cards/bulk-discard` `{ card_ids: [user_card_id…] }` | `{ discarded_count, failed: [] }` : un exemplaire de chaque carte sélectionnée défaussé ; `{ error }` sinon (code du site) |
| `GET SB /rest/v1/cards?select=summary&id=eq.<card_id>` | `{ summary }` (résumé Wikipédia, parfois `null`) |

- `page` commence à **0**, toujours 50 lignes (`limit`, `per_page`, `pageSize` ignorés) ; une ligne = un exemplaire (`count` : 1).
- `sort` : `rarity` (L → C, puis ajout le plus récent d'abord ; aussi sans `sort`), `name` (A → Z), `starred`, `added` (plus récent d'abord). Toute autre valeur = tri par nom, sans erreur. **Aucun sens de tri** : 15 écritures essayées (`order=desc`, `dir=`, `name_desc`, `-name`, `name.desc`…), toutes ignorées.
- Filtres : `q` (titre ou catégorie), `tag_id`, `untagged=1`, `rarity` (répétable : `rarity=SR&rarity=R` ; rareté de l'**exemplaire**, `snapshot_rarity`, pas celle de la carte aujourd'hui), `owned_by=<pseudo>` (marque `owned_by_peer`), `wishlisted_by=<pseudo>` (liste de souhaits de ce joueur).
- **Une seule étiquette** : `tag_id` répété → seul le premier compte ; `tag_id=A,B` → 0 ligne ; `tag_ids`, `tags`, `exclude_tag_id`, `not_tag_id` ignorés ; `untagged=1` l'emporte sur `tag_id`. Pas de filtre favori ni shiny (`starred=1`, `favorites=1`, `shiny=1`, `is_shiny=1` ignorés).
- `/stats` : `rarityCounts` suit `q`, ignore `rarity` et `untagged` (compteurs de toute la collection), vide avec `tag_id`.

Sonde du 30/09/2026 (`wm.debug.probeCollection()`, lecture seule).

**Supabase en direct** (même sonde) : avec la session du site, les tables de la collection se lisent comme n'importe quelle table PostgREST, filtres et tris compris. Réponses en 0,5 à 1 s, contre 2 à 5 s pour `/api/my-collection`.
- `user_cards` : `id, user_id, card_id, count, starred, obtained_at, is_shiny, snapshot_rarity, snapshot_atk, snapshot_def, snapshot_title, snapshot_category, eff_rarity_order` (colonnes `snapshot_*` et `eff_rarity_order` absentes des lignes de `/api/my-collection`) ; `user_card_tags` : `user_card_id, tag_id` ; `tags` : `id, user_id, name, created_at, color` ; `cards` : champs de la carte plus `summary, content_length, rarity_order, search_document, in_global_collection, nsfw_*, …_refreshed_at`.
- Toute la collection en **une** requête (`limit=5000` → 1 459 lignes sur 1 459, pas de plafond atteint) ; total par `Prefer: count=exact` (`Content-Range`).
- Étiquettes : l'une ou l'autre `select=id,user_card_tags!inner(tag_id)&user_card_tags.tag_id=in.(A,B)` ; toutes `select=id,a:user_card_tags!inner(tag_id),b:user_card_tags!inner(tag_id)&a.tag_id=eq.A&b.tag_id=eq.B` (acceptée ; les deux étiquettes essayées n'avaient aucune carte en commun, résultat à revérifier) ; sans A `select=id,x:user_card_tags(tag_id)&x.tag_id=eq.A&x=is.null` ; sans étiquette `user_card_tags=is.null` (mêmes totaux que le site).
- Rareté `snapshot_rarity=eq.SR` (= filtre du site ; `cards.rarity` en donne moins, la rareté d'une carte évolue) ; recherche `cards!inner(search_document)&cards.search_document=ilike.*olymp*` (= `q` du site).
- Tris dans les deux sens, y compris sur la carte : `order=cards(atk).desc`, `order=cards(rarity_order).asc,obtained_at.asc`, `order=obtained_at.asc`.
- Schéma (`GET SB /rest/v1/`, OpenAPI) : **401**, fermé aux joueurs.

**Exemplaire** : `{ id, card_id, card, tags, count, starred, is_shiny, obtained_at, user_id }`, plus `owned_by_viewer` (collection d'un autre : je la possède aussi) ou `owned_by_peer`. Dans `owned_copies` (ouverture de paquet) : `{ id, card_id, starred, is_shiny, user_card_tags: [{ tag }] }`.
**Carte** : `{ id, wikipedia_title, wikipedia_url, category, rarity, atk, def, q_score, pageviews, image_url, hide_image, lang, created_at }` (+ `is_shiny` dans une annonce).
**Étiquette** : `{ id, name, color, user_id, created_at }`.

## Catalogue et liste de souhaits

| Requête | Réponse |
|---|---|
| `GET /api/cards?page=&sort=[&q=][&rarity=…][&wishlist=1]` | `{ cards: [carte], total, searchHasMore, rarityCounts, friendOwners, ownedCardIds, wishlistCardIds, friendPendingOfferKeys }` (code du site, pas encore vu en capture) |
| `POST SB /rest/v1/wishlist_items` `{ user_id, card_id }` | 201, corps vide : carte ajoutée à la liste de souhaits (23505 si elle y est déjà, ignoré par le site) |
| `DELETE SB /rest/v1/wishlist_items?user_id=eq.<uid>&card_id=eq.<card_id>` | carte retirée de la liste (code du site) |

- Page `/global-collection`. `page` commence à **0**, 50 cartes par page ; `sort` : `rarity`, `name`, `atk`, `def` ; `q` utilisé à partir de 3 caractères (pas de total, `searchHasMore`) ; `wishlist=1` : seulement les cartes de ma liste.
- `friendOwners` : `{ <card_id>: [{ id, username, … }] }`, amis qui possèdent la carte (le premier sert à « Proposer un échange ») ; `friendPendingOfferKeys` : `"<id de l'ami>:<card_id>"` quand une offre est déjà en cours ; `ownedCardIds`, `wishlistCardIds` : identifiants de cartes.

## Marché

| Requête | Réponse |
|---|---|
| `GET /api/marketplace?page=&limit=50&sort=[&rarity=…][&q=][&mine=1]` | `{ auctions: [annonce], page, limit, hasMore }` ; avec `mine=1` en plus `mine: true`, `selling, bidding, won, history` (annonces, détail ci-dessous) et `maxConcurrentAuctions` |
| `GET /api/marketplace/<auctionId>` | `{ auction, bids: [mise] }` |
| `GET /api/marketplace/mine` | `{ sellingCount, maxConcurrentAuctions }` |
| `POST /api/marketplace` `{ card_id: <user_card_id>, base_amount, duration_minutes }` | 201 `{ auction_id }` |
| `POST /api/marketplace/<auctionId>/bid` `{ amount }` | `{ auction_id, current_bid, bidder_balance }` ; refus : `{ error, code: "bid_too_low", min }` ou `code: "insufficient_balance"` |
| `POST /api/marketplace/<auctionId>/settle` | finalise une enchère terminée (code du site) |
| `DELETE /api/marketplace/<auctionId>` | `{ status: "cancelled" }` |
| `GET /api/marketplace/cards/<card_id>/sales` | `{ wikipedia_title, sales: [vente, du plus ancien au plus récent], recent: [10 dernières, du plus récent] }` |
| `GET /api/marketplace/cards/<card_id>/sales?scope=summary` | `{ wikipedia_title, summary: { <rareté>: { average, count, latest } }, isPro }` (comptes PRO) |

- `page` commence à **1** ; `limit` > 50 → `403 { code: "automation_limit" }`. Pas de total.
- `sort` : `recent`, `price_asc`, `price_desc`, `ending_soon`.
- Les onglets du marché n'appellent rien : tout vient de `mine=1`. Pour relire seulement ces listes, le site demande `page=1&limit=1&mine=1`.
- Listes de `mine=1` (relevé du 29/09/2026) : `selling` = mes annonces `active` ; `bidding` = annonces `active` d'autres vendeurs où j'ai misé, que je mène ou non (`current_bidder_id` le dit) ; `won` = les 50 dernières que j'ai gagnées (`settled_sold`, `winner_id` = moi) ; `history` = les 50 dernières de mes ventes terminées (`settled_sold`, `settled_unsold`, `cancelled`). `won` et `history` vont du plus récent au plus ancien.
- `maxConcurrentAuctions` : 5 pour un compte normal, 10 pour un compte PRO.
- Ventes d'une carte : toutes raretés mélangées (`rarity` de l'exemplaire vendu), liste vide pour une carte jamais vendue (`{ wikipedia_title, sales: [], recent: [] }`). Le script les garde en cache (`services/market`, base IndexedDB `wm-market`, magasin `sales`, forme `{ id: <card_id>, fetchedAt, title, sales }`, celle de l'ancien script).

**Annonce** : `id, card_id, card, seller_id, seller, status ("active", "settled_sold", "settled_unsold", "cancelled"), base_amount, listing_base_amount, base_repriced_at, current_bid, current_bidder_id, current_bidder, effective_bid (mise actuelle, sinon de départ), end_at, created_at, settled_at, winner_id, winner, final_price, snapshot_rarity, snapshot_atk, snapshot_def, is_shiny, snapshot_search_document, owned (je possède cette carte)`.
**Mise** : `{ id, auction_id, bidder_id, bidder, amount, placed_at }`.
**Vente** : `{ id, final_price, settled_at, rarity }` (pas d'indication shiny).
**Joueur (résumé)** : `{ id, username, avatar_url, avatar_pos_x, avatar_pos_y }`.

## Échanges

| Requête | Réponse |
|---|---|
| `GET /api/trades?active=1` | `{ trades: [échange] }` |
| `POST /api/trades` `{ recipient_id, items: [{ user_card_id, card_id, offered_by }], initiator_wikibidous, recipient_wikibidous }` | 201 `{ trade }` (`status: "pending"`) ; une contre-offre crée un nouvel échange lié par `parent_trade_id` |
| `PATCH /api/trades/<tradeId>` `{ action: "accept" \| "decline" }` | `{ status: "accepted" \| "declined" }` |

**Échange** : `{ id, status, initiator_id, initiator, recipient_id, recipient, items, initiator_wikibidous, recipient_wikibidous, parent_trade_id, created_at, updated_at }` ; élément : `{ id, trade_id, user_card_id, card_id, card, offered_by, is_shiny, snapshot_rarity, snapshot_atk, snapshot_def }`.

## Joueurs, amis, vitrine, signalements

| Requête | Réponse |
|---|---|
| `GET /api/profile/<pseudo>` | `{ profile: joueur + is_public, created_at, activity_blocked_until, isOwn, isFriend, friendshipId, pendingRequest, lastSeenAt }` |
| `GET /api/profile/<pseudo>/stats` | `{ total }` |
| `GET /api/profile/<pseudo>/showcase` | `{ showcase: [{ position, user_card_id, user_card }], galleries: [{ gallery_index, name }] }` |
| `GET /api/profile/<pseudo>/collection?page=&sort=&stats=1&pending=1[&rarity=…][&wishlisted_by_me=1]` | `{ collection, total, rarityCounts, tagOptions, pendingTradeCardIds, profileId }` ; exemplaires avec `owned_by_viewer` |
| `GET /api/showcase` / `PUT /api/showcase` `{ position, user_card_id }` / `DELETE /api/showcase` `{ position }` | sa propre vitrine ; `{ ok }` |
| `GET /api/friends` | `{ friendships: [{ id, status, requester, addressee, … }], counts: { accepted, incoming, outgoing } }` |
| `GET /api/friends/search?q=` | `{ users: [joueur] }` |
| `POST /api/friends` `{ addressee_id }` | 201 `{ friendship }` (`status: "pending"`) |
| `DELETE /api/friends/<friendshipId>` | `{ success }` (retirer un ami, annuler une demande) |
| `POST /api/reports` `{ reportedUserId, reason, details }` | `{ ok }` |
| `GET /api/reports?reportedUserId=<uid>` | `{ report: { reason, details, created_at } }` : son signalement déjà fait sur ce joueur |

## Session

| Requête | Réponse |
|---|---|
| `POST SB /auth/v1/token?grant_type=refresh_token` `{ refresh_token }` | nouveau jeton (toutes les heures) |
| `GET SB /auth/v1/.well-known/jwks.json` | clés publiques de vérification des jetons |

Le jeton de session et la clé publique se lisent au passage dans les requêtes Supabase du site (`net.observe`) ; le `sub` du jeton est l'`uid`.
