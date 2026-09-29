import { describe, expect, it } from 'vitest';
import { binaryContent, fromBase64, socketBinaryContent, toBase64 } from '@/features/debug/content';
import { realtimeFrame } from '../../support';

const PROFILE_UPDATE = {
  table: 'profiles',
  record: {
    id: 'u1',
    username: 'Joueur',
    wikibidous_balance: 12671,
    signup_email_canonical: 'joueur@exemple.fr',
    stripe_customer_id: 'cus_123',
    stripe_subscription_id: null,
    apple_original_transaction_id: '2000001',
  },
};

describe('contenu enregistré', () => {
  it('décode une diffusion temps réel binaire en JSON lisible, données personnelles masquées', () => {
    const frame = realtimeFrame('realtime:profile:u1', 'UPDATE', { id: 'm1' }, PROFILE_UPDATE);
    const content = socketBinaryContent(frame, 'binaire', 100_000);

    expect(content.encoding).toBe('realtime');
    expect(JSON.parse(content.text)).toEqual({
      topic: 'realtime:profile:u1',
      event: 'UPDATE',
      metadata: { id: 'm1' },
      payload: {
        table: 'profiles',
        record: {
          id: 'u1',
          username: 'Joueur',
          wikibidous_balance: 12671,
          signup_email_canonical: '[e-mail masqué]',
          stripe_customer_id: '[masqué]',
          stripe_subscription_id: null,
          apple_original_transaction_id: '[masqué]',
        },
      },
    });
  });

  it('garde intact un binaire inconnu, sauf s’il contient une adresse e-mail ou un jeton', () => {
    const clean = new Uint8Array([0, 1, 2, 250, 255]);
    expect(binaryContent(clean, 'audio/mpeg', 1000)).toEqual({ text: toBase64(clean), encoding: 'base64', truncated: false });

    const personal = new TextEncoder().encode('\u0001\u0002contact: joueur@exemple.fr\u0003');
    expect(binaryContent(personal, 'application/octet-stream', 1000)).toEqual({
      text: `[binaire masqué : application/octet-stream, ${personal.length} octets, contient des données personnelles]`,
      truncated: true,
    });
    expect(socketBinaryContent(personal, 'binaire', 1000).truncated).toBe(true);
  });

  it('fait l’aller-retour base64 sans perte', () => {
    const bytes = Uint8Array.from({ length: 100_000 }, (_, i) => (i * 31) % 256);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });
});
