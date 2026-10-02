import type { ButtonShape, ButtonSize, ButtonStyle } from '@/ui/button';

/** Ce qu'on lit d'un bouton du site pour le ranger. */
export interface SiteButton {
  /** Ses classes, sans les nôtres. */
  readonly classes: ReadonlySet<string>;
  /** Il a un texte visible (pastille de compteur exclue) : sinon, icône seule. */
  readonly text: boolean;
  /** Il a une icône ou une image. */
  readonly graphic: boolean;
  /** Sa première icône lucide (`trash-2`…). */
  readonly icon: string | undefined;
  readonly role: string | null;
  /** Ouvre une liste (`aria-haspopup`). */
  readonly popup: boolean;
  /** Le solde de l'en-tête. */
  readonly balance: boolean;
}

export interface Restyle {
  readonly shape: ButtonShape;
  readonly style: ButtonStyle;
}

const ACCENT = 'var(--color-accent)';

const any = (classes: ReadonlySet<string>, ...names: string[]) => names.some((name) => classes.has(name));
const starts = (classes: ReadonlySet<string>, ...prefixes: string[]) =>
  [...classes].some((name) => prefixes.some((prefix) => name.startsWith(prefix)));

/**
 * Un `<button>` du site qui n'est pas un bouton d'action : onglets, pastilles, listes, lignes de liste, liens en
 * texte, interrupteurs, tuiles de cartes, parties d'un champ, contrôles posés sur une carte. Il garde son allure.
 */
function isOtherControl({ classes, text, graphic, role, popup }: SiteButton): boolean {
  if ((role !== null && role !== 'button') || popup) return true;
  // Points du carrousel.
  if (!text && !graphic) return true;
  // Sans arrondi : onglet (celui qui n'est pas choisi n'a pas de trait) ou lien en texte.
  if (!starts(classes, 'rounded')) return true;
  // Affiché selon la largeur : notre `display` le montrerait partout.
  if ([...classes].some((name) => name === 'hidden' || name.endsWith(':hidden'))) return true;
  if (
    any(
      classes,
      'text-left', // lignes de liste (conversations, notifications, échanges), listes déroulantes
      'border-b-2', // onglets soulignés
      'border-dashed', // emplacements vides (« Ajouter » une carte)
      'overflow-hidden', // photo de profil, tuiles de cartes
      'flex-col', // paquet à ouvrir, barre de navigation mobile
      'max-w-full', // puces de filtre des échanges
      'border-l', // parties collées d'un champ (− / +), segments
      'border-r',
      'p-0.5', // étoile des cartes, croix des pastilles d'étiquettes
    )
  )
    return true;
  if (classes.has('w-11') && classes.has('h-6')) return true; // interrupteurs
  if (classes.has('rounded-full') && text) return true; // pastilles : raretés, durées, filtres
  if (classes.has('rounded') && classes.has('py-0.5')) return true; // onglets Détails / Marché de la modale de carte
  if (classes.has('-translate-y-1/2') && !classes.has('-translate-x-1/2')) return true; // croix d'un champ de recherche
  if (classes.has('flex-1') && classes.has('py-2') && !starts(classes, 'px-') && !classes.has('border')) return true; // onglets pleins
  if (classes.has('h-9') && classes.has('px-2.5') && !classes.has('w-9')) return true; // segments (affichage des cartes)
  // Sans marge ni taille : lien en texte (« Comment ça marche ? », « Modifier », « Retour au marché »).
  const sized = starts(classes, 'p-', 'px-', 'py-', 'size-') || [...classes].some((name) => /^[hw]-\d/.test(name));
  return !sized;
}

/** Posé en débord sur le coin d'une carte (« Retirer de la vitrine ») : plein, pour rester lisible sur l'image. */
const onCardCorner = (classes: ReadonlySet<string>) => classes.has('absolute') && starts(classes, '-top-', '-right-', '-bottom-', '-left-');

type Paint = Required<Pick<ButtonStyle, 'tone' | 'fill'>>;

