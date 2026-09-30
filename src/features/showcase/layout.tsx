import type { ComponentChild, ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { siteClass } from '@/ui/site';

export interface SectionInfo {
  readonly id: string;
  readonly title: string;
}

export function Section({ section, children }: { readonly section: SectionInfo; readonly children: ComponentChildren }) {
  return (
    <section id={`wm-showcase-${section.id}`} class={`${siteClass.panel} wm-showcase-section`}>
      <h2 class="wm-showcase-section-title">{section.title}</h2>
      {children}
    </section>
  );
}

/** Un contrôle dans ses états, côte à côte. */
export function Group({ title, children }: { readonly title: string; readonly children: ComponentChildren }) {
  return (
    <div class="wm-showcase-group">
      <div class={siteClass.fieldLabel}>{title}</div>
      <div class="wm-showcase-row">{children}</div>
    </div>
  );
}

/** Exemplaire qui prend toute la place qu'on lui donne : sa largeur. */
export function Specimen({ width, children }: { readonly width: string; readonly children: ComponentChildren }) {
  return (
    <div class="wm-showcase-item" style={{ width, maxWidth: '100%' }}>
      {children}
    </div>
  );
}

/** Variantes de couleur en rangées, états en colonnes : une case vide là où une variante n'a pas cet état. */
export function Matrix({ rows }: { readonly rows: readonly (readonly ComponentChild[])[] }) {
  const columns = Math.max(...rows.map((row) => row.length));
  return (
    <div class="wm-showcase-matrix" style={{ gridTemplateColumns: `repeat(${columns}, max-content)` }}>
      {rows.flatMap((row, r) =>
        Array.from({ length: columns }, (_, c) => (
          <div key={`${r}:${c}`} class="wm-showcase-cell">
            {row[c]}
          </div>
        )),
      )}
    </div>
  );
}

/** Temps d'une requête simulée : assez pour voir la roue. */
export const DEMO_BUSY_MS = 1500;

/** État « en cours » d'un bouton de démonstration : `run()` le lance pour `DEMO_BUSY_MS`. */
export function useBusy(): readonly [busy: boolean, run: () => void] {
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const run = () => {
    if (busy) return;
    setBusy(true);
    timer.current = setTimeout(() => setBusy(false), DEMO_BUSY_MS);
  };
  return [busy, run];
}
