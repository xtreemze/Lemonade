import { spawnSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import manifest from "./manifest.json" with { type: "json" };

type Feature = (typeof manifest.features)[number];
type FormFactor = "desktop" | "mobile";
type MediaKind = "video" | "screenshot";

interface AudioCaptureState {
  readonly recorder: MediaRecorder;
  readonly chunks: Blob[];
  readonly stream: MediaStream;
  readonly mimeType: string;
}

interface AudioCaptureResult {
  readonly audioBase64: string;
  readonly audioMimeType: string;
  readonly audioTracks: number;
}

interface EncodedFrameChunk {
  readonly timestamp: number;
  readonly data: Uint8Array;
}

interface FrameCaptureState {
  readonly encoder: VideoEncoder;
  readonly chunks: EncodedFrameChunk[];
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly targetFrames: number;
  frameIndex: number;
  animationFrame: number | null;
  readonly captureFrame: () => void;
  readonly encoderError: () => string | null;
}

interface CanvasFrameCaptureResult {
  readonly videoBase64: string;
  readonly width: number;
  readonly height: number;
  readonly videoCodec: "vp8";
  readonly capturedFrames: number;
}

const artifactRoot = path.resolve("artifacts/e2e-media");

test.beforeEach(async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    const NativeAudioContext = window.AudioContext;
    const captureByContext = new WeakMap<BaseAudioContext, MediaStreamAudioDestinationNode>();
    const audioNodePrototype = AudioNode.prototype as unknown as {
      connect: (destination: unknown, ...args: unknown[]) => unknown;
    };
    const nativeConnect = audioNodePrototype.connect;

    audioNodePrototype.connect = function (
      this: AudioNode,
      destination: unknown,
      ...args: unknown[]
    ): unknown {
      const result = Reflect.apply(nativeConnect, this, [destination, ...args]);
      if (destination === this.context.destination) {
        const captureDestination = captureByContext.get(this.context);
        if (captureDestination !== undefined) {
          Reflect.apply(nativeConnect, this, [captureDestination]);
        }
      }
      return result;
    };

    class ShowcaseAudioContext extends NativeAudioContext {
      constructor(options?: AudioContextOptions) {
        super({ ...options, sampleRate: 48_000 });
        const captureDestination = this.createMediaStreamDestination();
        captureByContext.set(this, captureDestination);
        (
          window as typeof window & {
            __lemonadeShowcaseAudio?: Readonly<{
              stream: MediaStream;
              enable: () => Promise<void>;
            }>;
          }
        ).__lemonadeShowcaseAudio = Object.freeze({
          stream: captureDestination.stream,
          enable: () => this.resume(),
        });
      }
    }

    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      writable: true,
      value: ShowcaseAudioContext,
    });
  });
});

const getFeature = (id: string): Feature => {
  const feature = manifest.features.find((candidate) => candidate.id === id);
  if (feature === undefined) {
    throw new Error(`Unknown showcase feature: ${id}`);
  }
  return feature;
};

const getFormFactor = (testInfo: TestInfo): FormFactor => {
  if (testInfo.project.name === "Desktop Showcase") {
    return "desktop";
  }
  if (testInfo.project.name === "Mobile Showcase") {
    return "mobile";
  }
  throw new Error(`Unexpected showcase project: ${testInfo.project.name}`);
};

const getMediaKind = (feature: Feature): MediaKind => {
  if (feature.media === "video" || feature.media === "screenshot") {
    return feature.media;
  }
  throw new Error(`Unexpected showcase media kind for ${feature.id}: ${String(feature.media)}`);
};

