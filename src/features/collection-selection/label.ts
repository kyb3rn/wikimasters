/** « 3 sélectionnées », « 1 sélectionnée », « 0 sélectionnée ». */
export function selectedLabel(count: number): string {
  return count > 1 ? 'sélectionnées' : 'sélectionnée';
}
