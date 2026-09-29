import { createLogger } from '@/core/log';
import { createNet } from './net';

export { createNet, type NetController } from './net';
export type {
  Interceptor,
  ListenOptions,
  Matcher,
  Net,
  NetExchange,
  NetRequest,
  Observer,
  SocketData,
  SocketEvent,
  SocketMatcher,
  SocketObserver,
  Tracker,
  Transport,
} from './types';

/** Le réseau de la page. `install` est appelé une fois, au démarrage du script (main.ts). */
export const net = createNet(createLogger('réseau'));
