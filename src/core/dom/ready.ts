/** Classe de toutes nos racines d'interface : l'observateur de DOM ignore ce qui s'y passe. */
export const ROOT_CLASS = 'wm-root';

/**
 * Attend que `document.body` existe. Le script démarre à `document-start`, avant le HTML :
 * toute fonctionnalité qui touche au DOM commence par là.
 */
export function whenBody(doc: Document = document): Promise<HTMLElement> {
  if (doc.body) return Promise.resolve(doc.body);
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (!doc.body) return;
      observer.disconnect();
      resolve(doc.body);
    });
    // Au tout début du chargement, même `<html>` n'existe pas encore : on observe le document.
    observer.observe(doc, { childList: true, subtree: true });
  });
}

/**
 * Met ou retire une classe sans écrire dans le DOM si rien ne change. `classList.add` réécrit
 * l'attribut même quand la classe est déjà là : dans un rappel de `watchDom`, chaque appel
 * déclencherait une nouvelle mutation, donc un nouvel appel, à chaque image.
 */
export function setClass(element: Element, name: string, on: boolean): void {
  if (element.classList.contains(name) !== on) element.classList.toggle(name, on);
}

/** Feuille de style, une seule fois par identifiant. */
export function injectStyle(id: string, css: string, doc: Document = document): void {
  const elementId = `wm-style-${id}`;
  if (doc.getElementById(elementId)) return;
  const style = doc.createElement('style');
  style.id = elementId;
  style.textContent = css;
  (doc.head ?? doc.documentElement).append(style);
}
