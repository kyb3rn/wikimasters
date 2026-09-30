import type { ComponentChildren } from 'preact';
import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';
import { siteClass } from '@/ui/site';
import { formatCountdown } from './time';

export type ProPackState =
  /** Le site, ou le script, demande si le pack est disponible. */
  | { readonly kind: 'loading' }
  /** Pas de réponse, même après les relances. */
  | { readonly kind: 'error' }
  /** Réponse reçue, mais la page ne peut pas l'afficher sans être rechargée. */
  | { readonly kind: 'reload' }
  | { readonly kind: 'available'; readonly disabled: boolean; readonly opening: boolean }
  /** Déjà ouvert aujourd'hui ; millisecondes avant minuit. */
  | { readonly kind: 'claimed'; readonly remaining: number };

export interface ProPackProps {
  readonly state: ProPackState;
  readonly onOpen: () => void;
  readonly onRetry: () => void;
  readonly onReload: () => void;
}

function describe(state: ProPackState): string {
  switch (state.kind) {
    case 'claimed':
      return 'Pack du jour déjà ouvert : le prochain sera disponible à minuit.';
    case 'error':
      return "Impossible de savoir pour l'instant si le pack du jour est disponible.";
    case 'reload':
      return 'Actualisez la page pour afficher le pack du jour.';
    default:
      return 'Un paquet de 15 cartes aux raretés plus élevées, offert chaque jour aux membres PRO.';
  }
}

function Button(props: { disabled?: boolean; onClick?: () => void; label?: string; children: ComponentChildren }) {
  return (
    <button type="button" class={buttonClass('wide', { tone: 'pro', fill: 'solid' })} disabled={props.disabled} aria-label={props.label} onClick={props.onClick}>
      {props.children}
    </button>
  );
}

function Action({ state, onOpen, onRetry, onReload }: ProPackProps) {
  switch (state.kind) {
    case 'loading':
      return (
        <Button disabled label="Chargement du pack Pro">
          <Icon name="spinner" size={20} class="wm-spin" />
        </Button>
      );
    case 'available':
      return state.opening ? (
        <Button disabled>
          <Icon name="spinner" size={16} class="wm-spin" />
          Ouverture…
        </Button>
      ) : (
        <Button disabled={state.disabled} onClick={onOpen}>
          Ouvrir
        </Button>
      );
    case 'claimed': {
      const time = formatCountdown(state.remaining);
      return (
        <Button disabled label={`Prochain pack Pro dans ${time}`}>
          <span class="font-mono">{time}</span>
        </Button>
      );
    }
    case 'error':
      return <Button onClick={onRetry}>Réessayer</Button>;
    case 'reload':
      return <Button onClick={onReload}>Actualiser</Button>;
  }
}

/** Cadre du pack PRO du jour : titre, description, bouton d'ouverture (ou temps avant minuit). */
export function ProPack(props: ProPackProps) {
  return (
    <section class={`${siteClass.proFrame} wm-pro-pack`} aria-label="Pack Pro">
      <div>
        <h2 class={siteClass.proTitle} style={{ fontFamily: 'var(--font-heading)' }}>
          Pack Pro
        </h2>
        <p class={siteClass.proText}>{describe(props.state)}</p>
      </div>
      <Action {...props} />
    </section>
  );
}
