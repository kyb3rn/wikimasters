import { injectStyle, setClass, watchDom, whenBody } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { placeRarityFilter } from '@/services/list-search';
import { findCardPicker } from '@/site/profile';

const FRAME = 'wm-card-picker';
const SEARCH = 'wm-card-picker-search';
const FIELD = 'wm-card-picker-field';
const LIST = 'wm-card-picker-list';
// Même recherche que la Collection (`q` de `/api/my-collection`), même texte d'aide.
const PLACEHOLDER = 'Rechercher par nom ou description';

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
 * à la Collection. Chaque case clique la pastille du site (cachée) : le filtre reste le sien.
 */
export const profileCardPicker: Feature = {
  id: 'profile-card-picker',
  name: "Choix d'une carte de vitrine",
  description: "La fenêtre de choix d'une carte de vitrine est plus grande ; les raretés se cochent dans des cases à côté de la recherche.",
  category: 'Profil',
  routes: ['/profile', '/profile/:name'],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    await whenBody();
    if (signal.aborted) return;
    injectStyle('profile-card-picker', CSS);

    watchDom(
      () => {
        const picker = findCardPicker();
        if (!picker) return;
        setClass(picker.frame, FRAME, true);
        setClass(picker.search, SEARCH, true);
        setClass(picker.field, FIELD, true);
        if (picker.list) setClass(picker.list, LIST, true);
        // React ne réécrit le texte d'aide que s'il change de son côté.
        if (picker.field.placeholder !== PLACEHOLDER) {
          picker.field.dataset.wmPlaceholder = picker.field.placeholder;
          picker.field.placeholder = PLACEHOLDER;
        }
      },
      { signal },
    );

    placeRarityFilter({
      signal,
      locate: () => {
        const picker = findCardPicker();
        return picker && { parent: picker.search, before: null, pills: picker.pills };
      },
    });

    ctx.onDispose(() => {
      for (const field of document.querySelectorAll<HTMLInputElement>(`input.${FIELD}`)) {
        if (field.dataset.wmPlaceholder !== undefined) field.placeholder = field.dataset.wmPlaceholder;
        delete field.dataset.wmPlaceholder;
      }
      for (const name of [FRAME, SEARCH, FIELD, LIST]) {
        document.querySelectorAll(`.${name}`).forEach((element) => element.classList.remove(name));
      }
    });
  },
};
