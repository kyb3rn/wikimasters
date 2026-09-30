import type { ComponentChildren } from 'preact';
import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';
import { siteClass } from '@/ui/site';

export interface PacksBarProps {
  readonly available: number;
  readonly max: number;
  /** Temps avant le prochain paquet ; `undefined` : plein. */
  readonly next: string | undefined;
  readonly sound: boolean;
  /** Toutes les cartes d'un coup (sinon : carrousel). */
  readonly grid: boolean;
  readonly onSound: () => void;
  readonly onGrid: (grid: boolean) => void;
}

interface PartProps {
  readonly value: ComponentChildren;
  readonly label?: string;
  readonly title?: string;
}

function Part({ value, label, title }: PartProps) {
  return (
    <div class="wm-packs-part" title={title}>
      <div class={`${siteClass.counterValue} wm-packs-value`}>{value}</div>
      {label && <div class={siteClass.counterLabel}>{label}</div>}
    </div>
  );
}

/** Cadre en largeur au-dessus du paquet : paquets disponibles · recharge · son · affichage des cartes. */
export function PacksBar({ available, max, next, sound, grid, onSound, onGrid }: PacksBarProps) {
  const soundLabel = sound ? 'Couper le son des paquets' : 'Activer le son des paquets';
  const modes = [
    { grid: false, icon: 'carousel', name: 'Carrousel', title: 'Carrousel : une carte à la fois' },
    { grid: true, icon: 'grid', name: 'Grille', title: "Grille : toutes les cartes d'un coup" },
  ] as const;
  return (
    <div class={`${siteClass.frame} wm-packs-bar`}>
      <Part
        value={
          <span class={siteClass.counterPair}>
            <span class={`${siteClass.counterAccent} ${siteClass.counterCount}`}>{available}</span>
            {/* Espace ignoré par la boîte flex (l'écart vient de `gap`) : le texte copié reste « 6 / 10 ». */}{' '}
            <span class={`${siteClass.counterMuted} ${siteClass.counterMax}`}>/ {max}</span>
          </span>
        }
        title="Paquets disponibles"
      />
      <Part
        value={next ? <span class={siteClass.counterTime}>{next}</span> : <span class={siteClass.counterMuted}>Plein</span>}
        label={next ? 'prochain paquet' : 'au maximum'}
      />
      <Part
        value={
          <button
            type="button"
            class={buttonClass('round', { tone: sound ? 'accent' : 'neutral', fill: 'ghost' })}
            aria-pressed={sound}
            aria-label={soundLabel}
            title={soundLabel}
            onClick={onSound}
          >
            <Icon name={sound ? 'volume' : 'volumeOff'} size={20} />
          </button>
        }
        label={sound ? 'son activé' : 'son coupé'}
      />
      <Part
        value={
          <div class={siteClass.segmented} role="radiogroup" aria-label="Affichage des cartes">
            {modes.map((mode) => (
              <button
                key={mode.name}
                type="button"
                role="radio"
                class={`${siteClass.segment} ${mode.grid === grid ? siteClass.segmentActive : siteClass.segmentIdle}`}
                aria-checked={mode.grid === grid}
                aria-label={mode.name}
                title={mode.title}
                onClick={() => onGrid(mode.grid)}
              >
                <Icon name={mode.icon} size={18} />
              </button>
            ))}
          </div>
        }
        label={grid ? 'grille' : 'carrousel'}
      />
    </div>
  );
}
