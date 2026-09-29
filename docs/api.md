# API du site

Routes observées le 29/09/2026 (captures et code du site). Aucune n'est documentée par le site : relevé, pas contrat. `SB` = Supabase (`https://<projet>.supabase.co`, en-têtes `apikey` + `Authorization: Bearer <jeton>` ajoutés par le site). Contexte et règles d'usage : [`site.md`](site.md).

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
| `POST SB /rest/v1/tags` `{ user_id, name, color }` | nouvelle étiquette (code du site ; 23505 si le nom existe déjà) |
| `GET SB /rest/v1/cards?select=summary&id=eq.<card_id>` | `{ summary }` (résumé Wikipédia, parfois `null`) |

- `page` commence à **0** ; `sort` : `rarity`, `name`, `starred`, `added`.
- Filtres : `q` (titre ou catégorie), `tag_id`, `untagged=1`, `rarity` (répétable : `rarity=SR&rarity=R`), `owned_by=<pseudo>` (marque `owned_by_peer`), `wishlisted_by=<pseudo>` (liste de souhaits de ce joueur).

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
