import { classMarks, watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { applySearchPlaceholder, placeRarityFilter } from '@/services/list-search';
import { findCardPicker } from '@/site/profile';
import { MY_PROFILE_ROUTE, PROFILE_ROUTE } from '@/site/routes';

const FRAME = 'wm-card-picker';
const SEARCH = 'wm-card-picker-search';
const FIELD = 'wm-card-picker-field';
const LIST = 'wm-card-picker-list';

/*
 * Largeur : un peu plus du double du site (`max-w-md`, 448 px) pour que 5 cartes tiennent par ligne (5 × 160 px et
 * 4 écarts de 16 px, plus les marges, le cadre et une barre de défilement) : les 20 cartes d'une page font 4 lignes
 * pleines. À 896 px, il n'en tiendrait que 4. Hauteur : celle du site (85 % de l'écran), 900 px au plus.
 * Champ et cases de rareté sur une ligne, écart de 12 px comme à la Collection ; trop étroite, les cases passent
 * dessous. Les marges de `space-y-3` (entre le champ et les pastilles, cachées) sont retirées.
 * La zone qui défile coupe ce qui la dépasse : le site ne laisse que 8 px au-dessus de la première ligne, le halo
 * des cartes (`glow-*` : ombre floue jusqu'à 28 px, 30 pour les shiny, un peu plus au survol) y était coupé. Il a
 * maintenant 32 px ; la recherche cède presque toute sa marge du bas pour que l'écart ne double pas.
 */
const CSS = `
.${FRAME} { max-width: 58rem; max-height: min(85vh, 900px); }
.${SEARCH} { display: flex; flex-wrap: wrap; align-items: stretch; gap: 0.75rem; padding-bottom: 0.25rem; }
.${SEARCH} > * { margin-block: 0; }
.${SEARCH} > .${FIELD} { flex: 1 1 300px; min-width: 0; }
.${LIST} { padding-top: 1.5rem; }
`;

/**
 * « Choisir une carte » de la vitrine : fenêtre élargie, raretés en cases collées à côté de la recherche, comme
 * à la Collection (même recherche, `q` de `/api/my-collection` : même texte d'aide). Chaque case clique la
 * pastille du site (cachée) : le filtre reste le sien.
 */
export const profileCardPicker: Feature = {
  id: 'profile-card-picker',
  name: "Choix d'une carte de vitrine",
  description: "La fenêtre de choix d'une carte de vitrine est plus grande ; les raretés se cochent dans des cases à côté de la recherche.",
  category: 'Profil',
  routes: [MY_PROFILE_ROUTE, PROFILE_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    if (!(await ctx.ready())) return;
    ctx.style(CSS);

    const marks = classMarks(signal);
    watchDom(() => {
      const picker = findCardPicker();
      if (!picker) return;
      marks.only(FRAME, [picker.frame]);
      marks.only(SEARCH, [picker.search]);
      marks.only(FIELD, [picker.field]);
      marks.only(LIST, picker.list ? [picker.list] : []);
      applySearchPlaceholder(picker.field, signal);
    }, { signal });

    placeRarityFilter({
      signal,
      locate: () => {
        const picker = findCardPicker();
        return picker && { parent: picker.search, before: null, pills: picker.pills };
      },
    });
  },
};