const addBranding = async (page: Page, feature: Feature, formFactor: FormFactor): Promise<void> => {
  await page.evaluate(
    ({ title, form }) => {
      document.querySelector("#ci-showcase-brand")?.remove();

      const badge = document.createElement("div");
      badge.id = "ci-showcase-brand";
      badge.setAttribute("aria-hidden", "true");
      badge.style.cssText = [
        "position:fixed",
        "top:max(8px, env(safe-area-inset-top))",
        "left:50%",
        "transform:translateX(-50%)",
        "z-index:2147483647",
        "pointer-events:none",
        "display:flex",
        "gap:.55rem",
        "align-items:center",
        "padding:.38rem .62rem",
        "border:1px solid rgba(255,255,255,.38)",
        "border-radius:999px",
        "background:rgba(16,20,24,.72)",
        "backdrop-filter:blur(8px)",
        "color:white",
        "font:600 12px/1.2 system-ui,sans-serif",
        "letter-spacing:.01em",
        "box-shadow:0 2px 12px rgba(0,0,0,.18)",
        "max-width:calc(100vw - 24px)",
        "white-space:nowrap",
      ].join(";");

      const product = document.createElement("strong");
      product.textContent = "Lemonade";
      const separator = document.createElement("span");
      separator.textContent = "·";
      separator.style.opacity = "0.6";
      const featureTitle = document.createElement("span");
      featureTitle.textContent = title;
      const mode = document.createElement("span");
      mode.textContent = form === "mobile" ? "Mobile" : "Desktop";
      mode.style.opacity = "0.72";

      badge.append(product, separator, featureTitle, mode);
      document.body.appendChild(badge);
    },
    { title: feature.title, form: formFactor },
  );
};

const startAudioCapture = async (
  page: Page,
): Promise<{
  audioBitsPerSecond: number;
  audioMimeType: string;
  audioTracks: number;
}> => {
  const audioBitsPerSecond = 192_000;
  await page.waitForFunction(
    () =>
      (
        window as typeof window & {
          __lemonadeShowcaseAudio?: Readonly<{ stream: MediaStream }>;
        }
      ).__lemonadeShowcaseAudio !== undefined,
    undefined,
    { timeout: 5000 },
  );

  const result = await page.evaluate(
    async ({ audioBitrate }) => {
      const scope = window as typeof window & {
        __lemonadeShowcaseAudio?: Readonly<{
          stream: MediaStream;
          enable: () => Promise<void>;
        }>;
        __lemonadeShowcaseAudioCapture?: AudioCaptureState;
      };
      const audioBridge = scope.__lemonadeShowcaseAudio;
      if (audioBridge === undefined) {
        throw new Error("Showcase audio capture stream is unavailable.");
      }
      await audioBridge.enable();

      const audioTracks = audioBridge.stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error("Showcase audio capture stream is unavailable.");
      }

      const audioStream = new MediaStream(audioTracks);
      const audioMimeType =
        ["audio/webm;codecs=opus", "audio/webm"].find((candidate) =>
          MediaRecorder.isTypeSupported(candidate),
        ) ?? "";
      const options: MediaRecorderOptions = {
        audioBitsPerSecond: audioBitrate,
        ...(audioMimeType === "" ? {} : { mimeType: audioMimeType }),
      };
      const recorder = new MediaRecorder(audioStream, options);
      const chunks: Blob[] = [];
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      });

      scope.__lemonadeShowcaseAudioCapture = {
        recorder,
        chunks,
        stream: audioStream,
        mimeType: recorder.mimeType || audioMimeType || "audio/webm",
      };
      recorder.start();
      if (recorder.state !== "recording") {
        throw new Error("Showcase audio recorder failed to enter the recording state.");
      }

      return {
        audioMimeType: recorder.mimeType || audioMimeType || "audio/webm",
        audioTracks: audioStream.getAudioTracks().length,
      };
    },
    { audioBitrate: audioBitsPerSecond },
  );

  return { ...result, audioBitsPerSecond };
};

const stopAudioCapture = async (page: Page): Promise<AudioCaptureResult> =>
  page.evaluate(async () => {
    const scope = window as typeof window & {
      __lemonadeShowcaseAudioCapture?: AudioCaptureState;
    };
    const state = scope.__lemonadeShowcaseAudioCapture;
    if (state === undefined) {
      throw new Error("No active showcase audio capture exists.");
    }

    await new Promise<void>((resolve, reject) => {
      if (state.recorder.state === "inactive") {
        resolve();
        return;
      }
      state.recorder.addEventListener("stop", () => resolve(), { once: true });
      state.recorder.addEventListener(
        "error",
        () => reject(new Error("MediaRecorder failed while finalizing showcase audio.")),
        { once: true },
      );
      state.recorder.stop();
    });

    if (state.chunks.length === 0) {
      throw new Error("Showcase audio capture produced an empty stream.");
    }

    const blob = new Blob(state.chunks, { type: state.mimeType });
    const audioBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener(
        "load",
        () => {
          const value = reader.result;
          if (typeof value !== "string") {
            reject(new Error("Unable to serialize showcase audio capture."));
            return;
          }
          const comma = value.indexOf(",");
          resolve(comma === -1 ? value : value.slice(comma + 1));
        },
        { once: true },
      );
      reader.addEventListener(
        "error",
        () => reject(reader.error ?? new Error("FileReader failed.")),
        { once: true },
      );
      reader.readAsDataURL(blob);
    });

    const audioTracks = state.stream.getAudioTracks().length;
    for (const track of state.stream.getTracks()) {
      track.stop();
    }
    scope.__lemonadeShowcaseAudioCapture = undefined;

    return {
      audioBase64,
      audioMimeType: state.mimeType,
      audioTracks,
    };
  });

