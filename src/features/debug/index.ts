import { domSyncRounds } from '@/core/dom';
import { expose } from '@/core/expose';
import { net } from '@/core/net';
import type { Feature } from '@/core/runtime';
import { supabaseFetch } from '@/site/api';
import { toast } from '@/ui/toast';
import { buildCapture, captureFileName, downloadJson } from './capture';
import {
  createRecorder,
  isRecordable,
  toRecord,
  toSocketRecord,
  type RecordedExchange,
  type RecordedSocketEvent,
} from './recorder';

export type { Capture } from './capture';
export type { RecordedExchange, RecordedSocketEvent } from './recorder';
export { containsSecret } from './redact';
export { sanitizeCapture, type StoredCapture } from './sanitize';

export interface CaptureSummary {
  readonly file: string;
  readonly exchanges: number;
  readonly sockets: number;
  readonly htmlChars: number;
}

export interface DebugConsole {
  /**
   * Télécharge une capture de la page (DOM, échanges réseau, temps réel), à déposer dans
   * test/fixtures/captures/. Raccourci dans la page : Alt+Maj+C.
   */
  capture(): CaptureSummary;
  /** Échanges réseau enregistrés depuis le chargement de la page. */
  exchanges(): readonly RecordedExchange[];
  /** Événements WebSocket (temps réel) enregistrés depuis le chargement de la page. */
  sockets(): readonly RecordedSocketEvent[];
  /** Passes de synchronisation du DOM depuis le chargement (au repos, ce nombre doit rester fixe). */
  domSyncs(): number;
  /**
   * Lecture Supabase en direct avec la session du site, en GET seulement : `sb('auctions?select=id&limit=1')`.
   * Statut, durée et `Content-Range` dans la console, corps renvoyé. `prefer` : en-tête `Prefer`
   * (`count=estimated` ; jamais `count=exact` sur une grande table : la base s'arrête au bout de 10 s).
   */
  sb(path: string, prefer?: string): Promise<unknown>;
  clear(): void;
}

declare module '@/core/expose' {
  interface WmApi {
    debug?: DebugConsole;
  }
}

const LIMITS = { maxEntries: 300, maxBodyChars: 2_000_000, maxTotalChars: 40_000_000, maxSocketEvents: 3000 };

/** Alt+Maj+C : capture de l'onglet affiché, sans passer par la console. */
function isCaptureShortcut(event: KeyboardEvent): boolean {
  return event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyC';
}

export const debug: Feature = {
  id: 'debug',
  name: 'Diagnostic',
  toggleLabel: 'Enregistrer pour les captures',
  description: 'Garde les échanges avec le site pour capturer une page (Alt+Maj+C).',
  category: 'Développement',
  routes: 'all',
  mount(ctx) {
    const recorder = createRecorder(LIMITS);
    const { signal } = ctx;
    net.observe(isRecordable, async (exchange) => recorder.add(await toRecord(exchange, LIMITS.maxBodyChars)), { signal });
    net.observeSocket(
      () => true,
      async (event) => recorder.addSocket(await toSocketRecord(event, LIMITS.maxBodyChars)),
      { signal },
    );

    function capture(): CaptureSummary {
      const now = new Date();
      const result = buildCapture(window, { exchanges: recorder.list(), sockets: recorder.sockets() }, now);
      const file = captureFileName(location.pathname, now);
      downloadJson(document, file, result);
      const summary = `${result.exchanges.length} échanges, ${result.sockets.length} événements temps réel`;
      ctx.log.info(`capture téléchargée : ${file} (${summary})`);
      toast.success(`${location.pathname} · ${summary}`, { title: 'Capture enregistrée' });
      return { file, exchanges: result.exchanges.length, sockets: result.sockets.length, htmlChars: result.html.length };
    }

    async function sb(path: string, prefer?: string): Promise<unknown> {
      const started = performance.now();
      const response = await supabaseFetch(`/rest/v1/${path.replace(/^\/+/, '')}`, {
        headers: prefer ? { Prefer: prefer } : {},
      });
      const ms = Math.round(performance.now() - started);
      const body: unknown = await response.json().catch(() => undefined);
      ctx.log.info(`${response.status} · ${ms} ms · ${response.headers.get('content-range') ?? 'sans Content-Range'}`, body);
      return body;
    }

    document.addEventListener(
      'keydown',
      (event) => {
        if (!isCaptureShortcut(event)) return;
        event.preventDefault();
        event.stopPropagation();
        capture();
      },
      { capture: true, signal },
    );

    expose(
      'debug',
      {
        capture,
        exchanges: () => recorder.list(),
        sockets: () => recorder.sockets(),
        domSyncs: domSyncRounds,
        sb,
        clear: () => recorder.clear(),
      },
      signal,
    );
  },
};
