import { initConsole } from '@/core/expose';
import { createLogger } from '@/core/log';
import { net } from '@/core/net';
import { createRouter } from '@/core/router';
import { createRuntime, exposeFeatures } from '@/core/runtime';
import { featureChoice, onSettingsChange, setFeatureChoice, syncSettingsAcrossTabs } from '@/core/settings';
import { features } from '@/features';
import { trackSupabaseSession } from '@/site/api';
import { balanceBottom } from '@/site/header';
import { trackProStatus } from '@/site/pro';
import { configureToasts } from '@/ui/toast';

const log = createLogger();

/** Marge entre le bas du solde et la pile des toasts d'erreur. */
const TOAST_GAP = 12;

function start(): void {
  // Version de dev et de production installées ensemble : une seule démarre.
  if (window.wm) {
    log.warn(`déjà chargé (v${window.wm.version}${window.wm.dev ? ' dev' : ''}) : cette copie ne démarre pas`);
    return;
  }
  initConsole({ version: __VERSION__, dev: __DEV__ });

  net.install(window);
  trackSupabaseSession();
  trackProStatus();
  const router = createRouter(window, createLogger('navigation'));
  configureToasts({ topOffset: () => Math.round((balanceBottom(document) ?? 44) + TOAST_GAP) });

  const runtime = createRuntime({
    features,
    isEnabled: (feature) => featureChoice(feature.id) ?? feature.enabledByDefault ?? true,
    saveEnabled: setFeatureChoice,
    createLogger,
  });
  runtime.update(router.path);
  router.onChange((path) => runtime.update(path));
  // Une fonctionnalité (dés)activée ici ou dans un autre onglet est montée ou démontée tout de suite.
  syncSettingsAcrossTabs(window);
  onSettingsChange(() => runtime.refresh());
  exposeFeatures(runtime);

  const active = runtime.status().filter((s) => s.state === 'mounted').map((s) => s.id);
  log.info(`v${__VERSION__}${__DEV__ ? ' (dev)' : ''} · actives ici : ${active.join(', ') || 'aucune'}`);
}

start();
