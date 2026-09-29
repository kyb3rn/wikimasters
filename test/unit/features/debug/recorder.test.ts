import { describe, expect, it } from 'vitest';
import type { NetExchange, NetRequest, SocketEvent } from '@/core/net';
import { captureFileName } from '@/features/debug/capture';
import {
  createRecorder,
  isRecordable,
  toRecord,
  toSocketRecord,
  type RecordedExchange,
} from '@/features/debug/recorder';

function request(url: string, init: Partial<NetRequest> = {}): NetRequest {
  return { url: new URL(url), method: 'GET', headers: new Headers(), body: undefined, own: false, ...init };
}

/** Échange dont le corps se lit comme dans `core/net` : octets, texte UTF-8 ou JSON. */
function fakeExchange(
  body: string | Uint8Array,
  contentType: string | null,
  { url = 'https://www.wiki-masters.com/api/x', ...init }: Partial<Omit<NetRequest, 'url'>> & { url?: string } = {},
): NetExchange {
  const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : body;
  const exchange: NetExchange = {
    request: request(url, init),
    status: 200,
    ok: true,
    headers: new Headers(contentType ? { 'content-type': contentType } : {}),
    synthetic: false,
    startedAt: Date.UTC(2026, 8, 29, 12, 0, 0),
    duration: 42,
    arrayBuffer: () => Promise.resolve(bytes.slice().buffer),
    text: () => Promise.resolve(new TextDecoder().decode(bytes)),
    json: async () => JSON.parse(await exchange.text()) as unknown,
  };
  return exchange;
}

function entry(body: string): RecordedExchange {
  return {
    at: '',
    method: 'GET',
    url: '',
    own: false,
    synthetic: false,
    status: 200,
    duration: 0,
    requestHeaders: {},
    responseHeaders: {},
    body,
    truncated: false,
  };
}

const LIMITS = { maxEntries: 10, maxBodyChars: 100, maxTotalChars: 1000, maxSocketEvents: 10 };

function socketEvent(seq: number, init: Partial<SocketEvent> = {}): SocketEvent {
  return {
    url: new URL('wss://x.supabase.co/realtime/v1/websocket?apikey=cle-anon&vsn=2.0.0'),
    seq,
    at: Date.UTC(2026, 8, 29, 12, 0, 0),
    type: 'message',
    direction: 'in',
    ...init,
  };
}

