# Messages (`/dms`) et conversation privée

Liste des conversations, conversation ouverte en modale. Dates en jj/mm (2026). Routes : [api.md](../api.md#messages). Chat de guilde (même balisage) : [guild.md](guild.md#chat).

## Page /dms

_Relevé : captures du 29/09._

```
main > div.flex-1.p-4.md:p-6.space-y-6
  div (h1 « Messages », sous-titre)
  div.space-y-1 (une ligne par conversation de GET /api/chat)
    button.w-full.text-left
      div.relative (photo ou initiales)
      div.flex-1.min-w-0 > div > p.font-medium (pseudo) + span (heure) ; p (dernier message)
```

- Une ligne ouvre la conversation en modale.
- Liste tenue à jour par le canal `dms-list:<uid>` tant que la page est affichée ([README](README.md#temps-réel)).
- Lecture : `src/site/dms/page.ts` (`findDmsPage`, `dmsRowAt`).

## Conversation

_Relevé : captures du 29/09._

```
div.fixed.inset-0.z-50 (fond)
  div.card-frame.flex.flex-col (cadre, sm:max-w-md sm:h-[600px] ; feuille en bas sur mobile)
    div.flex.items-center.gap-3.border-b (en-tête)
      div.rounded-full w-9 h-9 (photo : img[alt=pseudo], sinon initiales en span)
      div.flex-1.min-w-0 > p.font-semibold (pseudo, peer_username de /api/chat)
      button « Fermer » (aria-label)
    div.flex-1.overflow-y-auto (messages, échanges)
    barre du message
```

- Ouverture : `GET /api/chat/<peer_id>`. Envoi : `POST /api/chat/<peer_id>` ; barre du message : champ `py-2 text-sm rounded-xl`, bouton `aria-label="Envoyer"` (`p-2.5`, 36 px), rangée `items-center`.
- Ouverte, elle suit ses canaux temps réel (`chat:<ami>:<uid>`, `chat-trades:<ami>:<uid>`) ; à sa fermeture, le site les quitte et relit la liste (`GET /api/chat`).
- Échanges en encarts (« Échange », état, « Détails »).
- Le même composant sert hors de /dms (fenêtre « Message » de la page Amis).
- Aucun lien vers le profil (ni pseudo, ni photo).
- Lecture : `src/site/dms/chat.ts` (`findChatWindows`).

## Messages

_Relevé : code du site du 29/09 ; chat de guilde : 01/10._

```
div.flex-1.overflow-y-auto (liste)
  div (un jour)
    div.flex.items-center.my-3 (séparateur « 19 sept. »)
    div.flex.justify-center (échange, annonce de la guilde)
    div.group.mb-1.5 (message, clé React = id du message)
      div.mb-0.5.flex.gap-2 (chat de guilde, messages des autres : cale h-8 w-8, puis pseudo)
      div.flex.items-end.flex-row (d'un autre) | .flex-row-reverse (de soi)
        div.rounded-full (photo de l'auteur, h-8 w-8 ; absente sur ses propres messages)
        div.rounded-2xl (bulle : rounded-bl-sm d'un autre, rounded-br-sm de soi)
      div.mt-0.5 (heure « 02:17 », visible au survol, place gardée)
```

- Messages et échanges triés ensemble par `created_at`, puis groupés par jour (`toLocaleDateString` : « 19 sept. »). Aucune notion de groupe entre messages : chaque message a sa photo.
- L'heure affichée n'a que la minute ; la date exacte (`created_at`) se lit dans l'état React de la conversation.
- État : composant `{ peer, currentUserId, onClose }`, états messages, échanges… Un message reçu par le temps réel y est ajouté tel quel (`payload.new`, avec `created_at`) ; un message envoyé l'est à la réponse du `POST`.
- Lecture : `src/site/dms/messages.ts` (`findChatList`, `readChatDays`, `readChatMessageDates` ; `CHAT_ROW_DATA` : attributs des lignes de la conversation de guilde du script).

## Dans le script

`dms-layout` (conversation posée à droite de la liste), `dms-groups` (messages groupés), `guild-chat` (conversation de guilde épinglée, `GUILD_CHAT_CLASS`), `player-links` (pseudo et photos en liens). Détail : section « Messages » de [features.md](../features.md).
