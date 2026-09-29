import { describe, expect, it } from 'vitest';
import { sanitizeCapture, type RecordedExchange, type StoredCapture } from '@/features/debug';
import { toBase64 } from '@/features/debug/content';
import { realtimeFrame } from '../../support';

function exchange(init: Partial<RecordedExchange>): RecordedExchange {
  return {
    at: '2026-09-29T03:40:48.000Z',
    method: 'GET',
    url: 'https://www.wiki-masters.com/api/x',
    own: false,
    synthetic: false,
    status: 200,
    duration: 10,
    requestHeaders: {},
    responseHeaders: { 'content-type': 'application/json' },
    body: '{}',
    truncated: false,
    ...init,
  };
}

function capture(init: Partial<StoredCapture> = {}): StoredCapture {
  return {
    format: 'wm-capture',
    version: 2,
    capturedAt: '2026-09-29T03:41:10.210Z',
    script: { version: '0.1.0', dev: true },
    page: { url: 'https://www.wiki-masters.com/pulls', path: '/pulls', title: 'WikiMasters', viewport: { width: 1, height: 1 }, userAgent: 'x' },
    html: '<main>joueur@exemple.fr</main>',
    exchanges: [],
    sockets: [],
    ...init,
  };
}

describe('sanitizeCapture', () => {
  it('masque ce que les anciennes règles laissaient passer', () => {
    const profile = realtimeFrame('realtime:profile:u1', 'UPDATE', { id: 'm1' }, {
      record: { username: 'Joueur', signup_email_canonical: 'joueur@exemple.fr', stripe_customer_id: 'cus_1' },
    });
    const result = sanitizeCapture(
      capture({
        exchanges: [
          exchange({ body: '{"stripe_customer_id":"cus_1","packs_remaining":0}' }),
          exchange({
            responseHeaders: { 'content-type': 'application/octet-stream' },
            body: toBase64(new TextEncoder().encode('joueur@exemple.fr')),
            bodyEncoding: 'base64',
          }),
        ],
        sockets: [
          {
            seq: 8,
            at: '2026-09-29T03:40:49.000Z',
            url: 'wss://x.supabase.co/realtime/v1/websocket?apikey=cle&vsn=2.0.0',
            type: 'message',
            direction: 'in',
            data: toBase64(profile),
            dataEncoding: 'base64',
          },
        ],
      }),
    );

    expect(result.html).toBe('<main>[e-mail masqué]</main>');
    expect(JSON.parse(result.exchanges[0]?.body ?? '')).toEqual({ stripe_customer_id: '[masqué]', packs_remaining: 0 });
    expect(result.exchanges[1]).toMatchObject({ truncated: true });
    expect(result.exchanges[1]?.bodyEncoding).toBeUndefined();
    expect(result.sockets?.[0]).toMatchObject({
      url: 'wss://x.supabase.co/realtime/v1/websocket?apikey=[masqué]&vsn=2.0.0',
      dataEncoding: 'realtime',
    });
    expect(JSON.parse(result.sockets?.[0]?.data ?? '')).toEqual({
      topic: 'realtime:profile:u1',
      event: 'UPDATE',
      metadata: { id: 'm1' },
      payload: { record: { username: 'Joueur', signup_email_canonical: '[e-mail masqué]', stripe_customer_id: '[masqué]' } },
    });
  });

  it('garde un binaire propre intact, et une capture propre identique', () => {
    const clean = capture({
      html: '<main>ok</main>',
      exchanges: [
        exchange({
          responseHeaders: { 'content-type': 'audio/mpeg' },
          body: toBase64(new Uint8Array([73, 68, 51, 4, 0])),
          bodyEncoding: 'base64',
        }),
      ],
    });
    expect(sanitizeCapture(clean)).toEqual(clean);
  });

  it('est idempotente, et ne crée pas de temps réel dans une capture du format 1', () => {
    const { sockets: _sockets, ...v1 } = capture({ version: 1, exchanges: [exchange({ body: '{"a":"joueur@exemple.fr"}' })] });
    const once = sanitizeCapture(v1);
    expect(once).not.toHaveProperty('sockets');
    expect(sanitizeCapture(once)).toEqual(once);
  });
});
