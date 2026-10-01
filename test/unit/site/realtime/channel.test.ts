import { describe, expect, it } from 'vitest';
import { joinPayload, parseRealtimeChange, parseRealtimeFrame } from '@/site/realtime';

describe('canal temps réel', () => {
  it('lit les trames JSON du protocole Phoenix, ignore le reste', () => {
    expect(parseRealtimeFrame('["3","3","realtime:guild-chat:g1","phx_reply",{"status":"ok"}]')).toEqual([
      '3',
      '3',
      'realtime:guild-chat:g1',
      'phx_reply',
      { status: 'ok' },
    ]);
    expect(parseRealtimeFrame('[null,"9","phoenix","phx_reply",{}]')?.[2]).toBe('phoenix');
    expect(parseRealtimeFrame('pas du JSON')).toBeUndefined();
    expect(parseRealtimeFrame('[1,2,3]')).toBeUndefined();
    expect(parseRealtimeFrame(new ArrayBuffer(4))).toBeUndefined();
  });

  it('lit un changement `postgres_changes` (capture du 29/09/2026)', () => {
    const frame = parseRealtimeFrame(
      '[null,null,"realtime:guild-chat:g1","postgres_changes",{"data":{"table":"guild_messages","type":"INSERT","record":{"id":"m1","guild_id":"g1","sender_id":"u1","content":"salut","type":"message","created_at":"2026-10-01T00:00:00+00:00"},"columns":[],"errors":null,"schema":"public","commit_timestamp":"2026-10-01T00:00:00Z"},"ids":[1]}]',
    );
    expect(parseRealtimeChange(frame?.[4])).toEqual({
      type: 'INSERT',
      table: 'guild_messages',
      record: { id: 'm1', guild_id: 'g1', sender_id: 'u1', content: 'salut', type: 'message', created_at: '2026-10-01T00:00:00+00:00' },
    });
    expect(parseRealtimeChange({ data: { type: 'INSERT' } })).toBeUndefined();
  });

  it('rejoint un canal public comme le client du site', () => {
    const changes = [{ event: 'INSERT', schema: 'public', table: 'guild_messages', filter: 'guild_id=eq.g1' }] as const;
    expect(joinPayload(changes, 'jeton')).toEqual({
      config: {
        broadcast: { ack: false, self: false },
        presence: { key: '', enabled: false },
        postgres_changes: changes,
        private: false,
      },
      access_token: 'jeton',
    });
  });
});
