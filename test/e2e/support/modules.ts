import path from 'node:path';
import { build } from 'esbuild';
import type { Page } from '@playwright/test';
import type * as SharedApi from './shared-api.entry';

declare global {
  interface Window {
    /** Exports de `shared-api.entry.ts`, posés par `loadSharedApi`. */
    wmTest: typeof SharedApi;
  }
}

const ROOT = path.resolve(import.meta.dirname, '../../..');

let bundled: Promise<string> | undefined;

/** `shared-api.entry.ts` et ce qu'il importe de src/, assemblés une fois (comme le script, en dev). */
function bundleSharedApi(): Promise<string> {
  bundled ??= build({
    absWorkingDir: ROOT,
    entryPoints: [path.join(import.meta.dirname, 'shared-api.entry.ts')],
    tsconfig: path.join(ROOT, 'tsconfig.json'),
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'wmTest',
    target: 'es2022',
    jsx: 'automatic',
    jsxImportSource: 'preact',
    define: { __DEV__: 'true', __VERSION__: '"test"' },
  }).then((result) => result.outputFiles[0]?.text ?? '');
  return bundled;
}

/** Page vide (ce `body`), puis les modules du socle dans `window.wmTest`. */
export async function loadSharedApi(page: Page, body = ''): Promise<void> {
  await page.setContent(`<!doctype html><html lang="fr"><head><meta charset="utf-8"></head><body>${body}</body></html>`);
  await page.addScriptTag({ content: await bundleSharedApi() });
}
