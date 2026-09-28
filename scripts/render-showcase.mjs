import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const artifactRoot = path.resolve("artifacts/e2e-media");
const sourceManifestPath = path.resolve("e2e/showcase/manifest.json");
const manifest = JSON.parse(await readFile(sourceManifestPath, "utf8"));

const run = (args) => {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", ...args], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed with status ${String(result.status)}: ${args.join(" ")}`);
  }
};

const formFactors = {
  desktop: {
    reelName: "lemonade-desktop-highlight.mp4",
    animatedReelName: "lemonade-desktop-highlight.webp",
  },
  mobile: {
    reelName: "lemonade-mobile-highlight.mp4",
    animatedReelName: "lemonade-mobile-highlight.webp",
  },
};

const readCaptureProfile = async (rawDir, formFactor) => {
  const dynamicMetadata = [];
  for (const feature of manifest.features.filter((candidate) => candidate.media === "video")) {
    const metadata = JSON.parse(await readFile(path.join(rawDir, `${feature.id}.json`), "utf8"));
    const profile = {
      fps: Number(metadata.source?.fps ?? metadata.requestedFps),
      width: Number(metadata.source?.width),
      height: Number(metadata.source?.height),
    };
    if (
      !Number.isFinite(profile.fps) ||
      profile.fps <= 0 ||
      !Number.isInteger(profile.width) ||
      profile.width <= 0 ||
      !Number.isInteger(profile.height) ||
      profile.height <= 0
    ) {
      throw new Error(`Invalid raw capture profile for ${formFactor}/${feature.id}.`);
    }
    dynamicMetadata.push({ id: feature.id, ...profile });
  }

  const first = dynamicMetadata[0];
  if (first === undefined) {
    throw new Error(`No dynamic source media exists for ${formFactor}.`);
  }
  for (const profile of dynamicMetadata.slice(1)) {
    if (profile.fps !== first.fps || profile.width !== first.width || profile.height !== first.height) {
      throw new Error(
        `${formFactor} raw captures disagree on source profile: ${JSON.stringify(dynamicMetadata)}`,
      );
    }
  }

  for (const feature of manifest.features) {
    const metadata = JSON.parse(await readFile(path.join(rawDir, `${feature.id}.json`), "utf8"));
    if (metadata.viewport?.width !== first.width || metadata.viewport?.height !== first.height) {
      throw new Error(
        `${formFactor}/${feature.id} viewport ${String(metadata.viewport?.width)}×${String(
          metadata.viewport?.height,
        )} does not match source ${String(first.width)}×${String(first.height)}.`,
      );
    }
  }

  return { fps: first.fps, width: first.width, height: first.height };
};

const encodeDynamicClip = (videoInput, audioInput, output, duration) => {
  run([
    "-y",
    "-i",
    videoInput,
    "-i",
    audioInput,
    "-t",
    String(duration),
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-fps_mode",
    "passthrough",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "17",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    output,
  ]);
};

const encodeStaticClip = (input, output, fps, duration) => {
  run([
    "-y",
    "-loop",
    "1",
    "-framerate",
    String(fps),
    "-i",
    input,
    "-f",
    "lavfi",
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=48000",
    "-t",
    String(duration),
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-fps_mode",
    "passthrough",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "17",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    output,
  ]);
};

const encodeAnimatedWebp = (input, output) => {
  run([
    "-y",
    "-i",
    input,
    "-an",
    "-fps_mode",
    "passthrough",
    "-c:v",
    "libwebp_anim",
    "-lossless",
    "0",
    "-compression_level",
    "6",
    "-q:v",
    "80",
    "-loop",
    "0",
    output,
  ]);
};

