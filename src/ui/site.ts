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

  // Page introuvable (« Profil introuvable ») : grande icône pâle, lien de retour en accent.
  notFoundIcon: 'size-12 text-[var(--color-foreground)]/30',
  notFoundLink: 'text-[var(--color-accent)] text-sm hover:underline',

  // Menu latéral (ordinateur, capture du 03/10/2026) : lien, éteint ou allumé (teinte et texte accent, point à droite),
  // boîte de son icône et l'icône ; trait de séparation (celui du haut de sa barre du bas, sur téléphone).
  navLink: 'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
  navLinkIdle: 'text-[var(--color-foreground)]/60 hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface-light)]',
  navLinkActive: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]',
  navLinkIconBox: 'flex shrink-0 items-center justify-center text-[var(--color-foreground)]',
  navLinkIcon: 'w-5 h-5 md:w-6 md:h-6 shrink-0',
  navLinkDot: 'ml-auto w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]',
  navSeparator: 'border-t border-[var(--color-border)]',

  // Page d'une liste (Collection, code du 02/10/2026) : corps sous le menu, rangée du titre, titre (police des titres,
  // en style).
  pageBody: 'flex-1 p-4 md:p-6 space-y-6',
  pageHeader: 'flex items-center justify-between gap-3 animate-fade-in-up',
  pageTitle: 'text-2xl md:text-3xl font-bold',
  /** Titre et ce qui le suit, à gauche (le haut à droite est sous le cadre du solde). */
  pageTitleGroup: 'flex flex-wrap items-center gap-3',
  /** Montant mis en avant à côté du titre (total des prix souhaités : mauve, comme eux) et sa pièce. */
  pageTotal: 'inline-flex items-center gap-1 text-lg font-bold text-violet-300 tabular-nums',
  pageTotalIcon: 'size-4 shrink-0',
  /** Texte discret de la page, dans le ton de son « Page x / y ». */
  pageNote: 'text-sm text-[var(--color-foreground)]/40',
  /** Titre d'une section de la page, avec son nombre (« Batailles en cours (1) », code du 29/09/2026). */
  sectionTitle: 'text-sm font-semibold text-[var(--color-foreground)]/50 uppercase tracking-wide',
  /** Bloc des filtres, sous le titre. */
  pageFilters: 'space-y-3 animate-fade-in-up',
  /** Pagination et grille (le site fait défiler jusqu'à son haut au changement de page). */
  pageList: 'scroll-mt-4 space-y-3',
  /** Rangée de cartes de la Collection et case de chaque carte. */
  cardGrid: 'flex flex-wrap justify-center gap-3 sm:gap-[22px] md:gap-[26px]',
  cardCell: 'relative isolate group',
  // Rond de chargement d'une page, à la place de son contenu (code du 29/09/2026).
  pageSpinnerBox: 'flex-1 flex items-center justify-center',
  pageSpinner: 'w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin',

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
  // Bas = côtés (pb-4) : le bouton pleine largeur a la même marge autour de lui ; le haut reste serré pour le texte.
  proFrame: 'rounded-xl border border-violet-500/25 bg-violet-950/20 px-4 pt-3 pb-4 flex flex-col gap-3 animate-fade-in-up',
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

  // Vue du marché du site (son historique des ventes, code du 02/10/2026) : sections, pastilles de rareté (allumée :
  // « Toutes » en accent, une rareté à sa couleur, en style), tuiles, cadre du graphique et son info-bulle, liste des
  // dernières ventes. Titres des sections : `fieldLabel`.
  marketView: 'space-y-5',
  marketViewSection: 'space-y-2',
  marketViewNote: 'normal-case font-normal text-[var(--color-foreground)]/40 ml-1',
  marketViewPills: 'flex flex-wrap gap-1.5',
  marketViewPill: 'px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors cursor-pointer',
  marketViewPillAll: 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent)]/10',
  marketViewPillIdle:
    'border-[var(--color-border)] text-[var(--color-foreground)]/55 hover:text-[var(--color-foreground)] ' +
    'hover:border-[var(--color-foreground)]/25',
  marketViewTiles: 'grid grid-cols-2 sm:grid-cols-5 gap-1.5 sm:gap-2',
  marketViewTile:
    'rounded-md sm:rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/60 px-2 py-1 sm:px-3 sm:py-2 min-w-0',
  marketViewTileLabel: 'text-[9px] sm:text-[10px] uppercase tracking-wide text-[var(--color-foreground)]/45 truncate leading-tight',
  marketViewTileValue: 'text-[11px] sm:text-sm font-semibold tabular-nums text-[var(--color-foreground)]/90 mt-0.5 truncate leading-tight',
  marketViewTilePrice:
    'inline-flex items-center gap-0.5 sm:gap-1 text-[11px] sm:text-sm font-semibold text-[var(--color-accent)] tabular-nums ' +
    'mt-0.5 truncate leading-tight',
  marketViewTileCoin: 'size-3 sm:size-3.5 shrink-0',
  marketViewChart: 'rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-2 pt-2.5',
  /** Info-bulle du graphique (fond, trait et texte du thème en style). */
  marketViewTip: 'rounded-lg border px-3 py-2.5 shadow-lg text-xs min-w-[11rem]',
  marketViewTipDate: 'font-medium text-[var(--color-foreground)]/90 mb-1.5',
  marketViewTipRow: 'flex items-center justify-between gap-3',
  marketViewTipPrice: 'inline-flex items-center gap-1 font-bold tabular-nums text-[var(--color-accent)]',
  /** Badge de rareté d'une vente (texte à la couleur de la rareté sur sa teinte, en style). */
  marketViewRarity: 'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide shrink-0',
  marketViewList: 'rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)] overflow-hidden',
  marketViewRow: 'flex items-center justify-between gap-3 px-4 py-2.5 text-sm bg-[var(--color-surface)]/30',
  marketViewRowStart: 'flex items-center gap-2 min-w-0',
  marketViewRowDate: 'text-xs text-[var(--color-foreground)]/40 tabular-nums',
  marketViewRowPrice: 'inline-flex items-center gap-1 font-semibold text-[var(--color-accent)] tabular-nums shrink-0',
  marketViewCoin: 'size-3.5',
  marketViewEmpty: 'text-sm text-[var(--color-foreground)]/40',

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
  /** Option estompée quand elle est désactivée (croix « Réinitialiser » de ses pastilles de rareté). */
  fadedWhenDisabled: 'disabled:opacity-40',

  // Mise de départ de la mise aux enchères : − · pièce · valeur · +.
  /** Petit titre en capitales : « Mise de départ », sections de la vue du marché. */
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

  // En-tête des profils : cadre (celui du site, sans marge : notre fond va de bord à bord), photo (fond d'accent
  // léger, initiales), pseudo, ligne sous le pseudo, chiffre et légende de sa carte « Cartes uniques », étiquettes
  // (couleurs en style), interrupteur de visibilité (piste et bouton, allumé ou non).
  profileHeaderFrame: 'card-frame overflow-hidden animate-fade-in-up',
  profileAvatar: 'rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center overflow-hidden',
  profileAvatarInitials: 'font-bold text-[var(--color-accent)]',
  profileAvatarImage: 'w-full h-full object-cover',
  profileName: 'text-2xl font-bold truncate min-w-0',
  profileDetails: 'text-xs text-[var(--color-foreground)]/45',
  /** « Demande d'ami envoyée », « <pseudo> vous a envoyé une demande d'ami » (profil d'un joueur qui n'est pas un ami). */
  profileRequestText: 'text-sm text-[var(--color-foreground)]/50',
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

  // Sa liste déroulante (Collection, Toutes les cartes ; code du 30/09/2026) : bouton à hauteur de champ, valeur,
  // chevron ; menu (en `position: fixed`, dans `body`), option, option choisie ou survolée ; étiquette en pastille
  // (couleurs en style, voir `tagChipStyle`).
  listbox: 'relative',
  listboxButton:
    'flex w-full min-h-[42px] min-w-0 items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] ' +
    'bg-[var(--color-surface-light)] py-2 pl-3 pr-2 text-left text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ' +
    'transition-[border-color,box-shadow] hover:border-[var(--color-foreground)]/12 focus:outline-none focus:ring-2 ' +
    'focus:ring-[var(--color-accent)]/35',
  listboxValue: 'flex min-w-0 flex-1 items-center justify-start',
  listboxText: 'block min-w-0 truncate text-left font-medium leading-none text-[var(--color-foreground)]',
  listboxChip: 'inline-flex max-w-full min-w-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-none',
  listboxChipText: 'min-w-0 truncate',
  listboxChevron: 'size-4 shrink-0 text-[var(--color-foreground)]/40 transition-transform duration-200',
  listboxChevronOpen: 'rotate-180',
  listboxMenu:
    'max-h-52 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] py-1 shadow-xl ' +
    'ring-1 ring-black/25',
  listboxOption: 'flex w-full cursor-pointer items-center justify-start px-3 py-2 text-left text-sm transition-colors',
  listboxOptionActive: 'bg-[var(--color-accent)]/12',
  listboxOptionIdle: 'hover:bg-[var(--color-surface-light)]',

  // Mode sélection de la Collection (code du 30/09/2026), sur chaque case (`group`) : voile (anneau accent pour une carte cochée,
  // qui dépasse de la case), case à cocher dans le coin (cochée, vide, impossible).
  /** Case d'une carte en sélection (celle de la Collection), dont le survol fait grandir le voile. */
  selectionCell: 'group',
  // Le voile grandit avec la face au survol de la case (`group`).
  selectionVeil: 'pointer-events-none absolute inset-0 z-10 rounded-2xl transition-all duration-300 group-hover:scale-105',
  selectionVeilChecked: 'ring-4 ring-[var(--color-accent)] shadow-[0_0_0_2px_rgba(0,0,0,0.35)]',
  selectionVeilIdle: 'bg-black/0 hover:bg-black/10',
  selectionBox:
    'pointer-events-none absolute top-1.5 right-1.5 z-30 flex size-6 items-center justify-center rounded-md border-2 ' +
    'text-white shadow',
  selectionBoxChecked: 'bg-[var(--color-accent)] border-[var(--color-accent)]',
  selectionBoxIdle: 'bg-black/60 border-white/70',
  selectionBoxLocked: 'bg-black/60 border-white/30',

  // « Choisir un ami » des échanges (code du 30/09/2026) : ligne d'un ami, sa photo (initiales en accent), son pseudo ;
  // statut « en attente » de sa liste d'échanges.
  friendRow:
    'flex items-center gap-3 p-3 rounded-xl bg-[var(--color-surface-light)] hover:bg-[var(--color-accent)]/10 ' +
    'transition-colors cursor-pointer text-left',
  friendAvatar:
    'w-10 h-10 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center flex-shrink-0 overflow-hidden ' +
    'text-sm font-bold text-[var(--color-accent)]',
  friendAvatarImage: 'w-full h-full object-cover',
  friendName: 'font-medium text-sm flex-1',
  tradePending: 'text-xs font-semibold text-amber-400',

  // Onglets soulignés (marché, profil, échanges ; code du 30/09/2026) : onglet, les autres, le choisi.
  underlineTab: 'px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer',
  underlineTabIdle: 'text-[var(--color-foreground)]/50 hover:text-[var(--color-foreground)]',
  underlineTabActive: 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]',

  // Vignette d'annonce du marché (captures du 29/09/2026) : grille, cadre (le lien), colonne, bandeau « Vous menez »,
  // boîte de la face, rangée prix · durée (libellés, montant, pièce, marteau, durée : normale, ambre sous 5 min,
  // terminée), « Vendu par ».
  tileGrid: 'flex flex-wrap justify-center gap-4 md:gap-5',
  tile: 'card-frame block p-3 w-[172px] md:w-[184px] hover:border-[var(--color-accent)]/50 transition-colors cursor-pointer',
  tileBody: 'flex flex-col items-center gap-2.5',
  tileLeading:
    'w-full text-center rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wide bg-emerald-500/15 ' +
    'text-emerald-700 dark:text-emerald-400',
  tileFaceBox: 'overflow-hidden rounded-2xl',
  tileInfo: 'w-full flex items-center justify-between gap-2 text-xs',
  tilePrice: 'flex flex-col min-w-0',
  tileLabel: 'text-[10px] uppercase tracking-wide text-[var(--color-foreground)]/40',
  tileAmount: 'inline-flex items-center gap-1 font-semibold text-[var(--color-accent)]',
  tileCoin: 'size-3.5 shrink-0',
  tileDuration: 'flex flex-col items-end',
  tileGavel: 'inline size-3 -mt-0.5 mr-0.5',
  tileTime: 'tabular-nums font-medium text-xs',
  tileTimeSoon: 'tabular-nums font-medium text-amber-600 dark:text-amber-400 text-xs',
  tileTimeEnded: 'tabular-nums font-medium text-[var(--color-foreground)]/40 text-xs',
  tileSeller: 'w-full text-[10px] text-[var(--color-foreground)]/40 truncate',

  // Face `sm` d'une carte (grilles ; halo `glow-<rareté>` à part) : fond de rareté, voile, bandeau de l'image, badge,
  // texte (titre, description, ATK · DEF). Shiny : fond onyx et ses couches, badge « L✦ », texte blanc.
  face:
    'w-[clamp(8.4rem,43vw,10rem)] h-[clamp(11.8rem,60vw,14rem)] relative rounded-2xl overflow-hidden cursor-pointer ' +
    'hover:z-10 transition-all duration-300 hover:scale-105',
  faceShiny:
    'w-[clamp(8.4rem,43vw,10rem)] h-[clamp(11.8rem,60vw,14rem)] glow-shiny shiny-card isolate relative rounded-2xl ' +
    'overflow-hidden cursor-pointer hover:z-10',
  faceBackground: 'object-cover scale-[1.8]',
  faceBackgroundShiny: 'object-cover',
  faceShade: 'absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-transparent pointer-events-none z-10',
  faceImageBand: 'absolute top-0 left-0 right-0 h-[45%] z-20 bg-black/20',
  faceImageBox: 'relative h-full w-full min-h-0',
  // Image de la face selon son cadrage (choisi au chargement) : rognée au centre, portrait (rognée, haut gardé :
  // `object-position: center 28%` en style), entière (transparence, `scale(0.9)` en style).
  faceImageCover: 'object-cover object-center',
  faceImagePortrait: 'object-cover',
  faceImageContain: 'object-contain object-center',
  faceImageFade: 'absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/50 to-transparent',
  faceBadge: 'absolute top-2 left-2 px-2 py-0.5 rounded-md text-xs font-bold z-30',
  faceBadgeShiny: 'shiny-badge absolute top-2 left-2 px-2 py-0.5 rounded-md text-xs font-bold z-30 inline-flex items-center gap-0.5',
  faceBadgeStar: 'text-[0.85em] leading-none',
  /** Pendant du badge de rareté, dans le coin haut droit (même forme, couleur en style). */
  faceBadgeEnd: 'absolute top-2 right-2 px-2 py-0.5 rounded-md text-xs font-bold z-30',
  faceText: 'absolute top-[45%] left-0 right-0 bottom-0 flex min-h-0 flex-col p-3 z-20',
  faceTextShiny: 'absolute top-[45%] left-0 right-0 bottom-0 flex min-h-0 flex-col p-3 z-20 shiny-text',
  faceTitle: 'text-xs shrink-0 font-bold leading-tight line-clamp-2 text-black drop-shadow-none',
  faceTitleShiny: 'text-xs shrink-0 font-bold leading-tight line-clamp-2 text-white drop-shadow-none',
  faceCategory: 'min-h-0 leading-snug text-neutral-900/90 overflow-hidden line-clamp-3 text-[9px] shrink-0',
  faceCategoryShiny: 'min-h-0 leading-snug text-white/90 overflow-hidden line-clamp-3 text-[9px] shrink-0',
  faceStatsBox: 'mt-auto flex min-h-0 w-full flex-col items-start gap-0.5 pt-1',
  // Emplacement du bas de la face (`bottomOverlay`, code du 01/10/2026) et sa pastille « Possédée » (vignettes du
  // marché, Toutes les cartes, fenêtre d'échange).
  faceOverlay: 'min-w-0 max-w-full shrink-0',
  faceOwned: 'w-fit rounded-full bg-emerald-600/90 px-2 py-0.5 text-[9px] font-bold text-white',
  /** Sur la grande face (page d'une enchère). */
  faceOwnedLarge: 'w-fit rounded-full bg-emerald-600/90 px-2 py-0.5 text-[10px] font-bold text-white',
  // Pastille bleue des amis qui ont la carte (Toutes les cartes), en rond, icône seule (lucide `users`).
  faceFriends: 'inline-flex items-center justify-center rounded-full bg-sky-300/65 p-1 text-black/80',
  faceFriendsIcon: 'size-2.5 shrink-0 opacity-90',
  faceStats: 'flex w-full shrink-0 items-center justify-between border-t border-black/20 pt-1 py-1',
  faceStatsShiny: 'flex w-full shrink-0 items-center justify-between border-t border-[#e9c15a]/35 pt-1 py-1',
  faceStat: 'text-[10px] flex items-center gap-1',
  faceAtkIcon: 'size-[1em] shrink-0 text-red-800',
  faceDefIcon: 'size-[1em] shrink-0 text-blue-800',
  faceAtkIconShiny: 'size-[1em] shrink-0 text-red-400',
  faceDefIconShiny: 'size-[1em] shrink-0 text-blue-300',
  faceStatValue: 'font-bold text-black/90',
  faceStatValueShiny: 'font-bold text-white',
  shinyTint: 'shiny-onyx-tint absolute inset-0 z-[5] pointer-events-none',
  shinyShade: 'shiny-onyx-shade absolute inset-0 z-[6] pointer-events-none',
  shinyLines: 'shiny-onyx-lines absolute inset-0 z-10 pointer-events-none',
  shinyLightAtRest: 'shiny-onyx-light shiny-at-rest absolute inset-0 z-[11] pointer-events-none',
  shinyLightOnHover: 'shiny-onyx-light shiny-on-hover absolute inset-0 z-[11] pointer-events-none',
  shinyWash: 'shiny-onyx-wash absolute inset-0 -z-10 pointer-events-none',
  shinyGlareAtRest: 'shiny-onyx-glare shiny-at-rest absolute inset-0 z-[38] pointer-events-none',
  shinyGlareOnHover: 'shiny-onyx-glare shiny-on-hover absolute inset-0 z-[38] pointer-events-none',

  // Liste vide du marché (« Aucune enchère active pour l'instant. », code du 30/09/2026) : cadre, grande icône,
  // texte ; aussi pour une liste qui n'a pas pu se charger.
  emptyFrame: 'card-frame p-10 text-center space-y-3',
  emptyIcon: 'mx-auto size-8 text-zinc-400',
  emptyText: 'text-[var(--color-foreground)]/40 text-sm',

  /** Champ de texte d'une ligne (recherche de la Collection, des amis), sans sa largeur. */
  textField:
    'rounded-lg bg-[var(--color-surface-light)] border border-[var(--color-border)] px-4 py-2.5 text-sm ' +
    'text-[var(--color-foreground)] placeholder:text-[var(--color-foreground)]/30 focus:outline-none focus:ring-2 ' +
    'focus:ring-[var(--color-accent)]/50',

  // Formulaire « Créer une guilde », en champs standard (`fieldLabel`, `textField`) : champ avec son libellé (bloc),
  // champ sur toute la largeur sous son libellé, zone de texte, compteur de caractères, message d'erreur.
  formField: 'block',
  formControl: 'w-full mt-1',
  formTextarea: 'resize-none',
  formCounter: 'text-[10px] text-[var(--color-foreground)]/30 mt-1',
  formError: 'text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg',
  formFields: 'space-y-3',
  formStack: 'space-y-4',

  /** Texte d'un bouton masqué sur mobile, icône seule (« Message », « Échanger » de la page Amis). */
  wideOnly: 'hidden sm:inline',
  /** Texte à sa place sur mobile (« Échanger » de « Proposer un échange », /trades). */
  narrowOnly: 'sm:hidden',

  // Liste de sa cloche (code du 30/09/2026) : cadre, en-tête, lignes (non lue : teinte et point accent), icône du
  // type, libellé, texte (long pour un contrôle anti-triche), date ; pastille rouge du nombre de non lues.
  notificationsPanel: 'card-frame fixed z-[100] shadow-xl animate-fade-in-up overflow-hidden flex flex-col',
  notificationsHead: 'flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]',
  notificationsTitle: 'text-sm font-semibold',
  notificationsList: 'min-h-0 flex-1 overflow-y-auto',
  notificationsEmpty: 'text-center text-sm text-[var(--color-foreground)]/40 py-8',
  notificationRow:
    'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[var(--color-surface-light)] transition-colors ' +
    'cursor-pointer border-b border-[var(--color-border)]/50 last:border-0',
  notificationUnread: 'bg-[var(--color-accent)]/5',
  notificationIcon: 'w-5 h-5 shrink-0 mt-0.5 text-[var(--color-foreground)]/80',
  notificationBody: 'flex-1 min-w-0',
  notificationLabel: 'text-xs font-semibold text-[var(--color-foreground)]/60 uppercase tracking-wide',
  notificationText: 'text-[var(--color-foreground)] mt-0.5 text-sm',
  notificationLongText: 'text-[var(--color-foreground)] mt-0.5 text-xs leading-relaxed max-h-32 overflow-y-auto pr-1',
  notificationDate: 'text-[10px] text-[var(--color-foreground)]/30 mt-1',
  notificationDot: 'w-2 h-2 rounded-full bg-[var(--color-accent)] flex-shrink-0 mt-2',
  notificationCount:
    'absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold ' +
    'flex items-center justify-center px-1',
  // Conversation (code du site : /dms du 29/09/2026, chat de guilde du 01/10/2026) : fond, cadre, en-tête, liste,
  // roue, liste vide, séparateur du jour, annonce de la guilde, message (pseudo au-dessus, cale de la photo, rangée,
  // photo, bulle de soi ou d'un autre, heure au survol), barre du message.
  chatOverlay: 'fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4',
  chatFrame:
    'w-full sm:max-w-md h-[85vh] sm:h-[600px] flex flex-col card-frame animate-fade-in-up rounded-t-2xl sm:rounded-2xl overflow-hidden',
  chatHeader: 'flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] flex-shrink-0',
  chatHeaderAvatar:
    'w-9 h-9 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center text-sm font-bold ' +
    'text-[var(--color-accent)] flex-shrink-0 overflow-hidden',
  chatHeaderText: 'flex-1 min-w-0',
  chatHeaderName: 'font-semibold text-sm truncate',
  chatList: 'flex-1 overflow-y-auto px-4 py-3 space-y-1',
  chatCenter: 'flex items-center justify-center h-full',
  chatEmpty: 'flex flex-col items-center justify-center h-full gap-2 text-center',
  chatEmptyIcon: 'size-10 text-[var(--color-foreground)]/25',
  chatEmptyText: 'text-sm text-[var(--color-foreground)]/40',
  chatDay: 'flex items-center gap-2 my-3',
  chatDayLine: 'flex-1 h-px bg-[var(--color-border)]',
  chatDayLabel: 'text-[10px] text-[var(--color-foreground)]/30 font-medium px-2',
  chatNotice: 'flex justify-center my-2',
  chatNoticeText: 'text-xs text-[var(--color-foreground)]/40 bg-[var(--color-accent)]/5 px-3 py-1 rounded-full',
  chatMessage: 'group mb-1.5',
  chatName: 'mb-0.5 flex gap-2',
  chatNameText: 'text-[10px] font-medium text-[var(--color-foreground)]/40 px-1',
  chatSpacer: 'h-8 w-8 shrink-0',
  chatLine: 'flex gap-2 items-end',
  chatLineOwn: 'flex-row-reverse',
  chatLineOther: 'flex-row',
  chatAvatar:
    'h-8 w-8 shrink-0 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center text-xs font-bold ' +
    'text-[var(--color-accent)] overflow-hidden',
  chatAvatarImage: 'w-full h-full object-cover',
  chatBubble: 'max-w-[75%] min-w-0 rounded-2xl px-3 py-2 text-sm leading-relaxed break-words',
  chatBubbleOwn: 'rounded-br-sm bg-[var(--color-accent)] text-[var(--color-accent-foreground)]',
  chatBubbleOther: 'rounded-bl-sm bg-[var(--color-surface-light)] text-[var(--color-foreground)]',
  chatTime: 'mt-0.5 flex gap-2',
  chatTimeOwn: 'justify-end',
  chatTimeText: 'text-[10px] text-[var(--color-foreground)]/25 px-1 opacity-0 transition-opacity group-hover:opacity-100',
  chatBar: 'flex items-center gap-2 px-3 py-3 border-t border-[var(--color-border)] flex-shrink-0',
  chatInput:
    'flex-1 px-3 py-2 rounded-xl bg-[var(--color-surface-light)] border border-[var(--color-border)] text-sm ' +
    'placeholder:text-[var(--color-foreground)]/30 focus:outline-none focus:border-[var(--color-accent)]/50 transition-colors',

  /** Ligne cliquable d'une liste, comme celles de /dms en plus serré (historique des mises en vente). */
  listRow: 'w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[var(--color-surface-light)] transition-colors cursor-pointer text-left',

  // Ligne d'une conversation de /dms (photo, pseudo, heure, dernier message), surlignée quand elle est affichée.
  dmsRow: 'w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--color-surface-light)] transition-colors cursor-pointer text-left',
  dmsRowActive: 'bg-[var(--color-surface-light)]',
  dmsRowAvatarBox: 'relative flex-shrink-0',
  dmsRowAvatar:
    'w-11 h-11 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center text-sm font-bold ' +
    'text-[var(--color-accent)] overflow-hidden',
  dmsRowBody: 'flex-1 min-w-0',
  dmsRowHead: 'flex items-center justify-between gap-2',
  dmsRowName: 'font-medium text-sm truncate text-[var(--color-foreground)]/80',
  dmsRowMeta: 'text-[10px] text-[var(--color-foreground)]/30 flex-shrink-0',
  dmsRowText: 'text-xs truncate mt-0.5 text-[var(--color-foreground)]/40',
  dmsSeparator: 'h-px bg-[var(--color-border)] my-2',
  /** Colonne de droite de /dms sans conversation affichée : un cadre du site. */
  dmsPanel: 'card-frame',
} as const;
