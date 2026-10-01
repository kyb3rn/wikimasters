import type { GuildMessage, Player } from '@/site/api';

/** Messages connus et nouveaux, sans doublon (le plus récent l'emporte), triés par date comme chez le site. */
export function mergeMessages(known: readonly GuildMessage[], incoming: readonly GuildMessage[]): GuildMessage[] {
  const byId = new Map<string, GuildMessage>();
  for (const message of known) byId.set(message.id, message);
  for (const message of incoming) {
    const previous = byId.get(message.id);
    // Une ligne du temps réel n'a pas d'auteur : garder celui déjà connu.
    byId.set(message.id, message.sender || !previous ? message : { ...message, sender: previous.sender });
  }
  return [...byId.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export interface ChatDay {
  /** « 19 sept. » */
  readonly label: string;
  readonly messages: readonly GuildMessage[];
}

export const dayLabel = (iso: string): string => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
export const timeLabel = (iso: string): string => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** Messages groupés par jour (date locale), comme le site. */
export function groupByDay(messages: readonly GuildMessage[]): ChatDay[] {
  const days: { label: string; messages: GuildMessage[] }[] = [];
  for (const message of messages) {
    const label = dayLabel(message.createdAt);
    const last = days[days.length - 1];
    if (last?.label === label) last.messages.push(message);
    else days.push({ label, messages: [message] });
  }
  return days;
}

/** Auteurs connus par leurs messages (ceux de l'API les portent). */
export function collectSenders(messages: readonly GuildMessage[], into: Map<string, Player>): void {
  for (const { sender } of messages) if (sender) into.set(sender.id, sender);
}
