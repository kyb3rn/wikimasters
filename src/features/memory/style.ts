import { snugSearchButtonCss } from '@/services/list-search';
import { alpha, tokens } from '@/ui/theme';

export const CSS = `
.wm-memory-section + .wm-memory-section { margin-top: 24px; }
.wm-memory-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.wm-memory-heading { margin: 0; font-family: ${tokens.heading}; font-size: 15px; font-weight: 700; }
.wm-memory-text { margin: 4px 0 0; font-size: 12px; opacity: 0.65; }
.wm-memory-head-actions { flex: none; display: flex; gap: 8px; }
.wm-memory-tools { display: flex; flex-direction: column; gap: 14px; margin-bottom: 14px; }
.wm-memory-line { display: flex; flex-wrap: wrap; align-items: stretch; gap: 0.75rem; }
.wm-memory-search { flex: 1 1 260px; min-width: 0; }
.wm-memory-sort { flex: 0 0 9rem; }
${snugSearchButtonCss('.wm-memory-line')}
.wm-memory-more { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 1rem 1.5rem; }
.wm-memory-when { width: 15rem; }
.wm-memory-results { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px;
  min-height: 32px; margin-bottom: 8px; font-size: 13px; }
.wm-memory-results > span { opacity: 0.7; font-variant-numeric: tabular-nums; }
.wm-memory-selection { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 8px; padding: 6px 10px;
  border-radius: 10px; background: ${alpha(tokens.accent, 10, 'srgb')}; font-size: 13px; }
.wm-memory-only { display: flex; align-items: center; gap: 8px; margin-left: auto; cursor: pointer; }
.wm-memory-pages { display: flex; justify-content: center; margin: 10px 0; }
.wm-memory-list { list-style: none; margin: 0; padding: 0; border: 1px solid ${tokens.border}; border-radius: 12px; overflow: hidden; }
.wm-memory-row { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 6px 12px; font-size: 13px; }
.wm-memory-row + .wm-memory-row { border-top: 1px solid ${tokens.border}; }
.wm-memory-row:not([data-head]):hover { background: ${alpha(tokens.surfaceLight, 60, 'srgb')}; }
.wm-memory-row[data-head] { min-height: 32px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;
  background: ${alpha(tokens.surfaceLight, 45, 'srgb')}; }
.wm-memory-row[data-head] > span { opacity: 0.55; }
.wm-memory-row[data-child] { padding-left: 52px; background: ${alpha(tokens.surfaceLight, 30, 'srgb')}; }
.wm-memory-check { flex: none; width: 16px; height: 16px; margin: 0; accent-color: ${tokens.accent}; cursor: pointer; }
.wm-memory-check:disabled { cursor: not-allowed; }
.wm-memory-spacer { flex: none; width: 20px; }
.wm-memory-main { flex: 1; min-width: 0; }
.wm-memory-title { display: flex; align-items: center; gap: 6px; min-width: 0; font-weight: 600; }
.wm-memory-name, .wm-memory-open { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wm-memory-open { padding: 0; border: 0; background: none; font: inherit; font-weight: 600; color: inherit; text-align: left; cursor: pointer; }
.wm-memory-open:hover { color: ${tokens.accent}; text-decoration: underline; }
.wm-memory-details { margin-top: 2px; font-size: 12px; opacity: 0.6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wm-memory-count { flex: none; width: 110px; text-align: right; font-size: 12px; opacity: 0.75; font-variant-numeric: tabular-nums; }
.wm-memory-date { flex: none; width: 92px; text-align: right; font-size: 12px; opacity: 0.7; font-variant-numeric: tabular-nums; }
.wm-memory-date[data-stale] { color: ${tokens.warning}; opacity: 1; }
.wm-memory-size { flex: none; width: 64px; text-align: right; font-size: 12px; opacity: 0.55; font-variant-numeric: tabular-nums; }
.wm-memory-actions { flex: none; width: 96px; display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
.wm-memory-list[data-refresh] .wm-memory-actions { width: 132px; }
.wm-memory-empty { padding: 16px; font-size: 13px; opacity: 0.55; text-align: center; }
.wm-memory-block { padding: 14px 16px; border: 1px solid ${tokens.border}; border-radius: 12px; background: ${alpha(tokens.surfaceLight, 45, 'srgb')}; }
.wm-memory-choice { display: flex; align-items: center; gap: 10px; padding: 5px 0; font-size: 13px; cursor: pointer; }
.wm-memory-choice[data-disabled] { opacity: 0.5; cursor: default; }
.wm-memory-choice-name { font-weight: 600; }
.wm-memory-choice-note { margin-left: auto; font-size: 12px; opacity: 0.65; font-variant-numeric: tabular-nums; }
.wm-memory-buttons { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.wm-memory-buttons:first-child { margin-top: 0; }
.wm-memory-file { margin: 0 0 8px; font-size: 12px; opacity: 0.65; }
`;
