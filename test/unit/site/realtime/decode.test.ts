import { describe, expect, it } from 'vitest';
import { decodeBroadcast } from '@/site/realtime';
import { realtimeFrame } from '../../support';

const BID = {
  bid: { id: 'b1', amount: 56, bidder: { id: 'u2', username: 'Joueur' }, bidder_id: 'u2', auction_id: 'a1' },
  end_at: '2026-09-29T15:39:22.017883+00:00',
  previous_bidder_id: 'u1',
};

describe('decodeBroadcast', () => {
  it('décode une nouvelle mise diffusée sur le canal d’une enchère', () => {
    const frame = realtimeFrame('realtime:auction:a1', 'BID', { id: 'm1' }, BID);
    expect(decodeBroadcast(frame)).toEqual({
      topic: 'realtime:auction:a1',
      event: 'BID',
      metadata: { id: 'm1' },
      payload: BID,
    });
  });

  it('décode les textes accentués (UTF-8)', () => {
    const frame = realtimeFrame('realtime:notifications:u1', 'INSERT', {}, { title: '📉 Vous avez été surenchéri' });
    expect(decodeBroadcast(frame)?.payload).toEqual({ title: '📉 Vous avez été surenchéri' });
  });

  it('rend la charge brute quand elle n’est pas en JSON', () => {
    const frame = realtimeFrame('realtime:x', 'E', {}, 'ignoré');
    frame[4] = 0;
    expect(decodeBroadcast(frame)?.payload).toBeInstanceOf(Uint8Array);
  });

  it('refuse ce qui n’est pas une diffusion lisible', () => {
    expect(decodeBroadcast(new Uint8Array([1, 2, 3]))).toBeUndefined();
    expect(decodeBroadcast(new Uint8Array([4, 50, 3, 0, 1, 65]))).toBeUndefined();
    const broken = realtimeFrame('realtime:x', 'E', {}, { a: 1 });
    expect(decodeBroadcast(broken.subarray(0, broken.length - 2))).toBeUndefined();
  });
});