const startCanvasFrameCapture = async (
  page: Page,
  formFactor: FormFactor,
  durationSeconds: number,
): Promise<{
  videoBitsPerSecond: number;
  width: number;
  height: number;
  targetFrames: number;
}> => {
  const fps = manifest.capture.videoFps;
  const videoBitsPerSecond = formFactor === "desktop" ? 20_000_000 : 8_000_000;
  const targetFrames = Math.round(durationSeconds * fps);
  const expectedSize =
    formFactor === "desktop" ? { width: 1440, height: 900 } : { width: 390, height: 844 };

  const result = await page.evaluate(
    async ({ requestedFps, videoBitrate, requestedFrames, expectedWidth, expectedHeight }) => {
      const canvas = document.querySelector<HTMLCanvasElement>("#scene-canvas");
      if (
        canvas === null ||
        canvas.width !== expectedWidth ||
        canvas.height !== expectedHeight
      ) {
        throw new Error(
          "Showcase 3D canvas is not source-sized: " +
            String(canvas?.width ?? 0) +
            "×" +
            String(canvas?.height ?? 0) +
            "; expected " +
            String(expectedWidth) +
            "×" +
            String(expectedHeight) +
            ".",
        );
      }
      if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") {
        throw new Error("Showcase capture requires Chromium WebCodecs VideoEncoder support.");
      }

      const config: VideoEncoderConfig = {
        codec: "vp8",
        width: canvas.width,
        height: canvas.height,
        bitrate: videoBitrate,
        framerate: requestedFps,
        latencyMode: "quality",
      };
      const support = await VideoEncoder.isConfigSupported(config);
      if (!support.supported) {
        throw new Error("Chromium does not support the VP8 WebCodecs showcase configuration.");
      }

      const chunks: EncodedFrameChunk[] = [];
      let encoderFailure: string | null = null;
      const encoder = new VideoEncoder({
        output: (chunk) => {
          const data = new Uint8Array(chunk.byteLength);
          chunk.copyTo(data);
          chunks.push({ timestamp: chunk.timestamp, data });
        },
        error: (error) => {
          encoderFailure = error.message;
        },
      });
      encoder.configure(support.config ?? config);

      const scope = window as typeof window & {
        __lemonadeShowcaseFrameCapture?: FrameCaptureState;
      };
      let state: FrameCaptureState;
      const frameDurationUs = 1_000_000 / requestedFps;
      const captureFrame = (): void => {
        if (encoderFailure !== null) {
          throw new Error("Showcase VideoEncoder failed: " + encoderFailure);
        }
        if (state.frameIndex >= state.targetFrames) {
          state.animationFrame = null;
          return;
        }

        const frame = new VideoFrame(canvas, {
          timestamp: Math.round(state.frameIndex * frameDurationUs),
          duration: Math.round(frameDurationUs),
        });
        encoder.encode(frame, {
          keyFrame: state.frameIndex % requestedFps === 0,
        });
        frame.close();
        state.frameIndex += 1;

        if (state.frameIndex < state.targetFrames) {
          state.animationFrame = requestAnimationFrame(captureFrame);
        } else {
          state.animationFrame = null;
        }
      };

      state = {
        encoder,
        chunks,
        width: canvas.width,
        height: canvas.height,
        fps: requestedFps,
        targetFrames: requestedFrames,
        frameIndex: 0,
        animationFrame: null,
        captureFrame,
        encoderError: () => encoderFailure,
      };
      scope.__lemonadeShowcaseFrameCapture = state;

      captureFrame();

      return {
        width: state.width,
        height: state.height,
      };
    },
    {
      requestedFps: fps,
      videoBitrate: videoBitsPerSecond,
      requestedFrames: targetFrames,
      expectedWidth: expectedSize.width,
      expectedHeight: expectedSize.height,
    },
  );

  return { ...result, videoBitsPerSecond, targetFrames };
};

