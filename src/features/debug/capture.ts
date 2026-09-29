import type { RecordedExchange, RecordedSocketEvent } from './recorder';
import { redactText, redactUrl } from './redact';

/**
 * Photo d'une page du site : DOM affiché, échanges réseau et événements temps réel (WebSocket)
 * depuis le chargement. Sert de fixture aux tests (test/fixtures/captures/).
 * Version 2 : ajout de `sockets`.
 */
export interface Capture {
  readonly format: 'wm-capture';
  readonly version: 2;
  readonly capturedAt: string;
  readonly script: { readonly version: string; readonly dev: boolean };
  readonly page: {
    readonly url: string;
    readonly path: string;
    readonly title: string;
    readonly viewport: { readonly width: number; readonly height: number };
    readonly userAgent: string;
  };
  /** `document.documentElement.outerHTML`, secrets masqués. */
  readonly html: string;
  readonly exchanges: readonly RecordedExchange[];
  readonly sockets: readonly RecordedSocketEvent[];
}

export function buildCapture(
  win: Window,
  recorded: { exchanges: readonly RecordedExchange[]; sockets: readonly RecordedSocketEvent[] },
  now = new Date(),
): Capture {
  const { document: doc, location } = win;
  return {
    format: 'wm-capture',
    version: 2,
    capturedAt: now.toISOString(),
    script: { version: __VERSION__, dev: __DEV__ },
    page: {
      url: redactUrl(location.href),
      path: location.pathname,
      title: doc.title,
      viewport: { width: win.innerWidth, height: win.innerHeight },
      userAgent: win.navigator.userAgent,
    },
    html: redactText(doc.documentElement.outerHTML),
    exchanges: recorded.exchanges,
    sockets: recorded.sockets,
  };
}

/** `wm-capture-marketplace-3f2a…-20260929-143012.json` */
export function captureFileName(path: string, now: Date): string {
  const page = path.split('/').filter(Boolean).join('-').replace(/[^\w-]/g, '_') || 'accueil';
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `wm-capture-${page}-${stamp}.json`;
}

/** Fait télécharger `data` au navigateur, en JSON. */
export function downloadJson(doc: Document, fileName: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = doc.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  doc.documentElement.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
