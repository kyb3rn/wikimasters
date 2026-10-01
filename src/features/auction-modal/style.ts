import { alpha, layers, palette, tokens } from '@/ui/theme';

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

@media (max-width: 720px) {
  .wm-sale-columns { flex-direction: column; align-items: center; }
  .wm-sale-form { width: 100%; }
}
`;
