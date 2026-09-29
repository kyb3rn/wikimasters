/**
 * Messages binaires de Supabase Realtime (realtime-js, protocole 2.0.0). Le serveur envoie
 * les diffusions des canaux privés du site (`auction:<id>`, `profile:<uid>`, `notifications:<uid>`)
 * sous cette forme :
 *
 *   [4][taille sujet][taille événement][taille métadonnées][encodage] sujet événement métadonnées charge
 *
 * Tailles sur un octet ; sujet, événement et métadonnées en UTF-8 (métadonnées en JSON) ;
 * charge en JSON (encodage 1) ou brute (0). Relevé le 29/09/2026.
 */
export interface RealtimeBroadcast {
  /** `realtime:auction:<id>`, `realtime:profile:<uid>`… */
  readonly topic: string;
  /** `BID`, `UPDATE`, `INSERT`… */
  readonly event: string;
  readonly metadata: unknown;
  /** JSON décodé, ou octets bruts (encodage 0). */
  readonly payload: unknown;
}

const USER_BROADCAST = 4;
const HEADER_SIZE = 5;
const JSON_ENCODING = 1;

/** `undefined` si ce n'est pas une diffusion Realtime lisible. */
export function decodeBroadcast(bytes: Uint8Array): RealtimeBroadcast | undefined {
  const [kind, topicSize = 0, eventSize = 0, metadataSize = 0, encoding] = bytes;
  if (kind !== USER_BROADCAST || bytes.length < HEADER_SIZE + topicSize + eventSize + metadataSize) return undefined;

  const utf8 = new TextDecoder('utf-8', { fatal: true });
  let offset = HEADER_SIZE;
  const take = (size: number) => bytes.subarray(offset, (offset += size));
  try {
    const topic = utf8.decode(take(topicSize));
    const event = utf8.decode(take(eventSize));
    const metadataText = utf8.decode(take(metadataSize));
    const rest = bytes.subarray(offset);
    return {
      topic,
      event,
      metadata: metadataText ? (JSON.parse(metadataText) as unknown) : null,
      payload: encoding === JSON_ENCODING ? (JSON.parse(utf8.decode(rest)) as unknown) : rest.slice(),
    };
  } catch {
    return undefined;
  }
}
