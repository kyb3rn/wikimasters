/**
 * Cadrage de l'image d'une face, décidé par le site une fois l'image chargée (code du 01/10/2026) : avec de la
 * transparence (logo, drapeau), entière et réduite à 90 % ; sinon en hauteur (portrait), rognée en gardant le haut
 * (visage) ; sinon rognée au centre. Avant le chargement : rognée au centre.
 */
export type ImageFit = 'cover' | 'portrait' | 'contain';

export function imageFit(portrait: boolean, transparent: boolean): ImageFit {
  if (transparent) return 'contain';
  return portrait ? 'portrait' : 'cover';
}

/** Comme le site : image réduite à 96 px au plus sur un canevas, transparente si un pixel n'est pas opaque. */
export function hasTransparency(image: HTMLImageElement): boolean {
  try {
    const { naturalWidth: width, naturalHeight: height } = image;
    if (!width || !height) return false;
    const scale = Math.min(1, 96 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return false;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let alpha = 3; alpha < pixels.length; alpha += 4) if ((pixels[alpha] ?? 255) < 255) return true;
    return false;
  } catch {
    // Image d'une autre origine sans CORS : le canevas est illisible.
    return false;
  }
}
