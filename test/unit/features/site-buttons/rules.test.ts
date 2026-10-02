import { describe, expect, it } from 'vitest';
import { classify, type Restyle } from '@/features/site-buttons/rules';

/** Bouton du site tel que relevé dans les captures (classes du 29/09/2026). */
interface Facts {
  text?: boolean;
  icon?: string;
  graphic?: boolean;
  role?: string | null;
  popup?: boolean;
  balance?: boolean;
}

function site(classes: string, { text = true, icon, graphic = icon !== undefined, role = null, popup = false, balance = false }: Facts = {}) {
  return classify({ classes: new Set(classes.split(/\s+/).filter(Boolean)), text, graphic, icon, role, popup, balance });
}

const style = (shape: Restyle['shape'], tone: string, fill: string, size = 'md'): Restyle =>
  ({ shape, style: { tone, fill, size } }) as Restyle;

describe('boutons du site : allure standard', () => {
  it('fond vert plein : vert plein, largeur du site gardée', () => {
    expect(site('flex-1 py-2.5 rounded-lg bg-[var(--color-accent)] text-[var(--color-accent-foreground)] text-sm font-semibold')).toEqual(
      style('standard', 'accent', 'solid'),
    );
    // Gros bouton (texte de base, py-3) : grand.
    expect(site('px-8 py-3 rounded-xl bg-[var(--color-accent)] text-[var(--color-accent-foreground)] font-semibold')).toEqual(
      style('standard', 'accent', 'solid', 'lg'),
    );
    expect(site('flex w-full px-5 py-3 rounded-xl bg-[var(--color-accent)] text-sm font-semibold')).toEqual(
      style('standard', 'accent', 'solid'),
    );
  });

  it('fond teinté : contour de sa couleur', () => {
    const tinted = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-accent)]/10 text-[var(--color-accent)]';
    expect(site(tinted)).toEqual(style('standard', 'accent', 'outline', 'sm'));
    expect(site('px-2 py-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 text-xs text-sky-400')).toEqual(
      style('standard', 'info', 'outline', 'sm'),
    );
    expect(site('px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500/10 text-amber-400')).toEqual(style('standard', 'warning', 'outline'));
    expect(site('px-4 py-2 rounded-lg text-sm font-semibold bg-green-500/10 text-green-400')).toEqual(style('standard', 'accent', 'outline'));
    expect(site('w-full py-2.5 rounded-xl text-sm font-semibold bg-red-500/10 text-red-400 border border-red-500/20')).toEqual(
      style('standard', 'danger', 'outline'),
    );
  });

  it('rouge plein, dégradés PRO et vert', () => {
    expect(site('flex-1 py-2.5 rounded-lg bg-red-500 text-white text-sm font-semibold')).toEqual(style('standard', 'danger', 'solid'));
    expect(site('w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm')).toEqual(
      style('standard', 'pro', 'solid'),
    );
    expect(site('px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white')).toEqual(
      style('standard', 'accent', 'solid', 'lg'),
    );
  });

  it('bordure d’accent pleine : état choisi, vert plein', () => {
    const wished = 'inline-flex w-full rounded-lg px-3 py-2 text-sm border border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]';
    expect(site(wished)).toEqual(style('standard', 'accent', 'solid'));
  });

  it('gris : bordé en contour, fond plein en plein, sinon ghost ; corbeille en rouge', () => {
    const bordered = 'flex-1 inline-flex py-2.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-foreground)]/70';
    expect(site(bordered)).toEqual(style('standard', 'neutral', 'outline'));
    expect(site(bordered, { icon: 'trash-2' })).toEqual(style('standard', 'danger', 'outline'));
    expect(site('px-5 py-2.5 rounded-xl bg-[var(--color-surface-light)] text-sm font-medium')).toEqual(style('standard', 'neutral', 'solid'));
    expect(site('px-4 py-2 rounded-xl text-sm text-[var(--color-foreground)]/60 hover:bg-white/5')).toEqual(
      style('standard', 'neutral', 'ghost'),
    );
  });

  it('rouge au survol seulement : ghost rouge', () => {
    expect(site('px-4 py-1.5 rounded-lg text-sm text-[var(--color-foreground)]/40 hover:text-red-400 hover:bg-red-400/10')).toEqual(
      style('standard', 'danger', 'ghost'),
    );
  });

  it('solde : vert ghost, petit, arrondi', () => {
    const balance =
      'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-[var(--color-accent)] bg-[var(--color-surface)]/90';
    expect(site(balance, { balance: true })).toEqual({ shape: 'standard', style: { tone: 'accent', fill: 'ghost', size: 'sm', pill: true } });
    // Mêmes classes ailleurs : pas arrondi.
    expect(site(balance)).toEqual(style('standard', 'accent', 'ghost', 'sm'));
  });

  it('icône seule : rond (rond chez le site, ou sans fond ni trait), sinon carré ; petit jusqu’à 36 px, sauf « Vue du marché »', () => {
    const header = 'relative p-2 rounded-xl text-[var(--color-foreground)]/60 hover:bg-[var(--color-surface-light)]';
    // Icône du site hors lucide (cloche des notifications).
    expect(site(header, { text: false, graphic: true })).toEqual(style('round', 'neutral', 'ghost', 'sm'));
    const arrow = 'w-12 h-12 rounded-full bg-[var(--color-surface-light)] border border-[var(--color-border)] flex';
    expect(site(arrow, { text: false, icon: 'chevron-right' })).toEqual(style('round', 'neutral', 'outline'));
    const shop = 'flex items-center justify-center size-7 rounded-full text-[var(--color-foreground)]/50';
    expect(site(shop, { text: false, icon: 'x' })).toEqual(style('round', 'neutral', 'ghost', 'sm'));
    const send = 'p-2.5 rounded-xl bg-[var(--color-accent)] text-[var(--color-accent-foreground)] flex-shrink-0';
    expect(site(send, { text: false, icon: 'send' })).toEqual(style('square', 'accent', 'solid'));
    const chart = 'relative shrink-0 flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)]';
    expect(site(chart, { text: false, icon: 'chart-line' })).toEqual(style('square', 'neutral', 'outline'));
  });

  it('sur le coin d’une carte : rond petit, plein de sa couleur pour rester lisible sur l’image', () => {
    const remove =
      'absolute -top-2 -right-2 z-30 w-6 h-6 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex ' +
      'items-center justify-center text-[var(--color-foreground)]/60 hover:text-red-400 hover:border-red-400/50 transition-colors ' +
      'cursor-pointer shadow-md';
    expect(site(remove, { text: false, graphic: true })).toEqual(style('round', 'danger', 'solid', 'sm'));
  });

  it('autres contrôles : gardent leur allure', () => {
    const others: [string, Facts?][] = [
      ['px-3 py-1 rounded-full text-xs font-semibold opacity-50'], // pastille de rareté
      ['px-4 py-3 text-sm font-medium text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]'], // onglet
      ['px-4 py-3 text-sm font-medium whitespace-nowrap text-[var(--color-foreground)]/50'], // onglet non choisi
      ['p-1 text-[var(--color-foreground)]/40 hover:text-[var(--color-foreground)]', { text: false, icon: 'x' }], // croix sans arrondi
      ['flex-1 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-[var(--color-accent-foreground)]'], // onglet plein
      ['rounded px-2 py-0.5 text-[10px] font-semibold bg-[var(--color-accent)]'], // onglet de la modale de carte
      ['w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--color-surface-light)] text-left'], // ligne de liste
      ['flex w-full min-h-[42px] rounded-lg border py-2 pl-3 pr-2', { popup: true }], // liste déroulante
      ['p-0.5 rounded-md bg-transparent text-amber-200/65', { text: false, icon: 'star' }], // étoile
      ['w-3 h-3 rounded-full bg-[var(--color-accent)]', { text: false }], // point du carrousel
      ['relative w-11 h-6 rounded-full bg-[var(--color-accent)]', { text: false, icon: undefined }], // interrupteur
      ['inline-flex items-center gap-1.5 text-xs text-[var(--color-foreground)]/55'], // lien en texte
      ['flex h-9 items-center justify-center px-2.5 bg-[var(--color-accent)]', { text: false, icon: 'grid' }], // segment
      ['flex items-center justify-center px-2.5 border-r border-[var(--color-border)]', { text: false, icon: 'minus' }], // − d'un champ
      ['absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full', { text: false, icon: 'x' }], // croix d'un champ
      ['relative flex flex-col items-center justify-center gap-4'], // paquet à ouvrir
      ['px-3 py-1.5 rounded-lg hidden sm:inline-flex'], // affiché selon la largeur
      ['px-3 py-1.5 rounded-lg', { role: 'tab' }],
    ];
    for (const [classes, options] of others) expect(site(classes, options), classes).toBeUndefined();
  });
});
