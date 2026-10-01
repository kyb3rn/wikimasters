import { describe, expect, it } from 'vitest';
import { matchRoute } from '@/core/router';
import { profilePath } from '@/site/profile';
import { PROFILE_ROUTE } from '@/site/routes';

describe('profilePath', () => {
  it('pseudo encodé : espaces, `/`, émojis ; relu tel quel par la route du profil', () => {
    for (const name of ['aelonka', 'Jean Pierre 🐱', 'a/b?', 'Zoé!']) {
      expect(matchRoute(PROFILE_ROUTE, profilePath(name))).toEqual({ name });
    }
    expect(profilePath('Jean Pierre 🐱')).toBe('/profile/Jean%20Pierre%20%F0%9F%90%B1');
  });
});
