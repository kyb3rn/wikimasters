import { useRef } from 'preact/hooks';

/**
 * La dernière valeur reçue, lue par une référence : un écouteur inscrit une fois (Échap, minuterie) appelle ainsi
 * le dernier `onClose` sans être réinscrit à chaque rendu.
 */
export function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