const flushCanvasFrameCapture = async (page: Page): Promise<number> =>
  page.evaluate(async () => {
    const state = (
      window as typeof window & {
        __lemonadeShowcaseFrameCapture?: FrameCaptureState;
      }
    ).__lemonadeShowcaseFrameCapture;
    if (state === undefined) {
      throw new Error("No active showcase frame capture exists.");
    }
    await state.encoder.flush();
    const error = state.encoderError();
    if (error !== null) {
      throw new Error("Showcase VideoEncoder failed: " + error);
    }
    return state.frameIndex;
  });

const advanceCanvasFrameCapture = async (
  page: Page,
  targetFrames: number,
  fps: number,
): Promise<void> => {
  for (let frameIndex = 1; frameIndex < targetFrames; frameIndex += 1) {
    const previousMs = Math.round(((frameIndex - 1) * 1000) / fps);
    const nextMs = Math.round((frameIndex * 1000) / fps);
    await page.clock.runFor(nextMs - previousMs);
    if (frameIndex % 30 === 0) {
      await flushCanvasFrameCapture(page);
    }
  }

  const capturedFrames = await flushCanvasFrameCapture(page);
  if (capturedFrames !== targetFrames) {
    throw new Error(
      "Showcase produced " +
        String(capturedFrames) +
        " browser-rendered frames; expected exactly " +
        String(targetFrames) +
        ".",
    );
  }
};

const stopCanvasFrameCapture = async (page: Page): Promise<CanvasFrameCaptureResult> =>
  page.evaluate(async () => {
    const scope = window as typeof window & {
      __lemonadeShowcaseFrameCapture?: FrameCaptureState;
    };
    const state = scope.__lemonadeShowcaseFrameCapture;
    if (state === undefined) {
      throw new Error("No active showcase frame capture exists.");
    }

    if (state.animationFrame !== null) {
      cancelAnimationFrame(state.animationFrame);
      state.animationFrame = null;
    }
    await state.encoder.flush();
    const encoderFailure = state.encoderError();
    if (encoderFailure !== null) {
      throw new Error("Showcase VideoEncoder failed: " + encoderFailure);
    }
    state.encoder.close();

    const chunks = [...state.chunks].sort((left, right) => left.timestamp - right.timestamp);
    if (chunks.length !== state.targetFrames) {
      throw new Error(
        "Showcase encoded " +
          String(chunks.length) +
          " VP8 frames; expected exactly " +
          String(state.targetFrames) +
          ".",
      );
    }

    const byteLength =
      32 + chunks.reduce((total, chunk) => total + 12 + chunk.data.byteLength, 0);
    const ivf = new Uint8Array(byteLength);
    const view = new DataView(ivf.buffer);
    ivf.set([0x44, 0x4b, 0x49, 0x46], 0);
    view.setUint16(4, 0, true);
    view.setUint16(6, 32, true);
    ivf.set([0x56, 0x50, 0x38, 0x30], 8);
    view.setUint16(12, state.width, true);
    view.setUint16(14, state.height, true);
    view.setUint32(16, state.fps, true);
    view.setUint32(20, 1, true);
    view.setUint32(24, chunks.length, true);
    view.setUint32(28, 0, true);

    let offset = 32;
    chunks.forEach((chunk, index) => {
      view.setUint32(offset, chunk.data.byteLength, true);
      const timestamp = BigInt(index);
      view.setUint32(offset + 4, Number(timestamp & 0xffff_ffffn), true);
      view.setUint32(offset + 8, Number(timestamp >> 32n), true);
      offset += 12;
      ivf.set(chunk.data, offset);
      offset += chunk.data.byteLength;
    });

    const videoBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener(
        "load",
        () => {
          const value = reader.result;
          if (typeof value !== "string") {
            reject(new Error("Unable to serialize showcase video capture."));
            return;
          }
          const comma = value.indexOf(",");
          resolve(comma === -1 ? value : value.slice(comma + 1));
        },
        { once: true },
      );
      reader.addEventListener(
        "error",
        () => reject(reader.error ?? new Error("FileReader failed.")),
        { once: true },
      );
      reader.readAsDataURL(new Blob([ivf], { type: "video/x-ivf" }));
    });

    scope.__lemonadeShowcaseFrameCapture = undefined;
    return {
      videoBase64,
      width: state.width,
      height: state.height,
      videoCodec: "vp8" as const,
      capturedFrames: chunks.length,
    };
  });

