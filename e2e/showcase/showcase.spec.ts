import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import manifest from "./manifest.json" with { type: "json" };

type Feature = (typeof manifest.features)[number];
type FormFactor = "desktop" | "mobile";
type MediaKind = "video" | "screenshot";

interface CanvasCaptureState {
  readonly videoRecorder: MediaRecorder;
  readonly videoChunks: Blob[];
  readonly videoStream: MediaStream;
  readonly audioRecorder: MediaRecorder;
  readonly audioChunks: Blob[];
  readonly audioStream: MediaStream;
  readonly width: number;
  readonly height: number;
  readonly videoMimeType: string;
  readonly audioMimeType: string;
}

interface CanvasCaptureResult {
  readonly videoBase64: string;
  readonly audioBase64: string;
  readonly width: number;
  readonly height: number;
  readonly videoMimeType: string;
  readonly audioMimeType: string;
  readonly audioTracks: number;
}

const artifactRoot = path.resolve("artifacts/e2e-media");

test.beforeEach(async ({ page }) => {
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

const startCanvasCapture = async (
  page: Page,
  formFactor: FormFactor,
): Promise<{
  width: number;
  height: number;
  videoMimeType: string;
  audioMimeType: string;
  videoBitsPerSecond: number;
  audioBitsPerSecond: number;
  audioTracks: number;
}> => {
  const fps = manifest.capture.videoFps;
  const videoBitsPerSecond = formFactor === "desktop" ? 20_000_000 : 8_000_000;
  const audioBitsPerSecond = 192_000;
  const result = await page.evaluate(
    async ({ requestedFps, videoBitrate, audioBitrate }) => {
      const canvas = document.querySelector<HTMLCanvasElement>("#scene-canvas");
      if (canvas === null || canvas.width <= 0 || canvas.height <= 0) {
        throw new Error("Showcase 3D canvas is unavailable or has no render surface.");
      }

      const audioBridge = (
        window as typeof window & {
          __lemonadeShowcaseAudio?: Readonly<{
            stream: MediaStream;
            enable: () => Promise<void>;
          }>;
        }
      ).__lemonadeShowcaseAudio;
      if (audioBridge === undefined) {
        throw new Error("Showcase audio capture stream is unavailable.");
      }
      await audioBridge.enable();

      const audioTracks = audioBridge.stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error("Showcase audio capture stream is unavailable.");
      }

      const videoStream = canvas.captureStream(requestedFps);
      const audioStream = new MediaStream(audioTracks);
      const videoMimeType =
        ["video/webm;codecs=vp8", "video/webm;codecs=vp9", "video/webm"].find((candidate) =>
          MediaRecorder.isTypeSupported(candidate),
        ) ?? "";
      const audioMimeType =
        ["audio/webm;codecs=opus", "audio/webm"].find((candidate) =>
          MediaRecorder.isTypeSupported(candidate),
        ) ?? "";

      const videoRecorderOptions: MediaRecorderOptions = {
        videoBitsPerSecond: videoBitrate,
      };
      const audioRecorderOptions: MediaRecorderOptions = {
        audioBitsPerSecond: audioBitrate,
      };
      const videoRecorder =
        videoMimeType === ""
          ? new MediaRecorder(videoStream, videoRecorderOptions)
          : new MediaRecorder(videoStream, { ...videoRecorderOptions, mimeType: videoMimeType });
      const audioRecorder =
        audioMimeType === ""
          ? new MediaRecorder(audioStream, audioRecorderOptions)
          : new MediaRecorder(audioStream, { ...audioRecorderOptions, mimeType: audioMimeType });

      const videoChunks: Blob[] = [];
      const audioChunks: Blob[] = [];
      videoRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          videoChunks.push(event.data);
        }
      });
      audioRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      });

      const state: CanvasCaptureState = {
        videoRecorder,
        videoChunks,
        videoStream,
        audioRecorder,
        audioChunks,
        audioStream,
        width: canvas.width,
        height: canvas.height,
        videoMimeType: videoRecorder.mimeType || videoMimeType || "video/webm",
        audioMimeType: audioRecorder.mimeType || audioMimeType || "audio/webm",
      };
      (
        window as typeof window & {
          __lemonadeShowcaseCapture: CanvasCaptureState | undefined;
        }
      ).__lemonadeShowcaseCapture = state;

      audioRecorder.start();
      videoRecorder.start();
      if (audioRecorder.state !== "recording" || videoRecorder.state !== "recording") {
        throw new Error("Showcase media recorders failed to enter the recording state.");
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      return {
        width: state.width,
        height: state.height,
        videoMimeType: state.videoMimeType,
        audioMimeType: state.audioMimeType,
        audioTracks: audioStream.getAudioTracks().length,
      };
    },
    {
      requestedFps: fps,
      videoBitrate: videoBitsPerSecond,
      audioBitrate: audioBitsPerSecond,
    },
  );

  return { ...result, videoBitsPerSecond, audioBitsPerSecond };
};

