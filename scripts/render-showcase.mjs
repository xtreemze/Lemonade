import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

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
    width: 1440,
    height: 900,
    graphicWidth: 960,
    reelName: "lemonade-desktop-highlight.mp4",
    animatedReelName: "lemonade-desktop-highlight.webp",
  },
  mobile: {
    width: 390,
    height: 844,
    graphicWidth: 390,
    reelName: "lemonade-mobile-highlight.mp4",
    animatedReelName: "lemonade-mobile-highlight.webp",
  },
};

const encodeH264 = (inputArgs, output, format, duration) => {
  run([
    "-y",
    ...inputArgs,
    "-t",
    String(duration),
    "-vf",
    `fps=${String(manifest.capture.videoFps)},scale=${String(format.width)}:${String(
      format.height,
    )}:flags=lanczos,setsar=1`,
    "-an",
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
    "-movflags",
    "+faststart",
    output,
  ]);
};

const encodeAnimatedWebp = (input, output, width) => {
  run([
    "-y",
    "-i",
    input,
    "-vf",
    `fps=${String(manifest.capture.animatedGraphicFps)},scale=${String(
      width,
    )}:-2:flags=lanczos`,
    "-an",
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

for (const [formFactor, format] of Object.entries(formFactors)) {
  const rawDir = path.join(artifactRoot, "raw", formFactor);
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
      const input = path.join(rawDir, `${feature.id}.webm`);
      const video = path.join(videoDir, `${feature.id}.mp4`);
      const graphic = path.join(graphicDir, `${feature.id}.webp`);

      encodeH264(["-i", input], video, format, duration);
      await copyFile(video, clip);
      encodeAnimatedWebp(video, graphic, format.graphicWidth);
    } else if (feature.media === "screenshot") {
      const input = path.join(rawDir, `${feature.id}.png`);
      const graphic = path.join(graphicDir, `${feature.id}.png`);
      await copyFile(input, graphic);
      encodeH264(["-loop", "1", "-framerate", String(manifest.capture.videoFps), "-i", input], clip, format, duration);
    } else {
      throw new Error(`Unknown showcase media type: ${String(feature.media)}`);
    }

    clips.push(clip);
  }

  const concatInputs = clips.flatMap((clip) => ["-i", clip]);
  const concatPads = clips.map((_, index) => `[${String(index)}:v]`).join("");
  const reel = path.join(reelDir, format.reelName);
  run([
    "-y",
    ...concatInputs,
    "-filter_complex",
    `${concatPads}concat=n=${String(clips.length)}:v=1:a=0[outv]`,
    "-map",
    "[outv]",
    "-r",
    String(manifest.capture.videoFps),
    "-an",
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
    "-movflags",
    "+faststart",
    reel,
  ]);

  encodeAnimatedWebp(
    reel,
    path.join(reelDir, format.animatedReelName),
    format.graphicWidth,
  );
}

const imageWidth = { desktop: 960, mobile: 390 };
const mediaExtension = (feature) => (feature.media === "video" ? "webp" : "png");
const renderSection = (formFactor, heading) => {
  const width = imageWidth[formFactor];
  const animatedReelName =
    formFactor === "desktop"
      ? "lemonade-desktop-highlight.webp"
      : "lemonade-mobile-highlight.webp";
  const reelName =
    formFactor === "desktop"
      ? "lemonade-desktop-highlight.mp4"
      : "lemonade-mobile-highlight.mp4";
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
        `[Watch the source-resolution ${String(manifest.capture.videoFps)} fps scene capture](${manifest.stableBaseUrl}/videos/${formFactor}/${feature.id}.mp4)`,
        "",
      );
    }
  }

  lines.push(
    `[Watch the source-resolution ${String(manifest.capture.videoFps)} fps ${heading.toLowerCase()} highlight reel](${manifest.stableBaseUrl}/reels/${reelName})`,
    "",
  );
  return lines;
};

const readme = [
  "## Product in motion",
  "",
  "The 3D scenes are captured directly from the real WebGL canvas at source resolution and 60 fps. Static interface and report states use lossless screenshots rather than video frames.",
  "",
  ...renderSection("desktop", "Desktop"),
  ...renderSection("mobile", "Mobile"),
].join("\n");

await writeFile(path.join(artifactRoot, "README-showcase.md"), `${readme}\n`, "utf8");
await rm(path.join(artifactRoot, ".render"), { recursive: true, force: true });
