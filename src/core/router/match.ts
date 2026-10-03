export type RouteParams = Readonly<Record<string, string>>;

/**
 * Compare une page à un motif. Chemin : segments fixes, `:nom` pour un segment variable, `*` en dernier pour « tout
 * le reste » (y compris rien) ; les barres en trop sont ignorées. Requête (vue d'une page, voir `createRouter`) :
 * exactement les mêmes paramètres des deux côtés, dans n'importe quel ordre. Un motif sans requête ne reconnaît donc
 * pas une page affichée dans une vue.
 *
 *     matchRoute('/marketplace/:id', '/marketplace/abc')            → { id: 'abc' }
 *     matchRoute('/profile/*', '/profile/x/collection')             → { '*': 'x/collection' }
 *     matchRoute('/pulls', '/collection')                            → null
 *     matchRoute('/collection?vue=revente', '/collection?vue=revente') → {}
 *     matchRoute('/collection', '/collection?vue=revente')            → null
 */
export function matchRoute(pattern: string, path: string): RouteParams | null {
  const [patternPath, patternQuery] = splitQuery(pattern);
  const [actualPath, actualQuery] = splitQuery(path);
  if (canonicalQuery(patternQuery) !== canonicalQuery(actualQuery)) return null;

  const expected = segments(patternPath);
  const actual = segments(actualPath);
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

/**
 * Requête dans un ordre fixe (par nom, puis par valeur), sans `?` : deux écritures des mêmes paramètres donnent la
 * même chaîne.
 */
export function canonicalQuery(query: string | URLSearchParams): string {
  const params = typeof query === 'string' ? new URLSearchParams(query) : query;
  const entries = [...params.entries()].sort(([a, x], [b, y]) => (a === b ? compare(x, y) : compare(a, b)));
  return new URLSearchParams(entries).toString();
}

function compare(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function splitQuery(path: string): [path: string, query: string] {
  const at = path.indexOf('?');
  return at < 0 ? [path, ''] : [path.slice(0, at), path.slice(at + 1)];
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
