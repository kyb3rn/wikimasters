import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Dom from '@/core/dom';
import { flush } from '../../support';
import { arrive, installFakeDocument, installFakeObservers, type FakeDocument } from '../fake-dom';

let doc: FakeDocument;
let observers: ReturnType<typeof installFakeObservers>;
let whenBody: typeof Dom.whenBody;

beforeEach(async () => {
  // L'attente est partagée par tout le module : un module neuf par test.
  vi.resetModules();
  ({ whenBody } = await import('@/core/dom'));
  observers = installFakeObservers();
  doc = installFakeDocument({ body: false });
});
afterEach(() => vi.unstubAllGlobals());

function bodyArrives() {
  const body = arrive(doc, 'body');
  observers.mutate();
  return body;
}

describe('whenBody', () => {
  it('<body> déjà là : tout de suite, sans observateur', async () => {
    const body = arrive(doc, 'body');
    await expect(whenBody()).resolves.toBe(body);
    expect(observers.instances).toHaveLength(0);
  });

  it('une seule promesse et un seul observateur pour toutes les attentes, débranché à l’arrivée', async () => {
    const first = whenBody();
    const second = whenBody();
    const third = whenBody(new AbortController().signal);
    expect(first).toBe(second);
    expect(observers.instances).toHaveLength(1);

    observers.mutate();
    const body = bodyArrives();
    await expect(Promise.all([first, second, third])).resolves.toEqual([body, body, body]);
    expect(observers.instances[0]?.connected).toBe(false);
  });

  it('avec un signal : `undefined` dès qu’il est interrompu, même si <body> arrive ensuite', async () => {
    const controller = new AbortController();
    let result: unknown = 'en attente';
    void whenBody(controller.signal).then((body) => (result = body));
    const others = whenBody();
    controller.abort();
    await flush();
    expect(result).toBeUndefined();

    const body = bodyArrives();
    await expect(others).resolves.toBe(body);
    await expect(whenBody(AbortSignal.abort())).resolves.toBeUndefined();
  });
});
