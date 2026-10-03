# Amis (`/friends`)

Amis, demandes reçues et envoyées, recherche de joueurs. Dates en jj/mm (2026). Routes : [api.md](../api.md#joueurs-amis-vitrine-signalements).

## Page

_Relevé : captures du 29/09 et du 01/10, code du site du 30/09 et du 01/10._

```
main › div.flex-1.p-4.md:p-6.space-y-6
  div.flex.items-center.justify-between › h1 « Amis », div.flex.items-center.gap-2
    button « Inviter » (lucide link-2)
    button › span « + », « Rechercher un joueur »
  [div.space-y-3 : « Demandes reçues (n) » (titre dans un div avec « Tout accepter », lucide check-check),
    lignes teintées accent : photo, p pseudo, div › Accepter (lucide check) / Refuser (lucide x)]
  div.space-y-3 › h2 « Amis (n) »
    div.relative › label, input#friend-list-search, [button « Effacer la recherche » en absolute]   s'il a des amis
    lignes : div.flex.items-center.gap-3.p-3 › a[href="/profile/<pseudo>"] (photo, pseudo), div d'actions ›
      span (cible tactile) › button[title="Envoyer un message"] (lucide message-circle, « Message »),
      idem [title="Proposer un échange"] (lucide handshake, « Échanger »), [« Défier » : administrateurs]
    sinon div.card-frame.p-8.text-center.space-y-3 › icône (lucide users), p « Vous n'avez pas encore d'amis. »,
      button.mt-2 « Rechercher des joueurs » (même fenêtre que celui de l'en-tête) ; ou p « Aucun résultat pour « … » »
  [div.space-y-3 › h2 « Demandes envoyées (n) », lignes : initiales, p pseudo, « En attente », button « Annuler »]
  [fenêtre « Rechercher un joueur »]
```

- « Inviter » : lien d'inscription partagé par `navigator.share`, sinon copié (lucide `check` + « Copié ! » pendant 2 s).
- « Rechercher un joueur » : voir [Fenêtre « Rechercher un joueur »](#fenêtre--rechercher-un-joueur-).
- Sans amis : ni recherche ni lignes, le cadre « Vous n'avez pas encore d'amis. » et son bouton « Rechercher des joueurs » ; les boutons de l'en-tête restent les seuls « Inviter » (capture du 01/10 : ils passent sous le cadre du solde).
- Demandes reçues : lignes `bg-[var(--color-accent)]/5`, trait `/20`. « Tout accepter » dès deux demandes.
- Amis : le champ filtre sur place ; textes des boutons `hidden sm:inline`. Les fenêtres Message et Échanger d'une ligne sont rendues juste après elle, en `fixed`. **Aucun moyen d'y retirer un ami** (seulement depuis son profil).
- Demandes envoyées : « Annuler » en petit texte gris.
- Lecture : `src/site/friends/page.ts` (`findFriendsPage` ; boutons reconnus à leur icône).

## Fenêtre « Rechercher un joueur »

_Relevé : code du site du 01/10 ; capture du 01/10 (fenêtre fermée)._

```
div.fixed.inset-0.z-50.bg-black/70.backdrop-blur-sm (fond, ferme) › div.card-frame.w-full.max-w-md.p-6
  div.flex.items-center.justify-between.mb-5 › h2 « Rechercher un joueur », button[aria-label="Fermer"] (lucide x)
  input « Nom d'utilisateur... »
  div.mt-4.h-[220px].overflow-y-auto.space-y-2 › [roue], [p message], lignes :
    div.flex.items-center.gap-3.p-2.5.rounded-lg › photo (w-9 h-9), span pseudo,
      [button « Signaler <pseudo> » (lucide flag)], button « Ajouter » / « ... » / « Demande envoyée » / « Déjà amis » / « Demande reçue »
  [fenêtre « Signaler »]
```

- Rendue en fin de page (pas de portail), par « Rechercher un joueur » (en-tête) ou « Rechercher des joueurs » (liste vide). Focus sur le champ à l'ouverture.
- Recherche **350 ms après la dernière frappe**, dès 2 caractères sans les espaces du bout ; le texte part **tel quel** (`GET /api/friends/search?q=`, espaces compris). Capture du 01/10 : 10 joueurs pour « ed » (limite probable). Rien n'est retenu entre deux ouvertures.
- Pendant la recherche : roue au-dessus des résultats précédents (gardés) ; puis « Aucun joueur trouvé » ou les lignes ; moins de 2 caractères : « Entrez au moins 2 caractères… », résultats vidés.
- Libellé d'une ligne d'après les amitiés de la page : « Déjà amis », « Demande envoyée », « Demande reçue » (désactivés), sinon « Ajouter » (`POST /api/friends` `{ addressee_id }`, « ... » pendant l'envoi, puis relecture de la page). Pas de « Signaler » sur soi-même.
- Lecture : `src/site/friends/player-search.ts` (`findPlayerSearch`).

## Données et relecture

_Relevé : code du site, 30/09 ; captures du 29 et 30/09._

- Tout est chargé d'un coup : `GET /api/friends` sans paramètre, sans pagination. Le titre « Amis (n) » vient des compteurs (`counts`), les lignes de la liste (`friendships`).
- Après chacune de ses actions, la page relit tout (`GET /api/friends`), **sans regarder la réponse de l'action** et **sans état « en cours »** :
  - Accepter / Refuser : `PATCH /api/friends/<id>` `{ action: "accept" | "decline" }`. Capture du 30/09 : acceptation en 5,3 s, puis relecture en 500 : la demande reste affichée, rien ne l'explique.
  - « Tout accepter » : `POST /api/friends/accept-all` ; désactivé et « Acceptation… » jusqu'à la fin de la relecture.
  - « Annuler » : `DELETE /api/friends/<id>`.
  - « Ajouter » de « Rechercher un joueur » : `POST /api/friends` (réponse non lue).
- Le temps réel des amitiés est refusé par le serveur ([README](README.md#temps-réel)) : la page ne se relit qu'après ses propres actions. Une demande acceptée ou refusée depuis une notification du script est reportée dans ses états (`changeFriendsPage`).
- Notification d'une demande reçue (`friend_request`) : `requester_id`, `requester_username`, pas l'id de l'amitié, qu'il faut lire dans `GET /api/friends` (ou `friendshipId` de `GET /api/profile/<pseudo>`) avant de répondre.

## États de la page

_Relevé : code du site, 30/09._

- Amitiés (`friendships` de `GET /api/friends`, avec `requester_id`, `addressee_id`) et compteurs (`counts`).
- Ligne d'ami : composant `{ friendId, username, … }`, de clé React = id de l'amitié.
- Le joueur connecté est le seul présent dans toutes les amitiés (indéterminé avec une seule).
- Lecture : `src/site/friends/state.ts` (`readFriendsData`, `readFriendRow`, `friendsOwner`, `applyFriendsChange`, `dropFriendship`).

## Dans le script

`friends-layout` (page refaite ; relectures servies sans réseau par `refresh.ts`), `player-search` (fenêtre « Rechercher un joueur ») ; service `friends` ; `notifications` (Accepter / Refuser d'une demande reçue, page mise à jour). Détail : section « Amis » de [features.md](../features.md).
