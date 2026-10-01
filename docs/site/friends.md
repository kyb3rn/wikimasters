# Amis (`/friends`)

Amis, demandes reçues et envoyées, recherche de joueurs. Dates en jj/mm (2026). Routes : [api.md](../api.md#joueurs-amis-vitrine-signalements).

## Page

_Relevé : captures du 29/09, code du site du 30/09._

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
    sinon card-frame « Vous n'avez pas encore d'amis. », ou p « Aucun résultat pour « … » »
  [div.space-y-3 › h2 « Demandes envoyées (n) », lignes : initiales, p pseudo, « En attente », button « Annuler »]
  [fenêtre « Rechercher un joueur »]
```

- « Inviter » : lien d'inscription partagé par `navigator.share`, sinon copié (lucide `check` + « Copié ! » pendant 2 s).
- « Rechercher un joueur » : fenêtre du même nom (`card-frame max-w-md p-6`), recherche à partir de 2 caractères (`GET /api/friends/search?q=`), « Ajouter » envoie `POST /api/friends` `{ addressee_id }`.
- Demandes reçues : lignes `bg-[var(--color-accent)]/5`, trait `/20`. « Tout accepter » dès deux demandes.
- Amis : le champ filtre sur place ; textes des boutons `hidden sm:inline`. Les fenêtres Message et Échanger d'une ligne sont rendues juste après elle, en `fixed`. **Aucun moyen d'y retirer un ami** (seulement depuis son profil).
- Demandes envoyées : « Annuler » en petit texte gris.
- Lecture : `src/site/friends/page.ts` (`findFriendsPage` ; boutons reconnus à leur icône).

## Données et relecture

_Relevé : code du site, 30/09 ; captures du 29 et 30/09._

- Tout est chargé d'un coup : `GET /api/friends` sans paramètre, sans pagination. Le titre « Amis (n) » vient des compteurs (`counts`), les lignes de la liste (`friendships`).
- Après chacune de ses actions, la page relit tout (`GET /api/friends`), **sans regarder la réponse de l'action** et **sans état « en cours »** :
  - Accepter / Refuser : `PATCH /api/friends/<id>` `{ action: "accept" | "decline" }`. Capture du 30/09 : acceptation en 5,3 s, puis relecture en 500 : la demande reste affichée, rien ne l'explique.
  - « Tout accepter » : `POST /api/friends/accept-all` ; désactivé et « Acceptation… » jusqu'à la fin de la relecture.
  - « Annuler » : `DELETE /api/friends/<id>`.
  - « Ajouter » de « Rechercher un joueur » : `POST /api/friends` (réponse non lue).
- Le temps réel des amitiés est refusé par le serveur ([README](README.md#temps-réel)) : la page ne se relit qu'après ses propres actions.

## États de la page

_Relevé : code du site, 30/09._

- Amitiés (`friendships` de `GET /api/friends`, avec `requester_id`, `addressee_id`) et compteurs (`counts`).
- Ligne d'ami : composant `{ friendId, username, … }`, de clé React = id de l'amitié.
- Le joueur connecté est le seul présent dans toutes les amitiés (indéterminé avec une seule).
- Lecture : `src/site/friends/state.ts` (`readFriendsData`, `readFriendRow`, `friendsOwner`, `applyFriendsChange`, `dropFriendship`).

## Dans le script

`friends-layout` (page refaite ; relectures servies sans réseau par `refresh.ts`) ; service `friends`. Détail : section « Amis » de [features.md](../features.md).
