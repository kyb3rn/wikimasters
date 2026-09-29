import { tokens } from '@/ui/theme';

export const CSS = `
.wm-root .wm-discard-next { color: ${tokens.danger}; border-color: rgb(248 81 73 / 55%); }
.wm-root .wm-discard-next:hover:not(:disabled) { background: rgb(248 81 73 / 12%); }
.wm-root .wm-discard-next[data-status="busy"] { opacity: 1; }
.wm-root .wm-discard-next:is([data-status="protected"], [data-status="listed"]) { opacity: 0.6;
  color: ${tokens.foreground}; border-color: ${tokens.border}; }
`;
