import { alpha, DISABLED_OPACITY, layers, palette, tokens } from '@/ui/theme';

// Mise en page seulement : les contrôles (mise, durées, boutons, croix, erreur) portent les classes du site.
export const CSS = `
.wm-sale-backdrop { position: fixed; inset: 0; z-index: ${layers.window}; display: flex; align-items: center;
  justify-content: center; padding: 16px; background: ${tokens.backdrop}; backdrop-filter: ${tokens.backdropBlur};
  font-size: 13px; }
.wm-sale { position: relative; width: min(760px, 100%); max-height: calc(100vh - 32px); overflow: auto;
  padding: 18px 20px 16px; background: ${tokens.surface}; border: 1px solid ${tokens.border}; border-radius: 16px;
  box-shadow: 0 20px 60px rgb(0 0 0 / 55%); outline: none; animation: wm-fade-in 0.18s ease-out; }

.wm-sale-status { margin: 0 36px 12px 0; }
/* Limite d'enchères atteinte : l'encart d'erreur du site (siteClass.formError), en ambre. */
.wm-sale-warning { padding: 8px 12px; border-radius: 8px; font-size: 14px; color: ${palette.amber[400]};
  background: ${alpha(palette.amber[500], 10)}; }

.wm-sale-columns { display: flex; gap: 22px; align-items: flex-start; }
.wm-sale-card { flex: none; display: flex; justify-content: center; }
.wm-sale-card * { cursor: default; }
.wm-sale-noface { display: flex; align-items: center; justify-content: center; width: 288px; height: 420px; padding: 12px;
  border: 1px dashed ${tokens.border}; border-radius: 16px; font-weight: 600; text-align: center; }
.wm-sale-form { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 14px; }
.wm-sale-title { padding-right: 36px; font-family: ${tokens.heading}; font-size: 18px; font-weight: 700; }
.wm-sale-quota { font-size: 12.5px; opacity: 0.9; }
.wm-sale-quota[data-full] { color: ${palette.red[400]}; opacity: 1; font-weight: 600; }
.wm-sale-muted { opacity: 0.55; }
.wm-sale-note { margin-top: -8px; font-size: 11px; opacity: 0.5; }
.wm-sale-field { display: flex; flex-direction: column; gap: 6px; }
.wm-sale-actions { display: flex; gap: 8px; margin-top: 2px; }
.wm-sale-wished { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }

/*
 * Historique des mises en vente (cadre et modale « Tout voir ») : lignes du site (siteClass.listRow), colonnes alignées ;
 * liste élargie de la marge des lignes, leur texte dans l'alignement des libellés. La rangée du titre l'est aussi à
 * droite : « Tout voir » finit au bord des liens vers les enchères.
 */
.wm-sale-history-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 20px;
  margin-right: -12px; }
.wm-sale-history-list { display: flex; flex-direction: column; gap: 2px; margin: 0 -12px; padding: 0; list-style: none; }
.wm-sale-history-item { display: flex; align-items: center; gap: 4px; }
.wm-sale-history-row { flex: 1; min-width: 0; font-size: 13px; white-space: nowrap; }
.wm-sale-history-row:disabled { opacity: ${DISABLED_OPACITY}; }
.wm-sale-history-date { font-variant-numeric: tabular-nums; }
.wm-sale-history-gap { flex: 1; }
.wm-sale-history-price { display: inline-flex; align-items: center; gap: 4px; font-weight: 700; font-variant-numeric: tabular-nums; }
.wm-sale-history-coin { width: 14px; height: 14px; opacity: 0.6; }
.wm-sale-history-duration { min-width: 44px; text-align: right; opacity: 0.8; }
.wm-sale-history-nolink { flex: none; width: 30px; }

@media (max-width: 720px) {
  .wm-sale-columns { flex-direction: column; align-items: center; }
  .wm-sale-form { width: 100%; }
}
`;