/** Couleur et remplissage d'après ceux du site : fond plein, fond teinté (contour), texte coloré seul (ghost). */
function paint(classes: ReadonlySet<string>): Paint {
  if (starts(classes, 'from-violet-')) return { tone: 'pro', fill: 'solid' };
  if (starts(classes, 'from-emerald-', 'from-green-')) return { tone: 'accent', fill: 'solid' };
  if (any(classes, 'bg-red-500', 'bg-red-500/90', 'bg-red-600')) return { tone: 'danger', fill: 'solid' };
  if (classes.has(`bg-[${ACCENT}]`)) return { tone: 'accent', fill: 'solid' };
  if (starts(classes, 'bg-red-', 'text-red-')) return { tone: 'danger', fill: 'outline' };
  if (starts(classes, 'bg-sky-', 'text-sky-', 'bg-blue-', 'text-blue-')) return { tone: 'info', fill: 'outline' };
  if (starts(classes, 'bg-emerald-', 'text-emerald-', 'bg-green-', 'text-green-')) return { tone: 'accent', fill: 'outline' };
  if (starts(classes, 'bg-amber-', 'text-amber-', 'bg-orange-', 'text-orange-')) return { tone: 'warning', fill: 'outline' };
  if (starts(classes, 'bg-violet-', 'text-violet-')) return { tone: 'pro', fill: 'outline' };
  // Bordure d'accent pleine : état choisi (« Retirer de la liste de souhaits »).
  if (classes.has(`border-[${ACCENT}]`)) return { tone: 'accent', fill: 'solid' };
  if (starts(classes, `bg-[${ACCENT}]/`, `border-[${ACCENT}]/`)) return { tone: 'accent', fill: 'outline' };
  if (starts(classes, `text-[${ACCENT}]`)) return { tone: 'accent', fill: 'ghost' };
  if (starts(classes, 'hover:text-red-')) return { tone: 'danger', fill: 'ghost' };
  if (starts(classes, 'bg-[var(--color-surface', 'bg-white/')) return { tone: 'neutral', fill: classes.has('border') ? 'outline' : 'solid' };
  return { tone: 'neutral', fill: classes.has('border') ? 'outline' : 'ghost' };
}

const SMALL_TEXT = ['text-xs', 'text-[10px]', 'text-[11px]'];
/** Gros bouton du site : texte de base (pas de `text-sm`), `py-3` (« Continuer » des paquets, « Créer une guilde »). */
const LARGE_PADDING = ['py-3', 'py-3.5', 'py-4'];
/** Icône seule de 36 px au plus (croix, icônes de l'en-tête) ; au-delà (flèches du carrousel, « Envoyer ») : moyen. */
const SMALL_ICON = ['p-1', 'p-1.5', 'p-2', 'size-6', 'size-7', 'size-8', 'size-9', 'w-6', 'w-7', 'w-8', 'w-9', 'h-6', 'h-7', 'h-8', 'h-9'];
/** Icônes seules moyennes malgré leur taille chez le site : « Vue du marché » d'une enchère (demande de l'utilisateur). */
const MEDIUM_ICONS = ['chart-line'];

function textSize(classes: ReadonlySet<string>): ButtonSize {
  if (any(classes, ...SMALL_TEXT)) return 'sm';
  return !classes.has('text-sm') && any(classes, ...LARGE_PADDING) ? 'lg' : 'md';
}

/**
 * Allure standard d'un bouton du site, ou `undefined` s'il n'est pas un bouton d'action. Texte : bouton standard
 * (sa largeur, `flex-1` ou `w-full`, reste celle du site), petit, moyen ou grand selon le sien ; le solde arrondi
 * (demande de l'utilisateur). Icône seule : rond (sur le site : rond, ou sans fond ni trait), sinon carré, petit ou
 * moyen. Toute corbeille est rouge, tout bouton sur le coin d'une carte plein.
 */
export function classify(button: SiteButton): Restyle | undefined {
  if (isOtherControl(button)) return undefined;
  const { classes } = button;
  const painted = paint(classes);
  const fill = onCardCorner(classes) ? 'solid' : painted.fill;
  const tone = painted.tone === 'neutral' && button.icon?.startsWith('trash') ? 'danger' : painted.tone;
  if (button.text) {
    const style = { tone, fill, size: textSize(classes) };
    return { shape: 'standard', style: button.balance ? { ...style, pill: true } : style };
  }
  const shape = classes.has('rounded-full') || fill === 'ghost' ? 'round' : 'square';
  const small = any(classes, ...SMALL_ICON) && !MEDIUM_ICONS.includes(button.icon ?? '');
  return { shape, style: { tone, fill, size: small ? 'sm' : 'md' } };
}
