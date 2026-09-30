import { createLogger } from '@/core/log';
import { createNet } from './net';

export { instantResponse } from './instant';
export { createNet, type NetController } from './net';
export type {
  InterceptOptions,
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
