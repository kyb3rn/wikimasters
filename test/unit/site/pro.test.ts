import { describe, expect, it } from 'vitest';
import { isProStatusRead, parseProStatus } from '@/site/pro';
import { netRequest } from '../support';

describe('statut PRO', () => {
  it('lu dans le profil de l’utilisateur, ses RPC de profil et le résumé des ventes', () => {
    const uid = 'u0';
    expect(isProStatusRead(netRequest('https://x.supabase.co/rest/v1/profiles?select=is_pro&id=eq.u0'), uid)).toBe(true);
    expect(isProStatusRead(netRequest('https://x.supabase.co/rest/v1/rpc/get_my_profile', { method: 'POST' }), uid)).toBe(true);
    expect(isProStatusRead(netRequest('https://x.supabase.co/rest/v1/rpc/sync_profile_packs', { method: 'POST' }), uid)).toBe(true);
    expect(isProStatusRead(netRequest('/api/marketplace/cards/c1/sales?scope=summary'), uid)).toBe(true);
  });

  it('pas le profil d’un autre joueur, ni celui d’un utilisateur inconnu, ni les ventes complètes', () => {
    expect(isProStatusRead(netRequest('https://x.supabase.co/rest/v1/profiles?select=is_pro&id=eq.u9'), 'u0')).toBe(false);
    expect(isProStatusRead(netRequest('https://x.supabase.co/rest/v1/profiles?select=is_pro&id=eq.u0'), undefined)).toBe(false);
    expect(isProStatusRead(netRequest('/api/marketplace/cards/c1/sales'), 'u0')).toBe(false);
  });

  it('`is_pro` d’un profil (seul ou en liste d’un), `isPro` du résumé', () => {
    expect(parseProStatus([{ is_pro: true }])).toBe(true);
    expect(parseProStatus({ id: 'u0', is_pro: false, is_vip: false })).toBe(false);
    expect(parseProStatus({ wikipedia_title: 'x', summary: {}, isPro: true })).toBe(true);
    expect(parseProStatus([{ is_pro: true }, { is_pro: false }])).toBeUndefined();
    expect(parseProStatus({ id: 'u0' })).toBeUndefined();
  });
});
