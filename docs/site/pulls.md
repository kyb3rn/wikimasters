# Paquets (`/pulls`)

Page d'accueil du site : ouverture des paquets, pack PRO du jour, cartes du paquet ouvert. Dates en jj/mm (2026). Routes : [api.md](../api.md#paquets). Face, modale de carte, mise aux enchères, défausse : [README](README.md#modale-de-carte).

## Mise en page

_Relevé : code du site, 29/09._

- `<main>` n'est pas flex ([README](README.md#chargement-dune-page)). Son unique enfant `div.flex-1` : choix du paquet `flex flex-col items-center justify-center`, ou carrousel `flex items-start md:items-center justify-center`. Le centrage vertical voulu ne se fait pas : l'enfant n'a que la hauteur de son contenu, en haut de la page.
- Titre `div.text-center.animate-fade-in-up` (animation `forwards` : un `transform` reste une fois finie) : `h1` « Ouvrir un paquet », lien « Comment ça marche ? », encart de vérification humaine.
- Choix du paquet, de haut en bas : bouton « Ouvrir », cadre des paquets disponibles, cadre du pack PRO du jour.

## Bouton « Ouvrir »

_Relevé : code du site, 29/09._

```
button.relative.flex.flex-col.items-center.justify-center.gap-4
  img (/card_pack.png par /_next/image, object-contain dans un carré w-64 h-64 md:w-72 md:h-72)
  span « Ouvrir » (« Ouverture... » pendant l'ouverture)
```

- L'image (2550 × 3300) a 12 % de vide transparent en haut et en bas : le texte paraît loin du paquet.
- Désactivé pendant l'ouverture, sans paquet, sous sanction ou en attente de vérification humaine ; sinon `hover:scale-105 hover:-translate-y-2`, `transition-all duration-300`.
- Ouverture : `POST /api/packs/open` (5 cartes). Le clic débloque aussi l'audio ([Sons](#sons)).
- Lecture : `src/site/pulls/pack-button.ts` (`findPackButton`).

## Paquets disponibles

_Relevé : code du site, 29/09._

```
div.card-frame.px-6.py-3.flex.flex-col.items-center.gap-1.text-center
  div.text-lg.font-bold > span (accent) n · span « / 10 »
  div.text-xs « paquets disponibles »
  div.text-xs « Prochain dans » span.font-mono « m:ss »    (absent quand plein)
```

- `n` = `packs_remaining` ; « / 10 » est écrit en dur.
- « m:ss » est réécrit chaque seconde en texte seul, sans autre changement du DOM.
- À 0 : bouton d'achat (non PRO) ou « Implorer la grâce des dieux du Wiki » (V.I.P.).
- Plafond 10, un paquet de plus toutes les 3 minutes, calé sur `packs_last_regen_at` du serveur (relevé : 03:10:26, 03:13:26, 03:16:26) ; le site appelle alors `sync_profile_packs`.
- Lecture : `src/site/pulls/counter.ts` (`findPackCounter`).

## Pack PRO du jour

_Relevé : code et captures du site, 30/09._

- 15 cartes (relevé sur un paquet : 5 PC, 5 R, 3 SR, 1 UR, 1 L, dans cet ordre), une fois par jour **calendaire de l'appareil** (fuseau envoyé en en-tête `x-wiki-calendar-tz`). Comptes PRO seulement (`profile.is_pro`) ; caché pendant une vérification humaine.
- Cadre en bas de la colonne, selon les états de la page :

```
div.w-full.max-w-sm.animate-fade-in-up.rounded-xl.border.border-violet-500/25.bg-violet-950/20.px-4.py-3.flex.flex-col.gap-2
  p « Pack PRO du jour »
  disponible     button « Ouvrir le pack PRO du jour » (« Ouverture… », désactivé pendant l'ouverture)
  déjà réclamé   p « Déjà réclamé aujourd’hui (heure de ton appareil). Reviens demain ! »
  sinon          rien
```

