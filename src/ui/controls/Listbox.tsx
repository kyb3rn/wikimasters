import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { cx } from '@/ui/cx';
import { Icon } from '@/ui/icons';
import { mountUi, type MountedUi } from '@/ui/mount';
import { siteClass } from '@/ui/site';
import { layers, tokens } from '@/ui/theme';

export interface ListboxOption {
  readonly value: string;
  readonly label: string;
  /** Option montrée en pastille (étiquette), dans ces couleurs. */
  readonly chipStyle?: string;
}

export interface ListboxProps {
  readonly ariaLabel: string;
  readonly value: string;
  readonly options: readonly ListboxOption[];
  readonly onChange: (value: string) => void;
  /** Classes du cadre (largeur dans sa rangée). */
  readonly class?: string;
}

function Label({ option }: { readonly option: ListboxOption | undefined }) {
  if (!option) return <>—</>;
  if (!option.chipStyle) return <span class={siteClass.listboxText}>{option.label}</span>;
  return (
    <span class={siteClass.listboxChip} style={option.chipStyle}>
      <span class={siteClass.listboxChipText}>{option.label}</span>
    </span>
  );
}

/**
 * Contenu rendu dans `body` (un menu en `position: fixed` resterait sinon coincé dans un cadre transformé ou
 * qui défile, comme celui des modales du site).
 */
function BodyLayer({ children }: { readonly children: ComponentChildren }) {
  const layer = useRef<MountedUi>();
  useLayoutEffect(() => {
    const controller = new AbortController();
    layer.current = mountUi(null, { signal: controller.signal });
    return () => {
      controller.abort();
      layer.current = undefined;
    };
  }, []);
  useLayoutEffect(() => layer.current?.update(<>{children}</>));
  return null;
}

/**
 * La liste déroulante du site (Collection, Toutes les cartes) : bouton à la hauteur des champs, menu sous lui,
 * fermé au choix, par Échap (qui ne va pas plus loin : la modale dessous reste ouverte) ou par un clic ailleurs.
 */
export function Listbox({ ariaLabel, value, options, onChange, class: extra }: ListboxProps) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ top: number; left: number; width: number }>();
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const current = options.find((option) => option.value === value) ?? options[0];

  useLayoutEffect(() => {
    if (!open) return undefined;
    const measure = () => {
      const rect = button.current?.getBoundingClientRect();
      if (rect) setPlace({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open]);

  // Pas un effet ordinaire : liste fermée, son écouteur resterait jusqu'à l'image suivante et garderait pour lui
  // un second Échap, qui doit fermer la modale dessous.
  useLayoutEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!box.current?.contains(target) && !menu.current?.contains(target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  if (options.length === 0) return null;
  return (
    <div ref={box} class={cx(siteClass.listbox, extra)}>
      <button
        ref={button}
        type="button"
        class={siteClass.listboxButton}
        // À la hauteur des champs, comme les siennes une fois ajustées (site-fields).
        style={{ minHeight: tokens.fieldHeight }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((was) => !was)}
      >
        <span class={siteClass.listboxValue}>
          <Label option={current} />
        </span>
        <Icon name="chevronDown" class={cx(siteClass.listboxChevron, open && siteClass.listboxChevronOpen)} />
      </button>
      {open && place && (
        <BodyLayer>
          <ul
            ref={menu}
            role="listbox"
            aria-label={ariaLabel}
            class={siteClass.listboxMenu}
            style={{ position: 'fixed', top: `${place.top}px`, left: `${place.left}px`, width: `${place.width}px`, zIndex: layers.menu }}
          >
            {options.map((option) => (
              <li key={option.value} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  class={`${siteClass.listboxOption} ${option.value === value ? siteClass.listboxOptionActive : siteClass.listboxOptionIdle}`}
                  onClick={() => {
                    setOpen(false);
                    if (option.value !== value) onChange(option.value);
                  }}
                >
                  <span class={siteClass.listboxValue}>
                    <Label option={option} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </BodyLayer>
      )}
    </div>
  );
}
