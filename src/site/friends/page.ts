import { ROOT_CLASS } from '@/core/dom';
import { textOf } from '@/core/text';
import { hasIcon, siteButtons } from '@/site/dom';

/**
 * Page Amis (`/friends`, captures du 29/09 et du 01/10/2026, code du site du 30/09 et du 01/10/2026) :
 *
 *   main › div.flex-1.p-4.md:p-6.space-y-6
 *     div.flex.items-center.justify-between › h1 « Amis », div.flex.items-center.gap-2
 *       button « Inviter » (lucide `link-2`) : partage du lien d'inscription (`navigator.share`), sinon copie,
 *         alors lucide `check` + « Copié ! » pendant 2 s
 *       button › span « + », « Rechercher un joueur » : ouvre la fenêtre du même nom
 *     [div.space-y-3 : « Demandes reçues (n) » (titre dans un div avec « Tout accepter », lucide `check-check`,
 *       dès deux demandes : `POST /api/friends/accept-all`, désactivé et « Acceptation… » jusqu'à la relecture),
 *       lignes teintées accent (`bg-[var(--color-accent)]/5` et trait) : photo, p pseudo, div › Accepter (lucide
 *       `check`) / Refuser (lucide `x`) : `PATCH /api/friends/<id>` `{ action: "accept" | "decline" }` puis
 *       relecture, sans état « en cours », réponse non lue]
 *     div.space-y-3 › h2 « Amis (n) »
 *       div.relative › label, input#friend-list-search, [button « Effacer la recherche » en absolute]   s'il a des amis
 *       lignes : div.flex.items-center.gap-3.p-3 › a[href="/profile/<pseudo>"] (photo, pseudo), div d'actions ›
 *         span (cible tactile) › button[title="Envoyer un message"] (lucide `message-circle`, « Message »),
 *         idem [title="Proposer un échange"] (lucide `handshake`, « Échanger »), [« Défier » : administrateurs]
 *       (les fenêtres Message et Échanger d'une ligne sont rendues juste après elle, en `fixed`)
 *       sinon div.card-frame.p-8.text-center.space-y-3 › icône (lucide `users`), p « Vous n'avez pas encore
 *         d'amis. », button.mt-2 « Rechercher des joueurs » (même fenêtre que celui de l'en-tête) ;
 *       ou p « Aucun résultat pour « … » »
 *     [div.space-y-3 › h2 « Demandes envoyées (n) », lignes : initiales, p pseudo, « En attente »,
 *       button « Annuler » (`DELETE /api/friends/<id>`, puis relecture `GET /api/friends`)]
 *     [fenêtre « Rechercher un joueur » (`player-search.ts`)]
 */
export interface FriendsPage {
  readonly header: FriendsHeader | undefined;
  readonly list: FriendsList | undefined;
  /** Sections des demandes en attente affichées (reçues, envoyées). */
  readonly requests: readonly HTMLElement[];
  readonly received: ReceivedRequests | undefined;
  readonly sent: readonly SentRequest[];
}

export interface FriendsHeader {
  /** Rangée des deux boutons, à droite du titre. */
  readonly actions: HTMLElement;
  readonly invite: HTMLButtonElement | undefined;
  /** « Rechercher un joueur » (ou le nom qu'on lui a donné). */
  readonly add: HTMLButtonElement | undefined;
}

export interface FriendsList {
  readonly section: HTMLElement;
  /** Cadre du champ de recherche (absent sans amis). */
  readonly search: HTMLElement | undefined;
  /** Cadre « Vous n'avez pas encore d'amis. » (sans amis seulement). */
  readonly empty: EmptyFriends | undefined;
  readonly rows: readonly FriendRow[];
}

export interface EmptyFriends {
  readonly frame: HTMLElement;
  /** « Rechercher des joueurs » : ouvre la fenêtre « Rechercher un joueur », comme le bouton de l'en-tête. */
  readonly search: HTMLButtonElement;
}

export interface FriendRow {
  readonly root: HTMLElement;
  readonly actions: HTMLElement;
  readonly message: RowButton | undefined;
  readonly trade: RowButton | undefined;
}

export interface RowButton {
  readonly button: HTMLButtonElement;
  /** Ce qui le porte dans la rangée d'actions (sa cible tactile), à masquer avec lui. */
  readonly slot: HTMLElement;
}

export interface ReceivedRequests {
  /** « Tout accepter » (affiché dès deux demandes). */
  readonly acceptAll: HTMLButtonElement | undefined;
  readonly rows: readonly ReceivedRequest[];
}

