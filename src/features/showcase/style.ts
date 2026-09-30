import { tokens } from '@/ui/theme';

// Mise en page de la vitrine seulement : les contrôles montrés gardent leurs propres classes. La page 404 du
// site force le fond du `body` (blanc, ou noir en thème sombre) : la vitrine la recouvre avec le fond du site.
export const css = () => `
.wm-showcase { position: fixed; inset: 0; z-index: 1000; overflow-y: auto; background: var(--color-background, #0c0d0c); }
.wm-showcase-page { margin: 0 auto; padding: 0 24px 120px; display: flex; flex-direction: column; gap: 20px; }
.wm-showcase-top { position: sticky; top: 0; z-index: 10; display: flex; flex-wrap: wrap; align-items: center; gap: 12px 24px;
  padding: 20px 0 14px; background: var(--color-background, #0c0d0c); border-bottom: 1px solid ${tokens.border}; }
.wm-showcase-title { margin: 0; font-family: ${tokens.heading}; font-size: 24px; font-weight: 800; }
.wm-showcase-section { scroll-margin-top: 96px; display: flex; flex-direction: column; gap: 22px; }
.wm-showcase-section-title { margin: 0; font-family: ${tokens.heading}; font-size: 18px; font-weight: 700; }
.wm-showcase-group { display: flex; flex-direction: column; gap: 10px; }
.wm-showcase-row { display: flex; flex-wrap: wrap; align-items: center; gap: 16px 20px; }
.wm-showcase-item { min-width: 0; }
.wm-showcase-matrix { display: grid; gap: 12px 16px; align-items: center; justify-items: start; }
.wm-showcase-cell { display: flex; min-width: 0; }
.wm-showcase-field { height: ${tokens.fieldHeight}; }
.wm-showcase-line { display: flex; align-items: stretch; gap: 8px; width: 100%; }
.wm-showcase-line > input { flex: 1; min-width: 0; }
.wm-showcase-face { position: relative; display: flex; align-items: flex-end; width: 150px; height: 210px; padding: 12px;
  border-radius: 12px; border: 1px solid ${tokens.border}; overflow: hidden; font-family: ${tokens.heading}; font-weight: 700;
  background: linear-gradient(160deg, #3b82f6 0%, #1e1b4b 70%); color: #fff; }
.wm-showcase-icons { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 8px; width: 100%; }
.wm-showcase-icon { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px 6px; border-radius: 10px;
  border: 1px solid ${tokens.border}; font-size: 11px; text-align: center; overflow-wrap: anywhere; }
.wm-showcase-icon > span { opacity: 0.55; }
`;
