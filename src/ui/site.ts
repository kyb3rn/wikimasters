/**
 * Classes Tailwind du site, recopiées de son balisage (captures et code du 29/09/2026) : nos interfaces
 * reprennent ses contrôles tels quels plutôt que de les redessiner. Une classe n'existe que si le site
 * s'en sert lui-même : ne recopier que des classes relevées chez lui (`npm run site:classes` le vérifie).
 */
export const siteClass = {
  /** Croix de fermeture de ses modales (carte, mise aux enchères), sans sa position `absolute top-3 right-3`. */
  closeButton:
    'flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-foreground)]/45 ' +
    'hover:bg-[var(--color-surface-light)] hover:text-[var(--color-foreground)] transition-colors cursor-pointer',
  /** Position de cette croix dans ses modales. */
  closeButtonPosition: 'absolute top-3 right-3',

  // Mise de départ de la mise aux enchères : − · pièce · valeur · +.
  fieldLabel: 'text-xs font-semibold text-[var(--color-foreground)]/70 uppercase tracking-wide',
  stepper:
    'relative flex items-stretch rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] ' +
    'focus-within:border-[var(--color-accent)] overflow-hidden',
  stepperButton:
    'flex items-center justify-center px-2.5 text-[var(--color-foreground)]/60 hover:text-[var(--color-foreground)] ' +
    'hover:bg-[var(--color-surface-light)] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed',
  stepperMinus: 'border-r border-[var(--color-border)]',
  stepperPlus: 'border-l border-[var(--color-border)]',
  stepperCoin: 'pl-3 flex items-center pointer-events-none',
  stepperCoinIcon: 'size-4 text-[var(--color-foreground)]/40',
  /** Unité après la valeur (nos réglages : « ms »), dans le ton de la pièce. */
  stepperUnit: 'pr-2 flex items-center pointer-events-none text-xs text-[var(--color-foreground)]/40',
  stepperInput:
    'flex-1 min-w-0 px-3 py-2.5 bg-transparent outline-none text-sm tabular-nums text-center [appearance:textfield] ' +
    '[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',

  // Durées de la mise aux enchères : pastilles.
  pills: 'flex flex-wrap gap-2',
  pill: 'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer',
  pillActive: 'bg-[var(--color-accent)] text-[var(--color-accent-foreground)] border-[var(--color-accent)]',
  pillIdle:
    'border-[var(--color-border)] text-[var(--color-foreground)]/60 hover:text-[var(--color-foreground)] ' +
    'hover:border-[var(--color-accent)]/50',

  // Boutons Annuler / Lancer l'enchère ; contenu (icône + texte) centré, comme ses boutons de modale de carte.
  buttonContent: 'inline-flex items-center justify-center gap-2',
  buttonSecondary:
    'flex-1 py-2.5 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-foreground)]/70 ' +
    'hover:bg-[var(--color-surface-light)] transition-colors cursor-pointer disabled:opacity-50',
  buttonPrimary:
    'flex-1 py-2.5 rounded-lg bg-[var(--color-accent)] text-[var(--color-accent-foreground)] text-sm font-semibold ' +
    'hover:bg-[var(--color-accent-light)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
} as const;
