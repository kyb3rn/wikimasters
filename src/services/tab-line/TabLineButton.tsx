import { buttonClass } from '@/ui/button';
import { cx } from '@/ui/cx';
import { siteClass } from '@/ui/site';

export interface TabLineButtonProps {
  /** Texte après le « + » ; `narrowLabel` : le même sur mobile (sous `sm`), comme le bouton du site. */
  readonly label: string;
  readonly narrowLabel?: string;
  readonly size: 'md' | 'lg';
  readonly className: string;
  readonly disabled: boolean;
  readonly onClick: () => void;
}

/** Bouton d'action d'une page au bout de sa rangée d'onglets : vert plein, « + texte » comme celui du site. */
export function TabLineButton({ label, narrowLabel, size, className, disabled, onClick }: TabLineButtonProps) {
  return (
    <button type="button" class={cx(buttonClass('standard', { tone: 'accent', fill: 'solid', size }), className)} disabled={disabled} onClick={onClick}>
      <span>+</span>
      {narrowLabel === undefined ? (
        <span>{label}</span>
      ) : (
        <>
          <span class={siteClass.wideOnly}>{label}</span>
          <span class={siteClass.narrowOnly}>{narrowLabel}</span>
        </>
      )}
    </button>
  );
}
