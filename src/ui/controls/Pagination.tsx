import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { injectStyle } from '@/core/dom';
import { buttonClass } from '@/ui/button';
import { useLatest } from '@/ui/hooks';
import { Icon, type IconName } from '@/ui/icons';
import { siteClass } from '@/ui/site';
import { tokens } from '@/ui/theme';
import { pageTargets, parsePage, type PageButton, type PaginationControl } from './paging';

// Champ à la hauteur des champs du site, comme les boutons carrés.
const CSS = `
.wm-pagination-input { height: ${tokens.fieldHeight}; }
`;

/** Attente après le dernier clic ou la dernière saisie : plusieurs clics rapides ne changent de page qu'une fois. */
const DELAY = 300;

const BUTTONS: Readonly<Record<PageButton, { readonly icon: IconName; readonly label: string }>> = {
  first: { icon: 'chevronFirst', label: 'Première page' },
  previous: { icon: 'chevronLeft', label: 'Page précédente' },
  next: { icon: 'chevronRight', label: 'Page suivante' },
  last: { icon: 'chevronLast', label: 'Dernière page' },
};

export interface PaginationProps {
  /** Page affichée, à partir de 1. */
  readonly page: number;
  /** Nombre de pages, s'il est connu. */
  readonly total?: number;
  /** Nombre de pages inconnu : y a-t-il une page suivante (oui par défaut). */
  readonly hasNext?: boolean;
  /** Chargement : tout est désactivé, roue sur le bouton qui l'a lancé. */
  readonly busy?: boolean | PaginationControl;
  /** Pagination indisponible : tout est désactivé, avec cette info-bulle. */
  readonly lockedReason?: string;
  /** Attente (ms) après le dernier changement avant `onChange` ; la page visée s'affiche tout de suite. */
  readonly delay?: number;
  readonly onChange: (page: number, control: PaginationControl) => void;
}

/**
 * |<  <  Page [n] / total  >  >| : le numéro se saisit, validé par Entrée ou en quittant le champ (borné
 * aux pages qui existent), Échap l'annule. Sans total connu : ni « / total » ni dernière page. La page
 * visée s'affiche aussitôt, elle n'est demandée qu'après un court délai sans autre changement.
 */
export function Pagination({ page, total, hasNext, busy, lockedReason, delay = DELAY, onChange }: PaginationProps) {
  injectStyle('ui-pagination', CSS);
  const inactive = (busy !== undefined && busy !== false) || lockedReason !== undefined;
  /** Page visée, pas encore demandée. */
  const [queued, setQueued] = useState<{ readonly page: number; readonly control: PaginationControl }>();
  const shown = queued?.page ?? page;
  const [draft, setDraft] = useState(String(shown));
  useEffect(() => setDraft(String(shown)), [shown]);

  const latest = useLatest(onChange);
  useEffect(() => {
    if (!queued) return undefined;
    const timer = setTimeout(() => {
      setQueued(undefined);
      latest.current(queued.page, queued.control);
    }, delay);
    return () => clearTimeout(timer);
  }, [queued, delay, latest]);
  // Page changée d'ailleurs, ou pagination devenue indisponible : ce qui attendait est abandonné.
  useEffect(() => setQueued(undefined), [page, inactive]);

  /** Revenir à la page affichée annule l'attente. */
  const queue = (target: number, control: PaginationControl) => setQueued(target === page ? undefined : { page: target, control });
  const targets = pageTargets(shown, total, hasNext);

  const commit = (value: string) => {
    const target = parsePage(value, total);
    setDraft(String(shown));
    if (target !== undefined && target !== shown) queue(target, 'input');
  };

  const button = (control: PageButton) => {
    const { icon, label } = BUTTONS[control];
    const target = targets[control];
    const spinning = busy === control;
    return (
      <button
        type="button"
        class={`${buttonClass('square')} wm-pagination-button`}
        aria-label={label}
        title={lockedReason || label}
        aria-busy={spinning}
        disabled={inactive || target === undefined}
        onClick={() => {
          if (target !== undefined) queue(target, control);
        }}
      >
        <Icon name={icon} busy={spinning} size={18} />
      </button>
    );
  };

  const onKeyDown = (event: JSX.TargetedKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') commit(event.currentTarget.value);
    if (event.key !== 'Escape') return;
    // La sortie du champ qui suit valide ce qu'il contient : on y remet la page affichée.
    event.currentTarget.value = String(shown);
    setDraft(String(shown));
    event.currentTarget.blur();
  };

  return (
    <nav class={siteClass.paginationBar} aria-label="Pagination">
      {button('first')}
      {button('previous')}
      <span class={siteClass.paginationText}>Page</span>
      <input
        type="number"
        inputMode="numeric"
        class={`${siteClass.paginationInput} wm-pagination-input`}
        aria-label="Numéro de page"
        title={lockedReason || undefined}
        value={draft}
        min={1}
        max={total}
        step={1}
        disabled={inactive}
        onInput={(event) => setDraft(event.currentTarget.value)}
        onBlur={(event) => commit(event.currentTarget.value)}
        onKeyDown={onKeyDown}
      />
      {total !== undefined && <span class={siteClass.paginationText}>/ {total}</span>}
      {button('next')}
      {button('last')}
    </nav>
  );
}
