/**
 * Un clic appuyé sur un élément et relâché sur un autre est envoyé à leur ancêtre commun : glisser depuis le cadre
 * d'une modale jusqu'à son fond (sélection de texte, curseur, graphique), ou l'inverse, « clique » le fond, qui la
 * ferme. Ce clic-là est arrêté avant tout le monde : un fond ne reçoit que les clics appuyés et relâchés sur lui.
 * Les clics de programme (`click()`) passent toujours.
 */
export function guardBackdropClicks(isBackdrop: (element: Element) => boolean, options: { signal: AbortSignal }): void {
  const { signal } = options;
  let pressed: EventTarget | null = null;
  let released: EventTarget | null = null;
  const track = { capture: true, passive: true, signal };
  window.addEventListener(
    'pointerdown',
    (event) => {
      pressed = event.target;
      released = null;
    },
    track,
  );
  window.addEventListener('pointerup', (event) => (released = event.target), track);
  window.addEventListener(
    'click',
    (event) => {
      const { target } = event;
      if (!event.isTrusted || !(target instanceof Element) || (pressed === target && released === target)) return;
      if (!isBackdrop(target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    { capture: true, signal },
  );
}
