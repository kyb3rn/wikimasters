export type RouteParams = Readonly<Record<string, string>>;

/**
 * Compare un chemin à un motif. Segments fixes, `:nom` pour un segment variable,
 * `*` en dernier pour « tout le reste » (y compris rien). Les barres en trop sont ignorées.
 *
 *     matchRoute('/marketplace/:id', '/marketplace/abc')  → { id: 'abc' }
 *     matchRoute('/profile/*', '/profile/x/collection')   → { '*': 'x/collection' }
 *     matchRoute('/pulls', '/collection')                  → null
 */
export function matchRoute(pattern: string, path: string): RouteParams | null {
  const expected = segments(pattern);
  const actual = segments(path);
  const params: Record<string, string> = {};

  for (const [i, segment] of expected.entries()) {
    if (segment === '*' && i === expected.length - 1) {
      params['*'] = actual.slice(i).map(decode).join('/');
      return params;
    }
    const value = actual[i];
    if (value === undefined) return null;
    if (segment.startsWith(':')) params[segment.slice(1)] = decode(value);
    else if (segment !== value) return null;
  }
  return actual.length === expected.length ? params : null;
}

function segments(path: string): string[] {
  return path.split('/').filter((s) => s !== '');
}

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
