export type Transport = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Description d'une requête, commune aux requêtes du site et aux nôtres. */
export interface NetRequest {
  readonly url: URL;
  /** En majuscules. */
  readonly method: string;
  readonly headers: Headers;
  /** Corps passé à fetch s'il est textuel, sinon `undefined`. */
  readonly body: string | undefined;
  /** Requête du script (`net.fetch`), pas du site. */
  readonly own: boolean;
}

/** Une réponse vue par les observateurs. */
export interface NetExchange {
  readonly request: NetRequest;
  readonly status: number;
  readonly ok: boolean;
  readonly headers: Headers;
  /** Réponse fabriquée par un intercepteur, sans appel réseau. */
  readonly synthetic: boolean;
  /** `Date.now()` au départ de la requête. */
  readonly startedAt: number;
  /** Millisecondes jusqu'aux en-têtes de la réponse (pas jusqu'à la fin du corps). */
  readonly duration: number;
  /** Corps, lu une seule fois et partagé entre les observateurs, sous la forme voulue. */
  arrayBuffer(): Promise<ArrayBuffer>;
  /** Corps décodé en UTF-8 (comme `Response.text()`). */
  text(): Promise<string>;
  json(): Promise<unknown>;
}

export type Matcher = (request: NetRequest) => boolean;

/** Renvoie une réponse pour court-circuiter le réseau, ou `undefined` pour laisser passer. */
export type Interceptor = (request: NetRequest) => Response | undefined | Promise<Response | undefined>;

/** Lit une réponse sans la modifier. Ne retarde jamais le site : appelé après lui avoir rendu la main. */
export type Observer = (exchange: NetExchange) => void | Promise<void>;

/**
 * Appelé au départ d'une requête (avant les intercepteurs) ; peut renvoyer de quoi être prévenu de sa fin,
 * avec son statut (`undefined` : échec réseau), avant que la réponse ne soit rendue à l'appelant.
 */
export type Tracker = (request: NetRequest) => ((status: number | undefined) => void) | void;

export interface ListenOptions {
  /** Retire l'intercepteur ou l'observateur quand il est interrompu. */
  readonly signal?: AbortSignal;
}

export interface InterceptOptions extends ListenOptions {
  /** Après tous les autres intercepteurs : ne voit que ce qui partirait vraiment au réseau (pour le retarder). */
  readonly last?: boolean;
}

/** Contenu d'un message WebSocket ; un binaire envoyé par la page est copié en `ArrayBuffer`. */
export type SocketData = string | ArrayBuffer | Blob;

/** Événement d'un WebSocket de la page (Supabase Realtime : mises, notifications, solde…). */
export interface SocketEvent {
  /** Adresse du WebSocket. */
  readonly url: URL;
  /** Numéro d'ordre, commun à tous les WebSocket : l'ordre réel des événements. */
  readonly seq: number;
  /** `Date.now()` de l'événement. */
  readonly at: number;
  readonly type: 'open' | 'message' | 'close';
  /** Pour un message : reçu du serveur (`in`) ou envoyé par la page (`out`). */
  readonly direction?: 'in' | 'out';
  readonly data?: SocketData;
  /** Code de fermeture. */
  readonly code?: number;
}

export type SocketMatcher = (url: URL) => boolean;

/** Lit un événement sans rien modifier ; appelé après coup, dans l'ordre des événements. */
export type SocketObserver = (event: SocketEvent) => void | Promise<void>;

export interface Net {
  /** Requête du script : passe par les intercepteurs et les observateurs, marquée `own`. */
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  intercept(match: Matcher, interceptor: Interceptor, options?: InterceptOptions): void;
  observe(match: Matcher, observer: Observer, options?: ListenOptions): void;
  /**
   * Suit des requêtes de leur départ à leur fin, échec réseau compris (les observateurs, eux, ne voient
   * que les réponses reçues) : pour montrer qu'une requête est en cours.
   */
  track(match: Matcher, tracker: Tracker, options?: ListenOptions): void;
  /** Observe les WebSocket de la page (lecture seule). */
  observeSocket(match: SocketMatcher, observer: SocketObserver, options?: ListenOptions): void;
}
