/**
 * Filtre des sons Web Audio de la page. `name` : le fichier du son sans son extension (`card-flip`),
 * quand il a été chargé par `fetch` puis décodé par `decodeAudioData` ; sinon `undefined`.
 * Vrai : le son ne part pas.
 */
export type SoundFilter = (name: string | undefined) => boolean;

const filters = new Set<SoundFilter>();
/** Octets d'un fichier son → son nom, le temps qu'ils soient décodés. */
const loaded = new WeakMap<ArrayBuffer, string>();
const names = new WeakMap<AudioBuffer, string>();
let installed = false;

const AUDIO_FILE = /\/([^/?#]+)\.(mp3|ogg|wav|m4a|aac)(?:[?#]|$)/i;

/**
 * Reconnaît désormais les sons de la page à leur fichier. À appeler avant qu'elle ne les charge
 * (au démarrage du script) ; `blockSounds` l'appelle aussi.
 */
export function trackSounds(): void {
  if (installed || !('AudioBufferSourceNode' in window)) return;
  installed = true;

  const arrayBuffer = Reflect.get(Response.prototype, 'arrayBuffer');
  Response.prototype.arrayBuffer = async function (this: Response) {
    const bytes = await arrayBuffer.call(this);
    const name = AUDIO_FILE.exec(this.url)?.[1];
    if (name) loaded.set(bytes, decodeURIComponent(name));
    return bytes;
  };

  const decode = Reflect.get(BaseAudioContext.prototype, 'decodeAudioData');
  BaseAudioContext.prototype.decodeAudioData = function (
    this: BaseAudioContext,
    data: ArrayBuffer,
    success?: DecodeSuccessCallback | null,
    failure?: DecodeErrorCallback | null,
  ) {
    // Lu avant : le décodage détache les octets.
    const name = loaded.get(data);
    const tag = (buffer: AudioBuffer) => {
      if (name) names.set(buffer, name);
      return buffer;
    };
    const onSuccess = success ? (buffer: AudioBuffer) => success(tag(buffer)) : success;
    return decode.call(this, data, onSuccess, failure).then(tag);
  };

  const start = Reflect.get(AudioBufferSourceNode.prototype, 'start');
  AudioBufferSourceNode.prototype.start = function (this: AudioBufferSourceNode, ...args: Parameters<AudioBufferSourceNode['start']>) {
    const name = this.buffer ? names.get(this.buffer) : undefined;
    // Joué sur une durée nulle plutôt que jamais démarré : il se termine aussitôt (`ended`), et la page
    // qui le suit le libère au lieu de le garder branché.
    if ([...filters].some((filter) => filter(name))) start.call(this, 0, 0, 0);
    else start.apply(this, args);
  };
}

/** Empêche les sons choisis par `filter` de partir, tant que `signal` n'est pas interrompu. */
export function blockSounds(filter: SoundFilter, options: { signal: AbortSignal }): void {
  if (options.signal.aborted) return;
  trackSounds();
  filters.add(filter);
  options.signal.addEventListener('abort', () => filters.delete(filter), { once: true });
}
