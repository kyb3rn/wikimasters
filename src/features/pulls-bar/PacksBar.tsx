import type { ComponentChildren } from 'preact';
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

function Part({ value, label }: { value: ComponentChildren; label: string }) {
  return (
    <div class="wm-packs-part">
      {/* Contenu dans un bloc à lui : directement dans la boîte flex, l'espace de « / 10 » serait supprimé. */}
      <div class={`${siteClass.counterValue} wm-packs-value`}>
        <div>{value}</div>
      </div>
      <div class={siteClass.counterLabel}>{label}</div>
    </div>
  );
}

/** Cadre en largeur sous « Ouvrir » : paquets disponibles · recharge · son · affichage des cartes. */
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
          <>
            <span class={siteClass.counterAccent}>{available}</span>
            <span class={siteClass.counterMuted}> / {max}</span>
          </>
        }
        label="paquets disponibles"
      />
      <Part
        value={next ? <span class={siteClass.counterTime}>{next}</span> : <span class={siteClass.counterMuted}>Plein</span>}
        label={next ? 'prochain paquet' : 'au maximum'}
      />
      <Part
        value={
          <button
            type="button"
            class={`${siteClass.iconButton} ${sound ? siteClass.iconOn : siteClass.iconOff}`}
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
