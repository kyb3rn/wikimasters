import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StateHook } from '@/core/react';
import { jumpByPageState } from '@/services/site-pagination';
import type { SitePaginationBar } from '@/site/pagination';

afterEach(() => vi.unstubAllGlobals());

describe('jumpByPageState', () => {
  const bar = {} as SitePaginationBar;

  it('change l’état `page` de la page, puis remonte en haut de <main>', () => {
    const scrolls: unknown[] = [];
    vi.stubGlobal('document', { querySelector: () => ({ scrollTo: (options: unknown) => scrolls.push(options) }) });
    const set = vi.fn();
    const page: StateHook = { value: 2, set };
    const go = jumpByPageState(() => page)(bar, 2, 7);
    expect(set).not.toHaveBeenCalled();
    go?.();
    expect(set).toHaveBeenCalledWith(7);
    expect(scrolls).toEqual([{ top: 0, behavior: 'smooth' }]);
  });

  it('état introuvable, ou qui ne vaut plus la page affichée : pas de saut', () => {
    expect(jumpByPageState(() => undefined)(bar, 2, 7)).toBeUndefined();
    expect(jumpByPageState(() => ({ value: 3, set: () => {} }))(bar, 2, 7)).toBeUndefined();
  });
});
