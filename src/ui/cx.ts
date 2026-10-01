/** Classes d'un élément, valeurs vides ou fausses ignorées : `cx('a', busy && 'b', extra)`. */
export function cx(...classes: readonly (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
