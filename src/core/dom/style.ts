const elementId = (id: string) => `wm-style-${id}`;

/** Feuille de style `wm-style-<id>`, une seule fois : tant qu'elle est là, un nouvel appel ne change rien. */
export function injectStyle(id: string, css: string): void {
  if (!document.getElementById(elementId(id))) append(id, css);
}

/** Feuille de style `wm-style-<id>`, posée, ou son contenu remplacé s'il a changé. */
export function writeStyle(id: string, css: string): void {
  const existing = document.getElementById(elementId(id));
  if (!existing) append(id, css);
  else if (existing.textContent !== css) existing.textContent = css;
}

export function removeStyle(id: string): void {
  document.getElementById(elementId(id))?.remove();
}

/**
 * Feuille de style posée ou retirée : pour un état durable de la page. Une classe sur `<html>` ou `<body>` ne tient
 * pas : Next.js les rend lui-même, et React réécrit leur attribut `class` (constaté le 30/09/2026, classe retirée).
 */
export function toggleStyle(id: string, css: string, on: boolean): void {
  if (on) injectStyle(id, css);
  else removeStyle(id);
}

function append(id: string, css: string): void {
  const style = document.createElement('style');
  style.id = elementId(id);
  style.textContent = css;
  (document.head ?? document.documentElement).append(style);
}