describe('enregistreur', () => {
  it("oublie les plus anciens au-delà du nombre maximal d'échanges", () => {
    const recorder = createRecorder({ ...LIMITS, maxEntries: 2 });
    ['a', 'b', 'c'].forEach((body) => recorder.add(entry(body)));
    expect(recorder.list().map((e) => e.body)).toEqual(['b', 'c']);
  });

  it('oublie les plus anciens au-delà du volume maximal, en gardant toujours le dernier', () => {
    const recorder = createRecorder({ ...LIMITS, maxTotalChars: 10 });
    ['aaaa', 'bbbb', 'cccc'].forEach((body) => recorder.add(entry(body)));
    expect(recorder.list().map((e) => e.body)).toEqual(['bbbb', 'cccc']);
    recorder.add(entry('x'.repeat(50)));
    expect(recorder.list()).toHaveLength(1);
  });

  it('ignore les fichiers statiques de Next.js', () => {
    expect(isRecordable(request('https://www.wiki-masters.com/_next/static/chunks/a.js'))).toBe(false);
    expect(isRecordable(request('https://www.wiki-masters.com/api/marketplace'))).toBe(true);
    expect(isRecordable(request('https://x.supabase.co/rest/v1/user_cards'))).toBe(true);
  });

  it('enregistre un échange, secrets masqués et corps coupé', async () => {
    const exchange = fakeExchange('{"pseudo":"mamzet","bio":"' + 'x'.repeat(50) + '"}', 'application/json', {
      url: 'https://x.supabase.co/rest/v1/rpc/get_my_profile',
      method: 'POST',
      headers: new Headers({ apikey: 'cle', 'content-type': 'application/json' }),
      body: '{"password":"x"}',
    });

    const record = await toRecord(exchange, 30);
    expect(record).toMatchObject({
      at: '2026-09-29T12:00:00.000Z',
      method: 'POST',
      status: 200,
      duration: 42,
      requestHeaders: { apikey: '[masqué]', 'content-type': 'application/json' },
      requestBody: '{"password":"[masqué]"}',
      truncated: true,
    });
    expect(record.body).toHaveLength(30);
    expect(record.bodyEncoding).toBeUndefined();
  });

  it('garde un fichier binaire intact, en base64', async () => {
    const mp3 = Uint8Array.from({ length: 70_000 }, (_, i) => (i * 7) % 256);
    const record = await toRecord(fakeExchange(mp3, 'audio/mpeg'), 200_000);

    expect(record.bodyEncoding).toBe('base64');
    expect(record.truncated).toBe(false);
    expect(Buffer.from(record.body, 'base64').equals(Buffer.from(mp3))).toBe(true);
  });

  it("n'enregistre pas un fichier binaire trop gros, et le dit", async () => {
    const record = await toRecord(fakeExchange(new Uint8Array(3000), 'image/webp'), 1000);
    expect(record).toMatchObject({ body: '[binaire trop gros : image/webp, 3000 octets]', truncated: true });
    expect(record.bodyEncoding).toBeUndefined();
  });

  it('lit en texte les types textuels, et un corps sans type', async () => {
    for (const type of ['application/json; charset=utf-8', 'text/x-component', 'application/vnd.pgrst.object+json', null]) {
      const record = await toRecord(fakeExchange('0:["$","div"]', type), 100);
      expect(record.body).toBe('0:["$","div"]');
      expect(record.bodyEncoding).toBeUndefined();
    }
  });

  it('enregistre un message temps réel, secrets masqués', async () => {
    const join = JSON.stringify(['1', '1', 'realtime:auction:a1', 'phx_join', { access_token: 'eyJ…', config: {} }]);
    const record = await toSocketRecord(socketEvent(7, { direction: 'out', data: join }), 1000);
    expect(record).toEqual({
      seq: 7,
      at: '2026-09-29T12:00:00.000Z',
      url: 'wss://x.supabase.co/realtime/v1/websocket?apikey=[masqué]&vsn=2.0.0',
      type: 'message',
      direction: 'out',
      data: JSON.stringify(['1', '1', 'realtime:auction:a1', 'phx_join', { access_token: '[masqué]', config: {} }]),
    });
  });

  it('enregistre un message temps réel binaire en base64, et la fermeture avec son code', async () => {
    const binary = await toSocketRecord(socketEvent(1, { data: new Uint8Array([1, 2, 3]).buffer }), 1000);
    expect(binary).toMatchObject({ data: 'AQID', dataEncoding: 'base64' });
    const blob = await toSocketRecord(socketEvent(2, { data: new Blob([new Uint8Array([4, 5])]) }), 1000);
    expect(blob).toMatchObject({ data: 'BAU=', dataEncoding: 'base64' });
    const closed = await toSocketRecord(socketEvent(3, { type: 'close', direction: undefined, code: 1006 }), 1000);
    expect(closed).toEqual({
      seq: 3,
      at: '2026-09-29T12:00:00.000Z',
      url: 'wss://x.supabase.co/realtime/v1/websocket?apikey=[masqué]&vsn=2.0.0',
      type: 'close',
      code: 1006,
    });
  });

  it("garde les événements temps réel dans l'ordre réel, même enregistrés dans le désordre", async () => {
    const recorder = createRecorder({ ...LIMITS, maxSocketEvents: 3 });
    for (const seq of [2, 1, 4, 3]) recorder.addSocket(await toSocketRecord(socketEvent(seq, { data: `m${seq}` }), 100));
    expect(recorder.sockets().map((e) => e.seq)).toEqual([2, 3, 4]);
  });

  it('nomme le fichier de capture d’après la page et l’heure', () => {
    const date = new Date(2026, 8, 29, 14, 30, 5);
    expect(captureFileName('/marketplace/3f2a-11', date)).toBe('wm-capture-marketplace-3f2a-11-20260929-143005.json');
    expect(captureFileName('/', date)).toBe('wm-capture-accueil-20260929-143005.json');
    expect(captureFileName('/profile/%C3%89lo', date)).toBe('wm-capture-profile-_C3_89lo-20260929-143005.json');
  });
});
