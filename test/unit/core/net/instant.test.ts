import { describe, expect, it } from 'vitest';
import { cacheResponse, replayResponse, type NetExchange } from '@/core/net';

function exchange(body: string, contentType?: string): NetExchange {
  const headers = new Headers(contentType ? { 'content-type': contentType } : {});
  return { headers, text: () => Promise.resolve(body) } as unknown as NetExchange;
}

describe('réponse gardée puis resservie', () => {
  it('garde le corps et le type d’un échange observé, et la ressert en 200 lu sans attendre', async () => {
    const cached = await cacheResponse(exchange('{"cards":[1]}', 'application/json; charset=utf-8'));
    expect(cached).toEqual({ body: '{"cards":[1]}', contentType: 'application/json; charset=utf-8' });

    const replayed = replayResponse(cached);
    expect(replayed.status).toBe(200);
    expect(replayed.headers.get('content-type')).toBe('application/json; charset=utf-8');
    await expect(replayed.json()).resolves.toEqual({ cards: [1] });
  });

  it('lit une réponse de fetch sur une copie : l’appelant peut encore lire la sienne', async () => {
    const response = new Response('{"a":1}', { headers: { 'content-type': 'application/json' } });
    expect(await cacheResponse(response)).toEqual({ body: '{"a":1}', contentType: 'application/json' });
    await expect(response.json()).resolves.toEqual({ a: 1 });
  });

  it('sans type : JSON, comme les routes du site', async () => {
    expect((await cacheResponse(exchange('[]'))).contentType).toBe('application/json');
  });
});
