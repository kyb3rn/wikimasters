import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Audio from '@/core/audio';

/** Web Audio imité : réponse d'un fichier son, décodage, source qui note ses démarrages. */
class FakeResponse {
  constructor(
    readonly url: string,
    private readonly bytes: ArrayBuffer,
  ) {}
  arrayBuffer(): Promise<ArrayBuffer> {
    return Promise.resolve(this.bytes);
  }
}

class FakeContext {
  decodeAudioData(_data: ArrayBuffer): Promise<object> {
    return Promise.resolve({});
  }
}

class FakeSource {
  buffer: object | null = null;
  readonly started: unknown[][] = [];
  start(...args: unknown[]): void {
    this.started.push(args);
  }
}

let audio: typeof Audio;

beforeEach(async () => {
  vi.stubGlobal('Response', FakeResponse);
  vi.stubGlobal('BaseAudioContext', FakeContext);
  vi.stubGlobal('AudioBufferSourceNode', FakeSource);
  vi.stubGlobal('window', { AudioBufferSourceNode: FakeSource });
  // Les prototypes sont remplacés une fois par module : un module neuf par test.
  vi.resetModules();
  audio = await import('@/core/audio');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function sound(file: string): Promise<FakeSource> {
  const bytes = await new FakeResponse(`https://www.wiki-masters.com/sounds/${file}?v=2`, new ArrayBuffer(4)).arrayBuffer();
  const source = new FakeSource();
  source.buffer = await new FakeContext().decodeAudioData(bytes);
  return source;
}

describe('sons de la page', () => {
  it('reconnaît un son à son fichier ; coupé tant qu’un filtre le demande', async () => {
    audio.trackSounds();
    const flip = await sound('card-flip.mp3');
    const rip = await sound('pack-rip.mp3');
    const names: (string | undefined)[] = [];
    const controller = new AbortController();
    audio.blockSounds(
      (name) => {
        names.push(name);
        return name === 'card-flip';
      },
      { signal: controller.signal },
    );

    flip.start(1);
    rip.start(1);
    controller.abort();
    flip.start(2);
    expect(names).toEqual(['card-flip', 'pack-rip']);
    expect(flip.started).toEqual([[0, 0, 0], [2]]);
    expect(rip.started).toEqual([[1]]);
  });

  it('un filtre en échec est journalisé, les autres décident', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const signal = new AbortController().signal;
    audio.blockSounds(() => {
      throw new Error('boum');
    }, { signal });
    audio.blockSounds(() => true, { signal });
    const flip = await sound('card-flip.mp3');
    expect(() => flip.start(1)).not.toThrow();
    expect(flip.started).toEqual([[0, 0, 0]]);
    expect(errors).toHaveBeenCalledOnce();
  });
});
