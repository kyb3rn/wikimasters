/**
 * Valeur JSON dans le localStorage du site. Relue à chaque `get` : une modification
 * faite dans un autre onglet ou à la console est vue tout de suite.
 * Nommer les clés `wm-<module>-v<n>` et changer `n` quand la forme change.
 */
export interface JsonStore<T> {
  get(): T;
  set(value: T): void;
  update(change: (current: T) => T): T;
}

/**
 * `parse` valide ce qui est relu (ancienne forme, valeur modifiée à la main…) : elle renvoie
 * la valeur typée, ou `undefined` pour retomber sur `fallback`. Ne jamais modifier en place
 * une valeur obtenue par `get` : passer par `set` ou `update`.
 */
export function jsonStore<T>(key: string, fallback: T, parse: (raw: unknown) => T | undefined): JsonStore<T> {
  // Valeur que le localStorage a refusée (plein, bloqué) : gardée en mémoire pour la session.
  let unsaved: { readonly value: T } | undefined;

  function get(): T {
    if (unsaved) return unsaved.value;
    try {
      const text = localStorage.getItem(key);
      if (text !== null) {
        const value = parse(JSON.parse(text));
        if (value !== undefined) return value;
      }
    } catch {
      // Stockage inaccessible ou JSON invalide : valeur de repli.
    }
    return fallback;
  }

  function set(value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      unsaved = undefined;
    } catch {
      unsaved = { value };
    }
  }

  return {
    get,
    set,
    update(change) {
      const next = change(get());
      set(next);
      return next;
    },
  };
}
