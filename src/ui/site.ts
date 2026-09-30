/**
 * Classes Tailwind du site, recopiées de son balisage (captures et code du 29/09/2026) : nos interfaces
 * reprennent ses contrôles tels quels plutôt que de les redessiner. Une classe n'existe que si le site
 * s'en sert lui-même : ne recopier que des classes relevées chez lui (`npm run site:classes` le vérifie).
 */
export const siteClass = {
  /** Position de la croix de ses modales (carte, mise aux enchères), au-dessus du contenu. */
  closeButtonPosition: 'absolute top-3 right-3 z-20',

  /** Cadre de ses panneaux (modales, fiche de carte), avec leur marge intérieure. */
  panel: 'card-frame p-6',

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

  // Cadre du pack PRO du jour (/pulls) : cadre violet, titre dans le ton de son « Pack PRO du jour », texte.
  proFrame: 'rounded-xl border border-violet-500/25 bg-violet-950/20 px-4 py-3 flex flex-col gap-3 animate-fade-in-up',
  proTitle: 'text-lg font-bold text-violet-200/90',
  proText: 'text-xs text-[var(--color-foreground)]/50',

  // Offre « Vue du marché PRO » (sa modale sans PRO, capture et code du 30/09/2026) : encadré violet et sa courbe
  // en filigrane, tuile d'icône, titre et étiquette PRO, texte, avantages, prix.
  proOffer:
    'relative overflow-hidden rounded-xl border border-violet-500/25 bg-gradient-to-br from-violet-950/30 ' +
    'via-[var(--color-surface)]/80 to-fuchsia-950/20 p-4',
  proOfferArt: 'pointer-events-none absolute inset-0 opacity-[0.07]',
  proOfferArtSvg: 'h-full w-full',
  proOfferArtLine: 'text-violet-400',
  proOfferBody: 'relative space-y-4',
  proOfferHead: 'flex items-start gap-3',
  proOfferIcon: 'flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 border border-violet-400/20',
  proOfferIconSvg: 'size-4 text-violet-300',
  proOfferHeading: 'min-w-0',
  proOfferTitleRow: 'flex flex-wrap items-center gap-2',
  proOfferTitle: 'text-sm font-bold text-[var(--color-foreground)]',
  proTag:
    'inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold uppercase ' +
    'tracking-wide text-violet-300 border border-violet-500/25',
  proTagIcon: 'size-3',
  proOfferText: 'mt-1 text-xs text-[var(--color-foreground)]/60 leading-relaxed',
  proOfferList: 'space-y-2 text-[11px] text-[var(--color-foreground)]/70',
  proOfferItem: 'flex items-start gap-2',
  proOfferItemIcon: 'size-3.5 shrink-0 text-violet-400 mt-0.5',
  proOfferPrice: 'text-[10px] text-center text-[var(--color-foreground)]/40',
  /** Petit badge PRO dans le coin d'un bouton de marché (compte sans PRO), étincelles seules ; le bouton en `relative`. */
  proBadge:
    'absolute -top-1 -right-1 inline-flex items-center rounded px-1 py-px text-[7px] font-bold uppercase tracking-wide ' +
    'bg-violet-600 text-white leading-none',
  proBadgeIcon: 'size-2',
  proBadgeHost: 'relative',

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

  // Pagination : rangée de la sienne (Collection), numéro de page dans le ton de son « Page x / y »,
  // champ de page comme son champ de recherche.
  paginationBar: 'flex items-center justify-center gap-2 py-3',
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

  /** Rangée d'actions de la modale de carte (Vendre, Défausser), sous ses deux colonnes. */
  cardModalActions: 'mt-3 space-y-2',
  cardModalActionsRow: 'flex flex-col sm:flex-row gap-2',

  // En-tête de son profil : photo (fond d'accent léger, initiales), pseudo, ligne sous le pseudo, chiffre et
  // légende de sa carte « Cartes uniques », étiquettes (couleurs en style), interrupteur de visibilité (piste et
  // bouton, allumé ou non).
  profileAvatar: 'rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center overflow-hidden',
  profileAvatarInitials: 'font-bold text-[var(--color-accent)]',
  profileAvatarImage: 'w-full h-full object-cover',
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

  // Confirmation « Défausser cette carte ? » : fond, cadre, titre (police des titres, en style), texte, rangée des boutons.
  confirmOverlay: 'fixed inset-0 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm',
  confirmFrame: 'card-frame max-w-sm w-full p-5 animate-fade-in-up',
  confirmTitle: 'text-base font-bold mb-2',
  confirmText: 'text-sm text-[var(--color-foreground)]/70 mb-4',
  confirmActions: 'flex gap-2',

  /** Champ de texte d'une ligne (recherche de la Collection, des amis), sans sa largeur. */
  textField:
    'rounded-lg bg-[var(--color-surface-light)] border border-[var(--color-border)] px-4 py-2.5 text-sm ' +
    'text-[var(--color-foreground)] placeholder:text-[var(--color-foreground)]/30 focus:outline-none focus:ring-2 ' +
    'focus:ring-[var(--color-accent)]/50',

  // Formulaire « Créer une guilde » : libellé, champ, zone de texte, compteur de caractères, message d'erreur.
  formLabel: 'text-xs font-medium text-[var(--color-foreground)]/50 uppercase tracking-wide',
  formInput:
    'w-full mt-1 px-3 py-2 rounded-xl bg-[var(--color-surface-light)] border border-[var(--color-border)] text-sm ' +
    'placeholder:text-[var(--color-foreground)]/30 focus:outline-none focus:border-[var(--color-accent)]/50 transition-colors',
  formTextarea: 'resize-none',
  formCounter: 'text-[10px] text-[var(--color-foreground)]/30 mt-1',
  formError: 'text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg',
  formFields: 'space-y-3',
  formStack: 'space-y-4',

  /** Texte d'un bouton masqué sur mobile, icône seule (« Message », « Échanger » de la page Amis). */
  wideOnly: 'hidden sm:inline',
} as const;
