import { classMarks, watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { watchSiteRefusal } from '@/site/api';
import { findHumanCheck, isHumanCheckSubmit } from '@/site/pulls';
import { PULLS_ROUTE } from '@/site/routes';
import { alpha, ensureBaseStyle, layers, tokens } from '@/ui/theme';
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
.${HOST}:has(> .${BOX})::before { content: ''; position: fixed; inset: 0; z-index: ${layers.pageOverlay};
  background: ${tokens.backdrop}; backdrop-filter: ${tokens.backdropBlur}; animation: wm-human-check-in 0.18s ease-out; }
.${BOX}.${BOX} { position: fixed; inset: 0; z-index: ${layers.pageOverlay + 1}; width: calc(100% - 32px); height: fit-content;
  margin: auto; background-color: ${tokens.surface};
  background-image: linear-gradient(${alpha(tokens.accent, 10, 'srgb')} 0 0);
  box-shadow: 0 16px 48px rgb(0 0 0 / 55%); animation: wm-human-check-in 0.18s ease-out; }
@keyframes wm-human-check-in { from { opacity: 0; } }

/* Envoi en cours (pour le site, seul cas où la case est cochée et « Continuer » désactivé) : une roue à la place
   d'« Enregistrement... », texte seulement rendu invisible (taille du bouton et lecteurs d'écran inchangés). Le site
   désactive lui-même le bouton : la roue suit son état, sans verrou à nous. */
.${BOX}:has(input[type="checkbox"]:checked) button:disabled { position: relative; -webkit-text-fill-color: transparent; }
.${BOX}:has(input[type="checkbox"]:checked) button:disabled::after { content: ''; position: absolute; inset: 0;
  width: 1rem; height: 1rem; margin: auto; border: 2px solid currentColor; border-right-color: transparent;
  border-radius: 50%; animation: wm-spin 0.8s linear infinite; }
`;

export const pullsHumanCheck: Feature = {
  id: 'pulls-human-check',
  name: 'Vérification en modale',
  description: "La vérification « Je ne suis pas un robot » s'ouvre en modale par-dessus la page, dont le contenu reste centré.",
  category: 'Paquets',
  routes: [PULLS_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal, log } = ctx;

    // Le site écrit son erreur sous le cadre des paquets, caché derrière la modale.
    watchSiteRefusal(
      (request) => isHumanCheckSubmit(request) && !request.own,
      (message) => {
        log.warn('vérification refusée', message);
        toast.error(message, { title: 'Vérification impossible' });
      },
      { signal },
    );

    if (!(await ctx.ready())) return;
    // Animation `wm-spin` de la roue.
    ensureBaseStyle();
    ctx.style(CSS);
    const marks = classMarks(signal);
    watchDom(
      () => {
        const box = findHumanCheck();
        if (!box) return;
        marks.set(box, BOX, true);
        if (box.parentElement) marks.set(box.parentElement, HOST, true);
      },
      { signal },
    );
  },
};
