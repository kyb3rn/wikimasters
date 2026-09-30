import { injectStyle, setClass, watchDom, whenBody } from '@/core/dom';
import { isRecord } from '@/core/guards';
import { net } from '@/core/net';
import type { Feature } from '@/core/runtime';
import { findHumanCheck, isHumanCheckRequest, PULLS_ROUTE } from '@/site/pulls';
import { ensureBaseStyle, tokens } from '@/ui/theme';
import { toast } from '@/ui/toast';

const BOX = 'wm-human-check';
/** Titre de la page, parent de l'encart : porte le fond assombri tant que l'encart est là. */
const HOST = 'wm-human-check-host';

/**
 * L'encart reste celui du site (la case et le bouton sont cliqués par l'utilisateur lui-même), sorti du flux
 * et posé au centre de l'écran. Sous nos modales et nos toasts, au-dessus de tout le site (barres comprises).
 * Le fond de l'encart, translucide dans la page, est posé sur la surface du site pour rester lisible.
 */
const CSS = `
/* L'animation du titre (« forwards ») lui laisse un transform : l'encart, fixe, s'y placerait au lieu de l'écran.
   Elle reste coupée après la vérification, sinon elle se rejouerait. */
.${HOST}.${HOST} { animation: none; }
.${HOST}:has(> .${BOX})::before { content: ''; position: fixed; inset: 0; z-index: 2147480000;
  background: ${tokens.backdrop}; backdrop-filter: ${tokens.backdropBlur}; animation: wm-human-check-in 0.18s ease-out; }
.${BOX}.${BOX} { position: fixed; inset: 0; z-index: 2147480001; width: calc(100% - 32px); height: fit-content;
  margin: auto; background-color: ${tokens.surface};
  background-image: linear-gradient(color-mix(in srgb, ${tokens.accent} 10%, transparent) 0 0);
  box-shadow: 0 16px 48px rgb(0 0 0 / 55%); animation: wm-human-check-in 0.18s ease-out; }
@keyframes wm-human-check-in { from { opacity: 0; } }

/* Envoi en cours (pour le site, seul cas où la case est cochée et « Continuer » désactivé) : une roue à la place
   d'« Enregistrement... », texte seulement rendu invisible (taille du bouton et lecteurs d'écran inchangés). */
.${BOX}:has(input[type="checkbox"]:checked) button:disabled { position: relative; -webkit-text-fill-color: transparent; }
.${BOX}:has(input[type="checkbox"]:checked) button:disabled::after { content: ''; position: absolute; inset: 0;
  width: 1rem; height: 1rem; margin: auto; border: 2px solid currentColor; border-right-color: transparent;
  border-radius: 50%; animation: wm-spin 0.8s linear infinite; }
`;

export const pullsHumanCheck: Feature = {
  id: 'pulls-human-check',
  name: 'Vérification en modale',
  description: 'La vérification « Je ne suis pas un robot » s’ouvre en modale par-dessus la page, dont le contenu reste centré.',
  category: 'Paquets',
  routes: [PULLS_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal, log } = ctx;

    // Le site écrit son erreur sous le cadre des paquets, caché derrière la modale.
    function refused(message: string): void {
      log.warn('vérification refusée', message);
      toast.error(message, { title: 'Vérification impossible' });
    }
    net.observe(
      (request) => isHumanCheckRequest(request) && !request.own,
      async (exchange) => {
        if (exchange.ok) return;
        const body = await exchange.json().catch(() => undefined);
        refused(isRecord(body) && typeof body.error === 'string' ? body.error : `Erreur ${exchange.status} du site.`);
      },
      { signal },
    );
    net.track(
      (request) => isHumanCheckRequest(request) && !request.own,
      () => (status) => {
        if (status === undefined) refused("Le site n'a pas répondu (erreur réseau).");
      },
      { signal },
    );

    await whenBody();
    if (signal.aborted) return;
    // Animation `wm-spin` de la roue.
    ensureBaseStyle();
    injectStyle('pulls-human-check', CSS);
    watchDom(
      () => {
        const box = findHumanCheck();
        if (!box) return;
        setClass(box, BOX, true);
        if (box.parentElement) setClass(box.parentElement, HOST, true);
      },
      { signal },
    );
    ctx.onDispose(() => document.querySelectorAll(`.${BOX}, .${HOST}`).forEach((el) => el.classList.remove(BOX, HOST)));
  },
};
