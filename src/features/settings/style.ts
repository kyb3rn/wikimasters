import { alpha, tokens } from '@/ui/theme';

export const CSS = `
.wm-modal-body:has(.wm-settings-nav) { min-height: 340px; }
.wm-settings-nav { flex: none; width: 240px; padding: 12px; display: flex; flex-direction: column; gap: 4px;
  border-right: 1px solid ${tokens.border}; overflow-y: auto; }
.wm-settings-tab { display: flex; align-items: center; gap: 10px; text-align: left; padding: 8px 12px; border: 0;
  border-radius: 10px; background: none; font: inherit; color: inherit; white-space: nowrap; cursor: pointer; opacity: 0.75; }
.wm-settings-tab svg { flex: none; }
.wm-settings-tab:hover { opacity: 1; background: ${tokens.surfaceLight}; }
.wm-settings-tab[aria-current="page"] { opacity: 1; font-weight: 600; color: ${tokens.accent}; background: ${alpha(tokens.accent, 12, 'srgb')}; }
.wm-settings-tab[data-about] { margin-top: auto; }
.wm-settings-content { flex: 1; min-width: 0; padding: 16px 20px 20px; overflow-y: auto; }
.wm-settings-heading { margin: 0 0 12px; font-family: ${tokens.heading}; font-size: 15px; font-weight: 700; }
.wm-settings-feature { padding: 14px 16px; border: 1px solid ${tokens.border}; border-radius: 12px;
  background: ${alpha(tokens.surfaceLight, 45, 'srgb')}; }
.wm-settings-feature + .wm-settings-feature { margin-top: 10px; }
.wm-settings-section + .wm-settings-section { margin-top: 20px; }
.wm-settings-feature[data-enabled="false"] .wm-settings-rows,
.wm-settings-feature[data-enabled="false"] .wm-settings-main > .wm-settings-row + .wm-settings-row { opacity: 0.5; }
/* Leurs contrôles, désactivés, ne s'estompent pas une seconde fois. */
.wm-settings-feature[data-enabled="false"] .wm-settings-row-control :disabled { opacity: 1; }
.wm-settings-main { display: flex; flex-direction: column; gap: 12px; }
.wm-settings-feature-name { font-weight: 700; }
.wm-settings-text { margin: 4px 0 0; font-size: 12px; opacity: 0.65; }
.wm-settings-error { margin: 6px 0 0; font-size: 12px; color: ${tokens.danger}; }
.wm-settings-rows { margin-top: 12px; padding-top: 12px; border-top: 1px solid ${tokens.border};
  display: flex; flex-direction: column; gap: 12px; }
.wm-settings-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.wm-settings-row[data-stacked] { flex-direction: column; align-items: flex-start; gap: 8px; }
.wm-settings-row[data-stacked] > .wm-settings-row-control { align-self: stretch; }
.wm-settings-row-label { font-size: 13px; font-weight: 600; }
.wm-settings-row-control { flex: none; display: flex; align-items: center; gap: 10px; }
.wm-settings-about p { margin: 0 0 10px; font-size: 13px; line-height: 1.5; opacity: 0.85; }
.wm-settings-about .wm-settings-version { font-size: 12px; opacity: 0.55; }

@media (max-width: 640px) {
  .wm-modal-body:has(.wm-settings-nav) { flex-direction: column; }
  .wm-settings-nav { width: auto; flex-direction: row; overflow-x: auto; border-right: 0;
    border-bottom: 1px solid ${tokens.border}; }
  .wm-settings-tab { flex: none; }
  .wm-settings-tab[data-about] { margin-top: 0; margin-left: auto; }
  .wm-settings-row { flex-wrap: wrap; }
}
`;
