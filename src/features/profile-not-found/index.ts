import type { Feature } from '@/core/runtime';
import { flexMainWhile } from '@/services/main-column';
import { showsProfileNotFound } from '@/site/profile';
import { PROFILE_ROUTE } from '@/site/routes';

export const profileNotFound: Feature = {
  id: 'profile-not-found',
  name: 'Profil introuvable centré',
  description: 'Le message « Profil introuvable » est au milieu de la page.',
  category: 'Profil',
  routes: [PROFILE_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    if (!(await ctx.ready())) return;
    flexMainWhile(ctx, 'wm-profile-not-found', showsProfileNotFound);
  },
};
