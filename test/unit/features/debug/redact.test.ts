import { describe, expect, it } from 'vitest';
import { containsSecret, MASK, redactBody, redactHeaders, redactText, redactUrl } from '@/features/debug/redact';

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

describe('masquage des secrets', () => {
  it('masque les jetons JWT et les e-mails dans un texte', () => {
    const html = `<script>self.__next_f.push(["${JWT}", "moi@exemple.fr"])</script>`;
    const result = redactText(html);
    expect(result).not.toContain(JWT);
    expect(result).not.toContain('moi@exemple.fr');
    expect(result).toContain('[jwt masqué]');
    expect(result).toContain('[e-mail masqué]');
  });

  it('ne prend pas une image @2x pour une adresse e-mail', () => {
    expect(redactText('/img/carte@2x.png')).toBe('/img/carte@2x.png');
  });

  it('masque les en-têtes sensibles, garde les autres', () => {
    const headers = new Headers({
      authorization: `Bearer ${JWT}`,
      apikey: 'cle-anon',
      cookie: 'sb=1',
      'content-type': 'application/json',
    });
    expect(redactHeaders(headers)).toEqual({
      authorization: MASK,
      apikey: MASK,
      cookie: MASK,
      'content-type': 'application/json',
    });
  });

  it('masque les clés sensibles d’un corps JSON, à toute profondeur', () => {
    const body = JSON.stringify({
      access_token: JWT,
      refresh_token: 'abc',
      user: { id: 'u1', email: 'moi@exemple.fr', password: 'x' },
      tokens_count: 3,
      token: null,
      cards: [{ id: 'c1', wikipedia_title: 'Paris' }],
    });
    expect(JSON.parse(redactBody(body))).toEqual({
      access_token: MASK,
      refresh_token: MASK,
      user: { id: 'u1', email: '[e-mail masqué]', password: MASK },
      tokens_count: 3,
      token: null,
      cards: [{ id: 'c1', wikipedia_title: 'Paris' }],
    });
  });

  it('masque les identifiants de paiement (Stripe, Apple), garde les autres identifiants', () => {
    const body = JSON.stringify({
      id: 'u1',
      card_id: 'c1',
      stripe_customer_id: 'cus_123',
      stripe_subscription_id: 'sub_456',
      apple_original_transaction_id: '2000001',
      apple_subscription_status: 'active',
      trade_id: 't1',
    });
    expect(JSON.parse(redactBody(body))).toEqual({
      id: 'u1',
      card_id: 'c1',
      stripe_customer_id: MASK,
      stripe_subscription_id: MASK,
      apple_original_transaction_id: MASK,
      apple_subscription_status: 'active',
      trade_id: 't1',
    });
  });

  it('repère un jeton ou une adresse e-mail dans un texte', () => {
    expect(containsSecret(`x ${JWT} y`)).toBe(true);
    expect(containsSecret('écrire à joueur@exemple.fr')).toBe(true);
    expect(containsSecret('carte@2x.png, aucun secret')).toBe(false);
  });

  it('masque les paramètres sensibles d’une adresse, garde les autres', () => {
    expect(redactUrl('wss://x.supabase.co/realtime/v1/websocket?apikey=sb_publishable_abc&vsn=2.0.0')).toBe(
      'wss://x.supabase.co/realtime/v1/websocket?apikey=[masqué]&vsn=2.0.0',
    );
    expect(redactUrl('https://www.wiki-masters.com/auth?code=1&access_token=xyz#fin')).toBe(
      'https://www.wiki-masters.com/auth?code=1&access_token=[masqué]#fin',
    );
    expect(redactUrl('https://www.wiki-masters.com/api/marketplace?page=1&tokens=3')).toBe(
      'https://www.wiki-masters.com/api/marketplace?page=1&tokens=3',
    );
  });

  it('traite un corps non JSON comme du texte', () => {
    expect(redactBody(`0:["$","div",null,"${JWT}"]`)).toBe('0:["$","div",null,"[jwt masqué]"]');
  });
});
