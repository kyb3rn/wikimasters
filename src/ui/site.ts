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
  /** Position de cette croix dans ses modales, au-dessus du contenu (comme dans la modale de carte). */
  closeButtonPosition: 'absolute top-3 right-3 z-20',
  /** Bouton rond à icône (même forme que cette croix), sans couleur : voir `iconOn` / `iconOff`. */
  iconButton:
    'flex h-9 w-9 items-center justify-center rounded-full hover:bg-[var(--color-surface-light)] transition-colors cursor-pointer',
  iconOn: 'text-[var(--color-accent)]',
  iconOff: 'text-[var(--color-foreground)]/45 hover:text-[var(--color-foreground)]',

  // Cadre des paquets disponibles (/pulls) : compteur, légende, temps restant.
  frame: 'card-frame px-6 py-3',
  counterValue: 'text-lg font-bold',
  counterAccent: 'text-[var(--color-accent)]',
  counterMuted: 'text-[var(--color-foreground)]/40',
  counterLabel: 'text-xs text-[var(--color-foreground)]/40',
  /** Temps avant le prochain paquet, un cran au-dessus des autres valeurs : même hauteur de ligne, le cadre ne bouge pas. */
  counterTime: 'text-[var(--color-accent)] font-mono text-xl',
  /**
   * Compteur de paquets seul, sans légende, en demi-gras : nombre disponible plus gros que le maximum, centrés
   * l'un sur l'autre, le maximum descendu de 2 px (centré au pixel près, il paraît trop haut).
   */
  counterPair: 'flex items-center gap-1.5 font-semibold',
  counterCount: 'text-3xl',
  counterMax: 'relative top-0.5 text-lg',

  // Cadre du pack PRO du jour (/pulls) : cadre violet, titre dans le ton de son « Pack PRO du jour », texte,
  // bouton d'ouverture (dégradé : relevé dans son code et sa feuille de style, absent des captures où le pack
  // n'était pas disponible).
  proFrame: 'rounded-xl border border-violet-500/25 bg-violet-950/20 px-4 py-3 flex flex-col gap-3 animate-fade-in-up',
  proTitle: 'text-lg font-bold text-violet-200/90',
  proText: 'text-xs text-[var(--color-foreground)]/50',
  proButton:
    'w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 ' +
    'to-fuchsia-600 text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed ' +
    'transition-all cursor-pointer',

  /** Choix entre deux options à icône : cadre du champ de mise, options en pastille active / inactive. */
  segmented: 'flex items-stretch rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden',
  segment: 'flex h-9 items-center justify-center px-2.5 transition-colors cursor-pointer',
  segmentActive: 'bg-[var(--color-accent)] text-[var(--color-accent-foreground)]',
  segmentIdle: 'text-[var(--color-foreground)]/60 hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface-light)]',

  /** Le même, sur le fond des champs et à leur hauteur (raretés de la Collection) : options collées, extrémités arrondies. */
  fieldSegmented:
    'flex shrink-0 items-stretch rounded-lg bg-[var(--color-surface-light)] border border-[var(--color-border)] overflow-hidden',
  fieldSegment: 'flex flex-1 items-center justify-center px-3 text-sm font-semibold transition-colors cursor-pointer',
  /** Trait entre deux options. */
  segmentSeparator: 'border-l border-[var(--color-border)]',
  fieldSegmentIdle: 'text-[var(--color-foreground)]/60 hover:text-[var(--color-foreground)] hover:bg-[var(--color-border)]',

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

  /** Bouton de ses listes déroulantes (Collection) sans sa mise en page, icône dans le ton de leur chevron. */
  listboxButton:
    'flex shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-light)] ' +
    'text-[var(--color-foreground)]/40 hover:text-[var(--color-foreground)]/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ' +
    'transition-[border-color,box-shadow] hover:border-[var(--color-foreground)]/12 focus:outline-none focus:ring-2 ' +
    'focus:ring-[var(--color-accent)]/35 cursor-pointer',

  /** Bouton à icône, couleur d'accent (le vert du site), de la hauteur de ses listes déroulantes (Collection). */
  accentFieldButton:
    'flex shrink-0 items-center justify-center min-h-[42px] px-3 rounded-lg bg-[var(--color-accent)] ' +
    'text-[var(--color-accent-foreground)] hover:bg-[var(--color-accent-light)] transition-colors cursor-pointer',

  // Pagination : rangée de la sienne (Collection), boutons de celles de ses modales (avec cadre), numéro
  // de page dans le ton de son « Page x / y », champ de page comme son champ de recherche.
  paginationBar: 'flex items-center justify-center gap-2 py-3',
  paginationButton:
    'flex shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-light)] ' +
    'text-[var(--color-foreground)]/70 hover:bg-[var(--color-accent)]/10 transition-colors cursor-pointer ' +
    'disabled:opacity-30 disabled:cursor-not-allowed',
  paginationText: 'text-sm text-[var(--color-foreground)]/40',
  paginationInput:
    'w-16 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-light)] px-2 py-2.5 text-sm text-center ' +
    'tabular-nums text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 ' +
    'disabled:opacity-30 disabled:cursor-not-allowed [appearance:textfield] ' +
    '[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',

  // Étiquettes : pastille de la modale de carte (couleurs en style, voir `tagChipStyle`) et sa croix de retrait.
  tagChip: 'inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs font-medium border',
  tagChipRemove: 'p-0.5 rounded-full hover:bg-black/25 transition-colors cursor-pointer',
  /** Rangée de pastilles d'étiquettes. */
  tagChips: 'flex flex-wrap gap-1.5',

  /** Badge de rareté de la modale de carte (fond à la couleur de la rareté, en style : voir `rarityBadgeStyle`). */
  rarityBadge: 'inline-block px-2 py-0.5 rounded text-xs font-bold',

  /** Bouton pleine largeur, couleur d'accent (« Terminé » de l'étiquetage groupé), contenu centré. */
  wideButton:
    'w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[var(--color-accent)] ' +
    'text-[var(--color-accent-foreground)] text-sm font-semibold hover:bg-[var(--color-accent-light)] transition-colors ' +
    'cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',

  /** Bouton gris du site (« Défausser » de la modale de carte), large selon son texte. */
  button:
    'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--color-border)] ' +
    'text-sm font-medium text-[var(--color-foreground)]/70 hover:bg-[var(--color-surface-light)] transition-colors ' +
    'cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed',
  /** Le même en rouge plein, comme le « Défausser » de ses confirmations (« Confirmer ? »). */
  buttonConfirm:
    'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-transparent bg-red-500 text-white text-sm ' +
    'font-semibold hover:bg-red-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',

  // En-tête de son profil : photo (fond d'accent léger, initiales), pastille de modification (celle qu'il montre
  // au survol de la photo), pseudo, ligne sous le pseudo, chiffre et légende de sa carte « Cartes uniques »,
  // étiquettes (couleurs en style), interrupteur de visibilité (piste et bouton, allumé ou non).
  profileAvatar: 'rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center overflow-hidden',
  profileAvatarInitials: 'font-bold text-[var(--color-accent)]',
  profileAvatarImage: 'w-full h-full object-cover',
  profileAvatarEdit:
    'flex items-center justify-center rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] shadow ' +
    'text-[var(--color-foreground)]/70 hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface-light)] ' +
    'transition-colors cursor-pointer',
  profileName: 'text-2xl font-bold truncate min-w-0',
  profileDetails: 'text-xs text-[var(--color-foreground)]/45',
  statValue: 'text-2xl font-bold text-[var(--color-accent)] whitespace-nowrap',
  statLabel: 'text-xs text-[var(--color-foreground)]/40 mt-1',
  profileTags: 'flex flex-wrap gap-1',
  profileTag:
    'inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none',
  profileTagName: 'min-w-0 truncate',
  profileTagCount: 'shrink-0 opacity-75 font-medium tabular-nums',
  /** Pastille de la visibilité du profil, posée sur le fond de l'en-tête : icône, texte, interrupteur. */
  visibilityButton:
    'inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/90 ' +
    'backdrop-blur-sm pl-3 pr-1 py-1 text-xs font-medium text-[var(--color-foreground)]/70 hover:text-[var(--color-foreground)] ' +
    'transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
  switchTrack: 'relative w-11 h-6 rounded-full transition-colors flex-shrink-0',
  switchTrackOn: 'bg-[var(--color-accent)]',
  switchTrackOff: 'bg-[var(--color-surface-light)]',
  switchKnob: 'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
  switchKnobOn: 'translate-x-5',
  switchKnobOff: 'translate-x-0',

  // Compte de la sélection (Collection) : nombre en accent, puis « sélectionnées ».
  selectionCount: 'flex items-center gap-2 text-sm',
  selectionCountValue: 'font-semibold text-[var(--color-accent)]',
  selectionCountLabel: 'text-[var(--color-foreground)]/60',

  // Boutons Annuler / Lancer l'enchère ; contenu (icône + texte) centré, comme ses boutons de modale de carte.
  buttonContent: 'inline-flex items-center justify-center gap-2',
  buttonSecondary:
    'flex-1 py-2.5 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-foreground)]/70 ' +
    'hover:bg-[var(--color-surface-light)] transition-colors cursor-pointer disabled:opacity-50',
  buttonPrimary:
    'flex-1 py-2.5 rounded-lg bg-[var(--color-accent)] text-[var(--color-accent-foreground)] text-sm font-semibold ' +
    'hover:bg-[var(--color-accent-light)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
} as const;
