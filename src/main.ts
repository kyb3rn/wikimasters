import { trackSounds } from '@/core/audio';
import { initConsole } from '@/core/expose';
import { createLogger } from '@/core/log';
import { net } from '@/core/net';
import { createRouter } from '@/core/router';
import { createRuntime, exposeFeatures } from '@/core/runtime';
import { featureChoice, onSettingsChange, setFeatureChoice, syncSettingsAcrossTabs } from '@/core/settings';
import { features } from '@/features';
import { trackSupabaseSession } from '@/site/api';
import { trackServerClock } from '@/site/clock';
import { balanceBottom } from '@/site/header';
import { trackGuildMembership } from '@/site/guild';
import { trackMe } from '@/site/me';
import { trackProStatus } from '@/site/pro';
import { ROUTE_VIEW_KEYS } from '@/site/routes';
import { configureToasts } from '@/ui/toast';

const log = createLogger();

/** Marge entre le bas du solde et la pile des toasts d'erreur. */
const TOAST_GAP = 12;
/**
 * Bas du solde quand aucun n'est affiché (page sans en-tête, solde pas encore rendu) : à peu près là où il se trouve
 * d'habitude, pour que les toasts ne changent pas de place quand il apparaît.
 */
const BALANCE_BOTTOM_FALLBACK = 44;

function start(): void {
  // Version de dev et de production installées ensemble : une seule démarre.
  if (window.wm) {
    log.warn(`déjà chargé (v${window.wm.version}${window.wm.dev ? ' dev' : ''}) : cette copie ne démarre pas`);
    return;
  }
  initConsole({ version: __VERSION__, dev: __DEV__ });

  net.install(window);
  // Avant que la page ne charge ses sons : ils ne sont reconnus qu'à leur chargement.
  trackSounds();
  trackSupabaseSession();
  trackServerClock();
  trackProStatus();
  trackMe();
  trackGuildMembership();
  const router = createRouter(window, createLogger('navigation'), { viewKeys: ROUTE_VIEW_KEYS });
  configureToasts({ topOffset: () => Math.round((balanceBottom(document) ?? BALANCE_BOTTOM_FALLBACK) + TOAST_GAP) });

  const runtime = createRuntime({
    features,
    isEnabled: (feature) => featureChoice(feature.id) ?? !feature.defaultOff,
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
