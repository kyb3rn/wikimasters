import type { Feature } from '@/core/runtime';
import { flexMainWhile } from '@/services/main-column';
import { showsPageSpinner } from '@/site/page-spinner';

export const pageSpinner: Feature = {
  id: 'page-spinner',
  name: 'Chargement centré',
  description: 'Le rond de chargement des pages est au milieu de la page, verticalement et horizontalement.',
  category: 'Général',
  routes: 'all',
  required: true,
  hidden: true,
  async mount(ctx) {
    if (!(await ctx.ready())) return;
    flexMainWhile(ctx, 'wm-page-spinner', showsPageSpinner);
  },
};
