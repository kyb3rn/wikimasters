import { defineSettings } from '@/core/settings';

export const resaleSettings = /* @__PURE__ */ defineSettings('resale', {
  holdSearch: {
    type: 'boolean',
    label: 'Empêcher le rechargement automatique',
    description: 'Changer un filtre ou taper une recherche ne change pas la liste : la recherche part avec Entrée ou son bouton.',
    default: true,
  },
});
