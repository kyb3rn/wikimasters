import { describe, expect, it } from 'vitest';
import { captureFileName } from '@/features/debug/capture';

describe('captureFileName', () => {
  it('nomme le fichier de capture d’après la page et l’heure', () => {
    const date = new Date(2026, 8, 29, 14, 30, 5);
    expect(captureFileName('/marketplace/3f2a-11', date)).toBe('wm-capture-marketplace-3f2a-11-20260929-143005.json');
    expect(captureFileName('/', date)).toBe('wm-capture-accueil-20260929-143005.json');
    expect(captureFileName('/profile/%C3%89lo', date)).toBe('wm-capture-profile-_C3_89lo-20260929-143005.json');
  });
});
