import { decodeBroadcast, type RealtimeBroadcast } from '@/site/realtime';
import { containsSecret, redactBody } from './redact';

/**
 * Mise en forme d'un contenu enregistré (corps de réponse, message temps réel), toujours masqué :
 * - texte : secrets masqués, coupé à `maxChars` ;
 * - diffusion Supabase Realtime (binaire) : décodée en JSON lisible, puis masquée (`realtime`) ;
 * - autre binaire : gardé intact en base64, sauf s'il contient un jeton ou une adresse e-mail.
 */
export interface Content {
  readonly text: string;
  readonly encoding?: 'base64' | 'realtime';
  /** Texte coupé, ou binaire omis (trop gros, ou contenant des données personnelles). */
  readonly truncated: boolean;
}

export function textContent(text: string, maxChars: number): Content {
  const redacted = redactBody(text);
  return redacted.length > maxChars
    ? { text: redacted.slice(0, maxChars), truncated: true }
    : { text: redacted, truncated: false };
}

export function binaryContent(bytes: Uint8Array, type: string, maxChars: number): Content {
  if (containsSecret(new TextDecoder('latin1').decode(bytes))) {
    return { text: `[binaire masqué : ${type}, ${bytes.length} octets, contient des données personnelles]`, truncated: true };
  }
  if (Math.ceil(bytes.length / 3) * 4 > maxChars) {
    return { text: `[binaire trop gros : ${type}, ${bytes.length} octets]`, truncated: true };
  }
  return { text: toBase64(bytes), encoding: 'base64', truncated: false };
}

/** Message temps réel binaire : diffusion Realtime décodée si possible, sinon binaire. */
export function socketBinaryContent(bytes: Uint8Array, type: string, maxChars: number): Content {
  const broadcast = decodeBroadcast(bytes);
  if (!broadcast || broadcast.payload instanceof Uint8Array) return binaryContent(bytes, type, maxChars);
  const { topic, event, metadata, payload }: RealtimeBroadcast = broadcast;
  return { ...textContent(JSON.stringify({ topic, event, metadata, payload }), maxChars), encoding: 'realtime' };
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  // Par tranches : String.fromCharCode n'accepte pas des centaines de milliers d'arguments.
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function fromBase64(text: string): Uint8Array {
  return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
}
