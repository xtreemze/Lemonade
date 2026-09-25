import type {
  AudioCue,
  AudioEnvironmentFrame,
  ProceduralAudioEngine,
} from "@lemonade/audio/contracts";

const SILENT_ENVIRONMENT = Object.freeze({ windIntensity: 0, precipitation: 0 });

export const createLazyProceduralAudioEngine = (): ProceduralAudioEngine => {
  let engine: ProceduralAudioEngine | null = null;
  let enginePromise: Promise<ProceduralAudioEngine | null> | null = null;
  let environmentFrame: AudioEnvironmentFrame = SILENT_ENVIRONMENT;
  let muted = false;
  let disposed = false;

  const load = (): Promise<ProceduralAudioEngine | null> => {
    if (disposed) {
      return Promise.resolve(null);
    }
    if (engine !== null) {
      return Promise.resolve(engine);
    }
    if (enginePromise === null) {
      enginePromise = import("@lemonade/audio").then(({ createProceduralAudioEngine }) => {
        const created = createProceduralAudioEngine();
        if (disposed) {
          void created.dispose();
          return null;
        }
        engine = created;
        created.setMuted(muted);
        created.setEnvironmentFrame(environmentFrame);
        return created;
      });
    }
    return enginePromise;
  };

  return Object.freeze({
    async enable(): Promise<boolean> {
      const active = await load();
      return active === null ? false : active.enable();
    },
    play(cue: AudioCue): void {
      if (engine !== null) {
        engine.play(cue);
        return;
      }
      void load().then((active) => active?.play(cue));
    },
    setEnvironmentFrame(frame: AudioEnvironmentFrame): void {
      environmentFrame = Object.freeze({
        windIntensity: frame.windIntensity,
        precipitation: frame.precipitation,
      });
      engine?.setEnvironmentFrame(environmentFrame);
    },
    setMuted(value: boolean): void {
      muted = value;
      engine?.setMuted(value);
    },
    async suspend(): Promise<void> {
      await engine?.suspend();
    },
    async resume(): Promise<void> {
      await engine?.resume();
    },
    async dispose(): Promise<void> {
      disposed = true;
      if (engine !== null) {
        await engine.dispose();
        engine = null;
        return;
      }
      if (enginePromise !== null) {
        const pending = await enginePromise;
        await pending?.dispose();
      }
    },
  });
};