export interface ReceivedRequest {
  readonly root: HTMLElement;
  /** Rangée des deux boutons. */
  readonly actions: HTMLElement;
  readonly accept: HTMLButtonElement;
  readonly decline: HTMLButtonElement;
}

export interface SentRequest {
  readonly root: HTMLElement;
  readonly cancel: HTMLButtonElement;
}

const children = (element: Element) =>
  [...element.children].filter((child): child is HTMLElement => child instanceof HTMLElement && !child.classList.contains(ROOT_CLASS));

/** Titre d'une section de la page : `h2` direct, ou dans l'en-tête des demandes reçues. */
const sectionTitle = (section: Element) => textOf(section.querySelector(':scope > h2, :scope > div > h2'));

function rowButton(actions: HTMLElement, icon: string): RowButton | undefined {
  const button = siteButtons(actions).find((candidate) => hasIcon(candidate, icon));
  if (!button) return undefined;
  const parent = button.parentElement;
  return { button, slot: parent && parent !== actions ? parent : button };
}

function readHeader(header: HTMLElement): FriendsHeader | undefined {
  const actions = children(header).find((child) => child.tagName === 'DIV' && child.querySelector('button'));
  if (!actions) return undefined;
  const buttons = children(actions).filter((child): child is HTMLButtonElement => child instanceof HTMLButtonElement);
  const add = buttons.find((button) => textOf(button.querySelector(':scope > span:first-child')) === '+');
  return { actions, invite: buttons.find((button) => button !== add), add };
}

function readList(section: HTMLElement): FriendsList {
  const field = section.querySelector('#friend-list-search');
  const search = field?.parentElement?.parentElement === section ? field.parentElement : undefined;
  const rows: FriendRow[] = [];
  for (const root of children(section)) {
    if (!root.querySelector(':scope > a[href^="/profile/"]')) continue;
    const actions = root.lastElementChild;
    if (!(actions instanceof HTMLElement) || actions.tagName !== 'DIV') continue;
    rows.push({ root, actions, message: rowButton(actions, 'message-circle'), trade: rowButton(actions, 'handshake') });
  }
  const frame = section.querySelector<HTMLElement>(':scope > .card-frame');
  const button = frame?.querySelector<HTMLButtonElement>(':scope > button');
  return { section, search, empty: frame && button ? { frame, search: button } : undefined, rows };
}

/** Bouton enfant direct de `parent`, reconnu à son icône. */
const iconButton = (parent: Element, icon: string) =>
  [...parent.querySelectorAll<HTMLButtonElement>(':scope > button')].find((button) => hasIcon(button, icon));

function readReceived(section: HTMLElement): ReceivedRequests {
  const header = section.querySelector(':scope > div:has(> h2)');
  const rows: ReceivedRequest[] = [];
  for (const root of children(section)) {
    const actions = root.querySelector<HTMLElement>(':scope > div:has(> button)');
    const accept = actions && iconButton(actions, 'check');
    const decline = actions && iconButton(actions, 'x');
    if (actions && accept && decline) rows.push({ root, actions, accept, decline });
  }
  return { acceptAll: header ? iconButton(header, 'check-check') : undefined, rows };
}

function readSent(section: HTMLElement): SentRequest[] {
  const sent: SentRequest[] = [];
  for (const root of children(section)) {
    const cancel = root.querySelector<HTMLButtonElement>(':scope > button');
    if (cancel) sent.push({ root, cancel });
  }
  return sent;
}

export function findFriendsPage(doc: Document = document): FriendsPage | undefined {
  const title = [...doc.querySelectorAll('main h1')].find((h1) => textOf(h1) === 'Amis');
  const header = title?.parentElement;
  const page = header?.parentElement;
  if (!header || !page) return undefined;
  let list: FriendsList | undefined;
  let received: ReceivedRequests | undefined;
  let sent: SentRequest[] = [];
  const requests: HTMLElement[] = [];
  for (const section of children(page)) {
    const name = sectionTitle(section);
    if (/^Amis\b/.test(name)) list = readList(section);
    else if (/^Demandes reçues\b/.test(name)) {
      requests.push(section);
      received = readReceived(section);
    }
    else if (/^Demandes envoyées\b/.test(name)) {
      requests.push(section);
      sent = readSent(section);
    }
  }
  return { header: readHeader(header), list, requests, received, sent };
}