const stopCanvasCapture = async (page: Page): Promise<CanvasCaptureResult> =>
  page.evaluate(async () => {
    const scope = window as typeof window & {
      __lemonadeShowcaseCapture: CanvasCaptureState | undefined;
    };
    const state = scope.__lemonadeShowcaseCapture;
    if (state === undefined) {
      throw new Error("No active showcase capture exists.");
    }

    const stopRecorder = (recorder: MediaRecorder): Promise<void> =>
      new Promise((resolve, reject) => {
        if (recorder.state === "inactive") {
          resolve();
          return;
        }
        recorder.addEventListener("stop", () => resolve(), { once: true });
        recorder.addEventListener(
          "error",
          () => reject(new Error("MediaRecorder failed while finalizing showcase capture.")),
          { once: true },
        );
        recorder.stop();
      });

    await Promise.all([stopRecorder(state.videoRecorder), stopRecorder(state.audioRecorder)]);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    if (state.videoChunks.length === 0 || state.audioChunks.length === 0) {
      throw new Error("Showcase capture produced an empty media stream.");
    }

    const blobToBase64 = (blob: Blob): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener(
          "load",
          () => {
            const value = reader.result;
            if (typeof value !== "string") {
              reject(new Error("Unable to serialize showcase capture."));
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

    const videoBlob = new Blob(state.videoChunks, { type: state.videoMimeType });
    const audioBlob = new Blob(state.audioChunks, { type: state.audioMimeType });
    const [videoBase64, audioBase64] = await Promise.all([
      blobToBase64(videoBlob),
      blobToBase64(audioBlob),
    ]);

    const audioTracks = state.audioStream.getAudioTracks().length;
    for (const track of state.videoStream.getTracks()) {
      track.stop();
    }
    for (const track of state.audioStream.getTracks()) {
      track.stop();
    }

    scope.__lemonadeShowcaseCapture = undefined;
    return {
      videoBase64,
      audioBase64,
      width: state.width,
      height: state.height,
      videoMimeType: state.videoMimeType,
      audioMimeType: state.audioMimeType,
      audioTracks,
    };
  });

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
  const captureInfo = await startCanvasCapture(page, formFactor);
  const startedAt = Date.now();
  await demonstrate();
  const elapsedMs = Date.now() - startedAt;
  if (elapsedMs < targetMs) {
    await page.waitForTimeout(targetMs - elapsedMs);
  }
  const capture = await stopCanvasCapture(page);

  await writeFile(
    path.join(rawDir, `${feature.id}.webm`),
    Buffer.from(capture.videoBase64, "base64"),
  );
  await writeFile(
    path.join(rawDir, `${feature.id}.audio.webm`),
    Buffer.from(capture.audioBase64, "base64"),
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
        audioBitsPerSecond: captureInfo.audioBitsPerSecond,
        source: {
          width: capture.width,
          height: capture.height,
          videoMimeType: capture.videoMimeType,
          audioMimeType: capture.audioMimeType,
          audioTracks: capture.audioTracks,
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
