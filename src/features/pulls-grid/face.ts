import { sleep } from '@/core/async';
import { ROOT_CLASS } from '@/core/dom';

/** Copie d'une face du site, sans nos ajouts (tampon, classes et attributs `wm`) ni identifiants. */
export function cloneFace(face: HTMLElement): HTMLElement {
  const clone = face.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(`.${ROOT_CLASS}`).forEach((node) => node.remove());
  for (const node of [clone, ...clone.querySelectorAll('*')]) {
    node.removeAttribute('id');
    for (const name of [...node.classList]) if (name.startsWith('wm-')) node.classList.remove(name);
    for (const { name } of [...node.attributes]) if (name.startsWith('data-wm-')) node.removeAttribute(name);
  }
  // Déjà en cache : `lazy` retarderait l'image d'une carte encore cachée.
  for (const image of clone.querySelectorAll('img')) image.loading = 'eager';
  if (clone.classList.contains('shiny-card')) followPointer(clone);
  return clone;
}

export function imagesComplete(face: HTMLElement | undefined): boolean {
  return face !== undefined && [...face.querySelectorAll('img')].every((image) => image.complete);
}

/** Images de la copie décodées (au plus `timeoutMs`) : la carte arrive entière. */
export async function imagesDecoded(face: HTMLElement, timeoutMs: number, signal: AbortSignal): Promise<void> {
  const decoded = Promise.all([...face.querySelectorAll('img')].map((image) => image.decode().catch(() => undefined)));
  await Promise.race([decoded, sleep(timeoutMs, signal)]);
}

/** Reflet et inclinaison des shiny qui suivent la souris, comme sur le site (la copie n'a pas ses gestionnaires React). */
function followPointer(face: HTMLElement): void {
  face.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    const rect = face.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    face.style.setProperty('--shiny-mx', `${(100 * x).toFixed(1)}%`);
    face.style.setProperty('--shiny-my', `${(100 * y).toFixed(1)}%`);
    face.classList.add('shiny-hover');
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const tilt = `rotateY(${((x - 0.5) * 14).toFixed(2)}deg) rotateX(${((0.5 - y) * 14).toFixed(2)}deg)`;
      face.style.transform = `perspective(${Math.round(3.125 * face.offsetWidth)}px) ${tilt}`;
    }
  });
  face.addEventListener('pointerleave', () => {
    face.classList.remove('shiny-hover');
    face.style.transform = '';
  });
}