const remuxIvfToWebm = async (ivfPath: string, webmPath: string): Promise<void> => {
  const result = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      ivfPath,
      "-map",
      "0:v:0",
      "-c:v",
      "copy",
      webmPath,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error("FFmpeg failed to remux native VP8 showcase frames: " + result.stderr);
  }
  await rm(ivfPath, { force: true });
};

const recordFeature = async (
  page: Page,
  testInfo: TestInfo,
  feature: Feature,
  demonstrate: () => Promise<void>,
): Promise<void> => {
  const formFactor = getFormFactor(testInfo);
  const media = getMediaKind(feature);
  const viewport = page.viewportSize();
  if (viewport === null) {
    throw new Error("Showcase viewport must be explicit.");
  }

  const rawDir = path.join(artifactRoot, "raw", formFactor);
  await mkdir(rawDir, { recursive: true });

  if (media === "screenshot") {
    await addBranding(page, feature, formFactor);
    await demonstrate();
    await page.waitForTimeout(200);
    await page.screenshot({
      path: path.join(rawDir, `${feature.id}.png`),
      fullPage: false,
      animations: "disabled",
    });

    await writeFile(
      path.join(rawDir, `${feature.id}.json`),
      `${JSON.stringify(
        {
          id: feature.id,
          title: feature.title,
          description: feature.description,
          formFactor,
          media,
          viewport,
          reelHoldSeconds: feature.durationSeconds,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await page.close();
    return;
  }

  const targetMs = Math.round(feature.durationSeconds * 1000);
  const audioInfo = await startAudioCapture(page);
  const audioStartedAt = Date.now();
  const pageNow = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(pageNow);
  await demonstrate();

  const captureInfo = await startCanvasFrameCapture(page, formFactor, feature.durationSeconds);
  await advanceCanvasFrameCapture(page, captureInfo.targetFrames, manifest.capture.videoFps);
  const capture = await stopCanvasFrameCapture(page);

  const audioElapsedMs = Date.now() - audioStartedAt;
  if (audioElapsedMs < targetMs) {
    await page.waitForTimeout(targetMs - audioElapsedMs);
  }
  const audioCapture = await stopAudioCapture(page);

  const ivfPath = path.join(rawDir, feature.id + ".ivf");
  const webmPath = path.join(rawDir, feature.id + ".webm");
  await writeFile(ivfPath, Buffer.from(capture.videoBase64, "base64"));
  await remuxIvfToWebm(ivfPath, webmPath);
  await writeFile(
    path.join(rawDir, feature.id + ".audio.webm"),
    Buffer.from(audioCapture.audioBase64, "base64"),
  );
  await writeFile(
    path.join(rawDir, `${feature.id}.json`),
    `${JSON.stringify(
      {
        id: feature.id,
        title: feature.title,
        description: feature.description,
        formFactor,
        media,
        viewport,
        durationSeconds: feature.durationSeconds,
        requestedFps: manifest.capture.videoFps,
        videoBitsPerSecond: captureInfo.videoBitsPerSecond,
        audioBitsPerSecond: audioInfo.audioBitsPerSecond,
        frameProduction: "deterministic-webcodecs-vp8",
        capturedFrames: capture.capturedFrames,
        source: {
          width: capture.width,
          height: capture.height,
          videoCodec: capture.videoCodec,
          videoMimeType: "video/webm;codecs=vp8",
          audioMimeType: audioCapture.audioMimeType,
          audioTracks: audioCapture.audioTracks,
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await page.close();
};

const openPlanning = async (page: Page, fast = false): Promise<void> => {
  if (fast) {
    await page.emulateMedia({ reducedMotion: "reduce" });
  }
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("main")).toHaveAttribute("data-view", "planning", {
    timeout: 10_000,
  });
  await expect(page.getByRole("slider")).toHaveCount(3);
};

const openReport = async (page: Page): Promise<void> => {
  await openPlanning(page, true);
  await page.getByRole("button", { name: "Sell for the day" }).click();
  await expect(page.getByRole("main")).toHaveAttribute("data-view", "report", {
    timeout: 7500,
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
};

const openHistory = async (page: Page): Promise<void> => {
  await openReport(page);
  await page.getByRole("button", { name: "Review sales history" }).click();
  await expect(page.getByRole("main")).toHaveAttribute("data-view", "history");
  await expect(page.getByRole("region", { name: "Sales history" })).toBeVisible();
};

test("01-weather-forecast", async ({ page }, testInfo) => {
  const feature = getFeature("01-weather-forecast");
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("main")).toHaveAttribute("data-view", "forecast");

  await page.evaluate(() => {
    window.localStorage.setItem("LEMONADE_DEV_SCENE_LAUNCHER", "1");
  });
  await page.reload({ waitUntil: "domcontentloaded" });

  await recordFeature(page, testInfo, feature, async () => {
    const forecastPreset = page.getByRole("button", { name: /Sunny Forecast/u });
    await expect(forecastPreset).toBeVisible();
    await forecastPreset.click();

    await Promise.all([
      expect(page.locator("#scene-canvas")).toHaveAttribute("data-stand-state", "closed", {
        timeout: 4000,
      }),
      expect(page.locator("#scene-canvas")).toHaveAttribute("data-scene-shot", "forecast", {
        timeout: 4000,
      }),
    ]);
  });
});

test("02-three-decision-plan", async ({ page }, testInfo) => {
  const feature = getFeature("02-three-decision-plan");
  await openPlanning(page);
  const glasses = page.getByRole("slider", { name: /Glasses/u });
  const startValue = await glasses.inputValue();

  await recordFeature(page, testInfo, feature, async () => {
    if (getFormFactor(testInfo) === "desktop") {
      await glasses.focus();
      await page.keyboard.press("ArrowRight");
      await expect(glasses).not.toHaveValue(startValue);
      await page.keyboard.press("ArrowLeft");
      await expect(glasses).toHaveValue(startValue);
      await page.getByRole("button", { name: "Sell for the day" }).hover();
      await page.mouse.move(2, 2);
      return;
    }

    const box = await glasses.boundingBox();
    if (box === null) {
      throw new Error("Expected visible glasses slider.");
    }
    await page.touchscreen.tap(box.x + box.width * 0.72, box.y + box.height / 2);
    await expect(glasses).not.toHaveValue(startValue);
    await glasses.fill(startValue);
    await expect(glasses).toHaveValue(startValue);
  });
});

test("03-lemonsville-simulation", async ({ page }, testInfo) => {
  const feature = getFeature("03-lemonsville-simulation");
  await openPlanning(page);

  await recordFeature(page, testInfo, feature, async () => {
    await page.getByRole("button", { name: "Sell for the day" }).click();
    await expect(page.getByRole("main")).toHaveAttribute("data-view", "simulation");
    await expect(page.locator("#scene-canvas")).toHaveAttribute("data-stand-state", "open");
    await expect(page.locator("#scene-equivalent")).toContainText("glasses prepared");
    await expect(page.locator(".stand-stage")).toBeVisible();
  });
});

test("04-day-report", async ({ page }, testInfo) => {
  const feature = getFeature("04-day-report");
  await openReport(page);
  await expect(page.locator(".results-grid > div")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "Review sales history" })).toBeVisible();

  await recordFeature(page, testInfo, feature, async () => {
    if (getFormFactor(testInfo) === "desktop") {
      await page.locator(".results-grid > div").first().hover();
      await page.mouse.move(2, 2);
    }
  });
});

test("05-sales-history", async ({ page }, testInfo) => {
  const feature = getFeature("05-sales-history");
  await openHistory(page);
  const history = page.getByRole("region", { name: "Sales history" });

  await recordFeature(page, testInfo, feature, async () => {
    if (getFormFactor(testInfo) === "desktop") {
      await history.hover();
      await page.mouse.move(2, 2);
      return;
    }
    const box = await history.boundingBox();
    if (box !== null) {
      await page.touchscreen.tap(box.x + box.width / 2, box.y + Math.min(48, box.height / 2));
    }
  });
});
