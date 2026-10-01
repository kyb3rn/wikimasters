import { defineSettings } from '@/core/settings';
import { protectionReason, type CardFacts } from './protection';

/** Protections communes à tous les défaussages rapides (paquets, modale de carte…). */
export const quickDiscardSettings = defineSettings('quick-discard', {
  protectStarred: {
    type: 'boolean',
    label: 'Protéger les cartes en favori',
    default: true,
    primary: true,
  },
  protectTagged: {
    type: 'boolean',
    label: 'Protéger les cartes avec une étiquette',
    default: true,
    primary: true,
  },
});

/** Raison de refuser le défaussage rapide de cette carte, selon les réglages ; `undefined` si permis. */
export function quickDiscardProtection(facts: CardFacts): string | undefined {
  return protectionReason(facts, {
    starred: quickDiscardSettings.get('protectStarred'),
    tagged: quickDiscardSettings.get('protectTagged'),
  });
}