await rm(path.join(artifactRoot, "videos"), { recursive: true, force: true });
await rm(path.join(artifactRoot, "graphics"), { recursive: true, force: true });
await rm(path.join(artifactRoot, "reels"), { recursive: true, force: true });
await rm(path.join(artifactRoot, ".render"), { recursive: true, force: true });
await mkdir(artifactRoot, { recursive: true });
await writeFile(
  path.join(artifactRoot, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

const captureProfiles = {};

for (const [formFactor, format] of Object.entries(formFactors)) {
  const rawDir = path.join(artifactRoot, "raw", formFactor);
  const captureProfile = await readCaptureProfile(rawDir, formFactor);
  captureProfiles[formFactor] = captureProfile;
  const videoDir = path.join(artifactRoot, "videos", formFactor);
  const graphicDir = path.join(artifactRoot, "graphics", formFactor);
  const clipDir = path.join(artifactRoot, ".render", formFactor);
  const reelDir = path.join(artifactRoot, "reels");

  await mkdir(videoDir, { recursive: true });
  await mkdir(graphicDir, { recursive: true });
  await mkdir(clipDir, { recursive: true });
  await mkdir(reelDir, { recursive: true });

  const clips = [];
  for (const feature of manifest.features) {
    const clip = path.join(clipDir, `${feature.id}.mp4`);
    const duration = Number(feature.durationSeconds);

    if (feature.media === "video") {
      const videoInput = path.join(rawDir, `${feature.id}.webm`);
      const audioInput = path.join(rawDir, `${feature.id}.audio.webm`);
      const video = path.join(videoDir, `${feature.id}.mp4`);
      const graphic = path.join(graphicDir, `${feature.id}.webp`);

      encodeDynamicClip(videoInput, audioInput, video, duration);
      await copyFile(video, clip);
      encodeAnimatedWebp(video, graphic);
    } else if (feature.media === "screenshot") {
      const input = path.join(rawDir, `${feature.id}.png`);
      const graphic = path.join(graphicDir, `${feature.id}.png`);
      await copyFile(input, graphic);
      encodeStaticClip(input, clip, captureProfile.fps, duration);
    } else {
      throw new Error(`Unknown showcase media type: ${String(feature.media)}`);
    }

    clips.push(clip);
  }

  const concatInputs = clips.flatMap((clip) => ["-i", clip]);
  const concatPads = clips.map((_, index) => `[${String(index)}:v][${String(index)}:a]`).join("");
  const reel = path.join(reelDir, format.reelName);
  run([
    "-y",
    ...concatInputs,
    "-filter_complex",
    `${concatPads}concat=n=${String(clips.length)}:v=1:a=1[outv][outa]`,
    "-map",
    "[outv]",
    "-map",
    "[outa]",
    "-fps_mode",
    "passthrough",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "16",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    reel,
  ]);

  encodeAnimatedWebp(reel, path.join(reelDir, format.animatedReelName));
}

const imageWidth = { desktop: 960, mobile: 390 };
const mediaExtension = (feature) => (feature.media === "video" ? "webp" : "png");
const renderSection = (formFactor, heading) => {
  const width = imageWidth[formFactor];
  const captureProfile = captureProfiles[formFactor];
  if (captureProfile === undefined) {
    throw new Error(`Missing capture profile for ${formFactor}.`);
  }
  const animatedReelName =
    formFactor === "desktop" ? "lemonade-desktop-highlight.webp" : "lemonade-mobile-highlight.webp";
  const reelName =
    formFactor === "desktop" ? "lemonade-desktop-highlight.mp4" : "lemonade-mobile-highlight.mp4";
  const lines = [
    `### ${heading}`,
    "",
    `<img src="${manifest.stableBaseUrl}/reels/${animatedReelName}" alt="Lemonade ${heading.toLowerCase()} visual highlight reel" width="${String(width)}" />`,
    "",
  ];

  for (const feature of manifest.features) {
    const extension = mediaExtension(feature);
    lines.push(
      `#### ${feature.title}`,
      "",
      feature.description,
      "",
      `<img src="${manifest.stableBaseUrl}/${formFactor}/${feature.id}.${extension}" alt="${feature.alt}" width="${String(width)}" />`,
      "",
    );
    if (feature.media === "video") {
      lines.push(
        `[Watch the source-resolution ${String(captureProfile.fps)} fps scene capture](${manifest.stableBaseUrl}/videos/${formFactor}/${feature.id}.mp4)`,
        "",
      );
    }
  }

  lines.push(
    `[Watch the source-resolution ${String(captureProfile.fps)} fps ${heading.toLowerCase()} highlight reel](${manifest.stableBaseUrl}/reels/${reelName})`,
    "",
  );
  return lines;
};

const readme = [
  "## Product in motion",
  "",
  "The 3D scenes are rendered from the real WebGL canvas at the highest source frame rate certified by the capture probe, with the application’s procedural audio. Every later video and animated-image encoding preserves that source cadence and source dimensions. Static interface and report states use lossless screenshots rather than video frames.",
  "",
  ...renderSection("desktop", "Desktop"),
  ...renderSection("mobile", "Mobile"),
].join("\n");

await writeFile(path.join(artifactRoot, "README-showcase.md"), `${readme}\n`, "utf8");
await rm(path.join(artifactRoot, ".render"), { recursive: true, force: true });
