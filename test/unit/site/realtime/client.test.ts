import { describe, expect, it } from 'vitest';
import { findSiteRealtime, readSiteRealtime } from '@/site/realtime';

/**
 * Client temps réel du site imité (realtime-js 2.99.2) : WebSocket (`connectionState()`), canaux, minuterie de
 * nouvel essai. `calls` garde l'ordre des appels du script.
 */
function fakeSupabase(socket: string, state: string | undefined) {
  const calls: string[] = [];
  const channel = {
    topic: 'realtime:auction:a1',
    state: state ?? 'closed',
    rejoinTimer: { reset: () => calls.push('rejoinTimer.reset') },
    _rejoin() {
      calls.push('_rejoin');
      channel.state = 'joining';
    },
  };
  const realtime = {
    socket,
    channels: [{ topic: 'realtime:notifications:u1', state: 'joined' }, ...(state ? [channel] : [])],
    connectionState: () => realtime.socket,
    connect() {
      calls.push('connect');
      realtime.socket = 'connecting';
    },
  };
  return { supabase: { auth: {}, realtime }, channel, calls };
}

const link = (socket: string, state: string | undefined) => readSiteRealtime(fakeSupabase(socket, state).supabase)?.link('auction:a1');

describe('client temps réel du site', () => {
  it('en direct : WebSocket ouverte et canal rejoint', () => {
    expect(link('open', 'joined')).toBe('live');
  });

  it('en cours : WebSocket qui se connecte, abonnement envoyé, ou canal pas encore créé par la page', () => {
    expect(link('connecting', 'errored')).toBe('connecting');
    expect(link('open', 'joining')).toBe('connecting');
    expect(link('open', undefined)).toBe('connecting');
  });

  it('coupé : WebSocket fermée, ou abonnement refusé (serveur saturé)', () => {
    expect(link('closed', 'errored')).toBe('down');
    expect(link('closing', 'joined')).toBe('down');
    expect(link('open', 'errored')).toBe('down');
  });

  it('WebSocket fermée : reconnectée, puis canal réabonné, sa minuterie arrêtée avant', () => {
    const { supabase, channel, calls } = fakeSupabase('closed', 'errored');
    const realtime = readSiteRealtime(supabase);
    realtime?.reconnect('auction:a1');
    expect(calls).toEqual(['connect', 'rejoinTimer.reset', '_rejoin']);
    expect(channel.state).toBe('joining');
    expect(realtime?.link('auction:a1')).toBe('connecting');
  });

  it('abonnement refusé, WebSocket ouverte : seul le canal est relancé', () => {
    const { supabase, calls } = fakeSupabase('open', 'errored');
    readSiteRealtime(supabase)?.reconnect('auction:a1');
    expect(calls).toEqual(['rejoinTimer.reset', '_rejoin']);
  });

  it('essai déjà en cours, ou WebSocket qui se ferme encore : rien de plus', () => {
    for (const [socket, state] of [
      ['open', 'joining'],
      ['open', 'joined'],
      ['connecting', 'joining'],
      ['closing', 'joined'],
    ] as const) {
      const { supabase, calls } = fakeSupabase(socket, state);
      readSiteRealtime(supabase)?.reconnect('auction:a1');
      expect(calls).toEqual([]);
    }
  });

  it('forme inattendue (autre version du client) : rien', () => {
    expect(readSiteRealtime(undefined)).toBeUndefined();
    expect(readSiteRealtime({ realtime: { channels: [] } })).toBeUndefined();
    expect(readSiteRealtime({ realtime: { channels: {}, connectionState: () => 'open', connect: () => {} } })).toBeUndefined();
  });

  it('trouvé dans les références d’un composant au-dessus du nœud', () => {
    const { supabase } = fakeSupabase('open', 'joined');
    const refs = { memoizedState: { current: supabase }, queue: null, next: null };
    const states = { memoizedState: false, queue: { dispatch: () => {} }, next: refs };
    const page = { memoizedProps: {}, return: null, memoizedState: states };
    const node = { __reactFiber$test: { memoizedProps: {}, return: page } } as unknown as Node;
    expect(findSiteRealtime(node)?.link('auction:a1')).toBe('live');
    expect(findSiteRealtime({ __reactFiber$test: { memoizedProps: {}, return: null } } as unknown as Node)).toBeUndefined();
  });
});