- « Rien » : réponse pas encore reçue, ou en échec (`if (!ok) return` : ni message, ni nouvel essai).
- État demandé par `GET /api/packs/pro-daily` à l'arrivée (après `sync_profile_packs`) et après chaque paquet refermé, **sauf** si `localStorage['wikimasters:pro-daily-claimed']` (`{ userId, date }`, écrit à chaque réponse « réclamé ») porte la date du jour : réclamé d'office. Passé minuit, rien ne se met à jour tant qu'on ne recharge pas la page.
- États de la page (hooks `useState` du composant de /pulls, le premier état est le profil, `packs_remaining`…) : …, plateforme (`"web"`, `"ios"`, `"android"`), disponible, déjà réclamé, ouverture en cours (booléens), … Les compter depuis le début ne tient pas (d'autres hooks les précèdent peut-être). Les changer fait redessiner le cadre comme la réponse du site.
- Ouverture : `POST /api/packs/pro-daily` (409 = déjà réclamé), réponse sans `owned_copies` ([Exemplaire de chaque carte](#exemplaire-de-chaque-carte)).
- Lecture : `src/site/pulls/pro-pack.ts` (`findProPack`, `findProDailyStates`, `proClaimDate`, `isProDailyStatus`), `fetchProDaily`.

## Vérification humaine

_Relevé : code du site, 29/09._

- Demandée quand la dernière (`pack_human_verified_at`) a plus de 12 h, ou quand `POST /api/packs/open` répond `human_verification_required` ; « Ouvrir » reste désactivé en attendant.
- Encart « Vérification rapide » dans le titre animé, sous le `h1` :

```
div.relative.mx-auto.max-w-lg…
  label (hors écran) > input[name=website]   champ-piège pour robots, laissé vide
  p « Vérification rapide » · p (explication)
  label > input[type=checkbox] + span « Je ne suis pas un robot »
  button « Continuer » (« Enregistrement... » pendant l'envoi, désactivé tant que la case est vide)
```

- Envoi : `POST /api/packs/verify-human` `{ website: "" }`. Aucun contrôle côté page (`isTrusted`, délai…).
- Erreur : message du site (ou « Erreur réseau. Réessayez. ») hors de l'encart, plus bas, sous le cadre des paquets.
- Lecture : `src/site/pulls/human-check.ts` (`findHumanCheck`, `isHumanCheckSubmit`).

## « Comment ça marche ? »

_Relevé : code du site, 29/09._

- Lien sous le titre. Portail `div.fixed.inset-0.z-50 … bg-black/70` dans `body`, `div.card-frame` (ni `relative`, ni croix) : `h2`, raretés selon les vues mensuelles, paquets, puis bouton « Compris ! ».
- Fermée par un clic sur le fond (le cadre arrête le clic) ou « Compris ! », pas par Échap.

## Carrousel du paquet ouvert

_Relevé : code du site et captures, 29/09._

```
div.flex.flex-col (racine)
  div.flex.items-center.gap-2        « Carte n / N »
  div.relative.inline-flex           zone de la carte : enveloppe animée (animate-card-flip…, recréée à chaque carte)
                                     › face (taille lg) ; cadre animate-pulse tant que les images chargent
  div.flex.items-center.gap-4        navigation
    button.w-12.h-12.rounded-full    précédente (désactivée sur la première)
    div.flex.items-center.gap-2      une pastille par carte, l'active porte scale-125
    button.w-12.h-12.rounded-full    suivante (désactivée sur la dernière)
  button « Encore n cartes » (désactivé) / « Continuer »
```

- Composant aux props `{ cards, ownedCopies, onDone }`, lisibles dans l'état React de sa racine : `is_shiny` y est vrai dès l'ouverture, avant que la face ne montre le shiny.
- Il attend d'avoir chargé **toutes** les images du paquet avant d'afficher la première carte.
- État : carte affichée et **cartes vues** (la première l'est d'office). « Continuer » s'active quand toutes l'ont été ; `onDone` ferme le carrousel.
- Changer de carte : flèches, pastilles, ou glissement au pointeur (≥ 48 px) sur la carte. Aucun raccourci clavier.
- Animation : face recréée à chaque carte dans une enveloppe `animate-card-flip…` (0,6 s, `ease-out`) ; pour une L, `…-legendary` : **3,2 s** `ease-in-out`, de 92° de rotation, 90 % de taille et transparente jusqu'à la face. Sons `card-flip`, plus `legendary-reveal` sur une L.
- À la fin de l'animation d'une L : feu d'artifice en portail (`div.fixed.inset-0.z-[200]`, `pointer-events-none`, particules `animate-card-reveal-firework-*`). Ce n'est pas une modale.
- L shiny : la face s'affiche d'abord **sans** son habillage shiny, balayage `shiny-reveal-sweep`, puis face shiny 350 ms après (retenue ensuite ; annulée si on change de carte avant).
- Clic sur la face (`onClick` de son élément `[class*="glow-"]`) : modale de carte.
- **Piège du clic perdu** : un glissement qui change de carte arme un drapeau (ref) qui fait ignorer le **prochain** clic sur la carte. La face étant recréée, le clic qui termine le glissement ne l'atteint pas : c'est le clic suivant, de l'utilisateur ou du script, qui est perdu.
- Lecture : `src/site/pulls/carousel.ts` (`findCarousel`, `carouselCards`).

## Exemplaire de chaque carte

_Relevé : code du site, 29/09._

- `POST /api/packs/open` rend les cartes (`cards`) et les exemplaires possédés (`owned_copies` : `{ id, card_id, starred, is_shiny, user_card_tags }`). Le pack PRO ne rend pas `owned_copies` : le site les demande ensuite à Supabase (`user_cards?…&card_id=in.(…)`, [api.md](../api.md#paquets)).
- Exemplaire associé à chaque carte, donc celui que défausse ou met en vente la modale : le premier dont l'état shiny est celui de la carte tirée, sinon le premier tout court.
- La page garde ces exemplaires en mémoire : après une défausse faite hors de sa modale (par le script), défausser la même carte par la modale du site donne un 409.
- Favori et étiquettes changés dans la modale : requêtes Supabase (`readStarChange`, `readTagAdded`, `readTagRemoved`).
- Lecture : `src/site/pulls/pack.ts` (`isPackOpening`, `isCopiesQuery`, `parsePack`, `copiesByCard`).

## Sons

_Relevé : code du site, 29/09._

- Web Audio, pas de balise `<audio>` : `/audio/pack-rip.mp3` (ouverture d'un paquet), `/audio/card-flip.mp3` (changement de carte, dans les deux sens), `/audio/legendary-reveal.mp3` (arrivée sur une L, et à l'ouverture si la première carte en est une).
- Préchargés et décodés (`fetch`, `decodeAudioData`), joués par `AudioBufferSourceNode.start` ; un son pas encore chargé est abandonné s'il arrive plus de 250 ms après la demande. /pulls précharge les trois dès son affichage ; « Ouvrir » débloque l'audio (`unlockSounds` du site, geste de l'utilisateur).
- Coupure : `localStorage['wiki-masters-sound'] = 'off'`, lu **une fois par chargement** (le changer n'agit qu'au rechargement).
- Lecture : `src/site/sound.ts` (`SITE_SOUNDS`, `isSiteSoundOff`, `enableSiteSound`) ; sons reconnus à leur fichier par `trackSounds` (`src/core/audio.ts`).

## Dans le script

`pulls-center`, `pulls-bar`, `pulls-pro`, `pulls-human-check`, `pulls-open-label`, `pulls-remaining`, `pulls-sound`, `pulls-grid`, `pulls-keyboard`, `pulls-discard`, `pulls-auction` ; services `pulls-pack`, `pulls-grid`, `pulls-sound`. Détail : section « Paquets » de [features.md](../features.md).
