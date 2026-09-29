let silentUntil = 0;
let patched = false;

/**
 * Coupe les sons Web Audio (`AudioBufferSourceNode.start`) lancés pendant les `ms` qui suivent.
 * Un son coupé n'est jamais démarré : son nœud est simplement abandonné.
 */
export function muteSounds(ms: number): void {
  patch();
  silentUntil = Math.max(silentUntil, performance.now() + ms);
}

function patch(): void {
  if (patched || !('AudioBufferSourceNode' in window)) return;
  patched = true;
  const prototype = AudioBufferSourceNode.prototype;
  const start = Reflect.get(prototype, 'start');
  prototype.start = function (this: AudioBufferSourceNode, ...args: Parameters<AudioBufferSourceNode['start']>) {
    if (performance.now() < silentUntil) return;
    start.apply(this, args);
  };
}
