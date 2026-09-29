import { expose } from '@/core/expose';
import type { Runtime } from './runtime';
import type { FeatureStatus } from './types';

export interface FeaturesConsole {
  /** État de chaque fonctionnalité (affiché en tableau). */
  list(): FeatureStatus[];
  enable(id: string): void;
  disable(id: string): void;
}

declare module '@/core/expose' {
  interface WmApi {
    features?: FeaturesConsole;
  }
}

/** `wm.features` : voir et (dés)activer les fonctionnalités depuis la console. */
export function exposeFeatures(runtime: Runtime): void {
  expose('features', {
    list() {
      const status = runtime.status();
      console.table(status); // eslint-disable-line no-console -- sortie demandée à la console
      return status;
    },
    enable: (id) => runtime.setEnabled(id, true),
    disable: (id) => runtime.setEnabled(id, false),
  });
}
