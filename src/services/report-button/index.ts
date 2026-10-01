import { h, type ComponentChild } from 'preact';
import { textOf } from '@/core/text';
import { ReportButton } from '@/ui/controls';

/**
 * « Signaler l'image » du site en pastille sur l'image de la carte (`ReportButton`) : même texte, même état, et un
 * clic sur le nôtre clique le sien (caché par l'appelant).
 */
export function siteReportButton(button: HTMLButtonElement): ComponentChild {
  return h(ReportButton, {
    label: textOf(button) || "Signaler l'image",
    disabled: button.disabled,
    pressed: button.getAttribute('aria-pressed') === 'true',
    onClick: () => button.click(),
  });
}
