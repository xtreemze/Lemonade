import { spawnSync } from "node:child_process";
import { appendFile, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const artifactRoot = path.resolve("artifacts/e2e-media");
const manifest = JSON.parse(await readFile(path.join(artifactRoot, "manifest.json"), "utf8"));
const MiB = 1024 * 1024;

const requireFile = async (filePath) => {
  const details = await stat(filePath);
  if (!details.isFile() || details.size === 0) {
    throw new Error(`Expected non-empty file: ${filePath}`);
  }
  return details.size;
};

const formatMiB = (bytes) => `${(bytes / MiB).toFixed(2)} MiB`;

const probeStreams = (filePath) => {
  const result = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_type,width,height,avg_frame_rate,sample_rate,channels",
      "-of",
      "json",
      filePath,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`ffprobe failed for ${filePath}: ${result.stderr}`);
  }
  const parsed = JSON.parse(result.stdout);
  if (!Array.isArray(parsed.streams) || parsed.streams.length === 0) {
    throw new Error(`No media streams found in ${filePath}`);
  }
  return parsed.streams;
};

const frameRate = (value) => {
  if (typeof value !== "string") {
    return Number.NaN;
  }
  const [numerator, denominator = "1"] = value.split("/");
  return Number(numerator) / Number(denominator);
};

const probeFrameStats = (filePath) => {
  const result = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_frames",
      "-show_entries",
      "frame=best_effort_timestamp_time",
      "-of",
      "csv=p=0",
      filePath,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`ffprobe frame timing failed for ${filePath}: ${result.stderr}`);
  }

  const rawRows = result.stdout
    .split(/\\r?\\n/u)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const timestamps = rawRows.map(Number).filter((value) => Number.isFinite(value));
  if (timestamps.length < 2) {
    throw new Error(
      `Unable to measure captured frame cadence for ${filePath}; parsed ${String(
        timestamps.length,
      )} usable timestamps from ${String(rawRows.length)} FFprobe rows. Sample: ${rawRows
        .slice(0, 8)
        .join(" | ")}`,
    );
  }

  const firstTimestamp = timestamps[0];
  const lastTimestamp = timestamps.at(-1);
  if (firstTimestamp === undefined || lastTimestamp === undefined) {
    throw new Error(`Unable to measure captured frame timestamps for ${filePath}.`);
  }

  const minTimestamp = Math.min(...timestamps);
  const maxTimestamp = Math.max(...timestamps);
  const duration = lastTimestamp - firstTimestamp;
  if (!Number.isFinite(duration) || duration <= 0) {
    const sampleRows = [...rawRows.slice(0, 4), ...rawRows.slice(-4)].join(" | ");
    throw new Error(
      `Invalid captured frame duration for ${filePath}: frames=${String(
        timestamps.length,
      )}, first=${String(firstTimestamp)}, last=${String(lastTimestamp)}, min=${String(
        minTimestamp,
      )}, max=${String(maxTimestamp)}, rows=${sampleRows}`,
    );
  }

  const frameIntervals = timestamps.length - 1;
  return { frames: timestamps.length, duration, fps: frameIntervals / duration };
};

const assertCapturedFrameCadence = (filePath, expectedDurationSeconds) => {
  const stats = probeFrameStats(filePath);
  const minimumDuration = expectedDurationSeconds * 0.97;
  if (stats.duration < minimumDuration) {
    throw new Error(
      `${filePath} captured only ${stats.duration.toFixed(3)}s; expected at least ${minimumDuration.toFixed(3)}s.`,
    );
  }

  const minimumFps = manifest.capture.videoFps - 1;
  if (stats.fps < minimumFps) {
    throw new Error(
      `${filePath} contains ${String(stats.frames)} actual frames across ${stats.duration.toFixed(3)}s (${stats.fps.toFixed(2)} fps); expected at least ${minimumFps.toFixed(2)} fps before encoding.`,
    );
  }
};

const dimensions = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

const videoStream = (filePath) => {
  const stream = probeStreams(filePath).find((candidate) => candidate.codec_type === "video");
  if (stream === undefined) {
    throw new Error(`No video stream found in ${filePath}`);
  }
  return stream;
};

const assertAudio = (filePath) => {
  const stream = probeStreams(filePath).find((candidate) => candidate.codec_type === "audio");
  if (stream === undefined) {
    throw new Error(`No audio stream found in ${filePath}`);
  }
  if (Number(stream.sample_rate) !== 48_000) {
    throw new Error(
      `${filePath} audio sample rate is ${String(stream.sample_rate)}; expected 48000 Hz.`,
    );
  }
  if (!Number.isFinite(Number(stream.channels)) || Number(stream.channels) < 1) {
    throw new Error(`${filePath} has no usable audio channels.`);
  }
};

const assertAudible = (filePath) => {
  const result = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-i", filePath, "-map", "0:a:0", "-af", "volumedetect", "-f", "null", "-"],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`ffmpeg audio analysis failed for ${filePath}: ${result.stderr}`);
  }
  const match = result.stderr.match(/mean_volume:\s*(-?(?:\d+(?:\.\d+)?|inf))\s*dB/u);
  if (match?.[1] === undefined || match[1] === "-inf" || !Number.isFinite(Number(match[1]))) {
    throw new Error(`${filePath} contains an audio track but no measurable program audio.`);
  }
};

const assertDimensions = (filePath, expected) => {
  const stream = videoStream(filePath);
  if (stream.width !== expected.width || stream.height !== expected.height) {
    throw new Error(
      `${filePath} is ${String(stream.width)}×${String(stream.height)}; expected ${String(
        expected.width,
      )}×${String(expected.height)}.`,
    );
  }
  return stream;
};

const assertHighFrameRate = (filePath, expected) => {
  const stream = assertDimensions(filePath, expected);
  const fps = frameRate(stream.avg_frame_rate);
  if (!Number.isFinite(fps) || Math.abs(fps - manifest.capture.videoFps) > 0.5) {
    throw new Error(
      `${filePath} reports ${String(stream.avg_frame_rate)} fps; expected ${String(
        manifest.capture.videoFps,
      )} fps.`,
    );
  }
};

for (const formFactor of ["desktop", "mobile"]) {
  for (const feature of manifest.features) {
    const rawBase = path.join(artifactRoot, "raw", formFactor, feature.id);
    await requireFile(`${rawBase}.json`);
    if (feature.media === "video") {
      await requireFile(`${rawBase}.webm`);
      await requireFile(`${rawBase}.audio.webm`);
      const metadata = JSON.parse(await readFile(`${rawBase}.json`, "utf8"));
      if (metadata.source?.audioTracks < 1) {
        throw new Error(`${formFactor}/${feature.id} did not record an audio track.`);
      }
      assertAudio(`${rawBase}.audio.webm`);
      assertAudible(`${rawBase}.audio.webm`);
      if (metadata.requestedFps !== manifest.capture.videoFps) {
        throw new Error(`${formFactor}/${feature.id} did not request the showcase capture fps.`);
      }
      assertDimensions(`${rawBase}.webm`, dimensions[formFactor]);
      assertCapturedFrameCadence(`${rawBase}.webm`, Number(feature.durationSeconds));
    } else if (feature.media === "screenshot") {
      await requireFile(`${rawBase}.png`);
      assertDimensions(`${rawBase}.png`, dimensions[formFactor]);
    } else {
      throw new Error(`Unknown showcase media type: ${String(feature.media)}`);
    }
  }
}

const budgets = {
  desktop: { perGraphic: 10 * MiB, totalGraphics: 32 * MiB, animatedReel: 18 * MiB },
  mobile: { perGraphic: 5 * MiB, totalGraphics: 16 * MiB, animatedReel: 10 * MiB },
};

const summary = [
  "### Visual showcase media",
  "",
  `Source video/reels: ${String(manifest.capture.videoFps)} fps with 48 kHz audio. Animated README graphics: ${String(
    manifest.capture.animatedGraphicFps,
  )} fps.`,
  "",
  "| Form | Presentation asset | Type | Size |",
  "| --- | --- | --- | ---: |",
];

let combinedGraphics = 0;

for (const formFactor of ["desktop", "mobile"]) {
  const graphicDir = path.join(artifactRoot, "graphics", formFactor);
  const graphicNames = (await readdir(graphicDir)).sort();
  const expected = manifest.features
    .map((feature) => `${feature.id}.${feature.media === "video" ? "webp" : "png"}`)
    .sort();
  if (JSON.stringify(graphicNames) !== JSON.stringify(expected)) {
    throw new Error(`Expected mixed ${formFactor} presentation assets: ${expected.join(", ")}`);
  }

  let total = 0;
  for (const feature of manifest.features) {
    const extension = feature.media === "video" ? "webp" : "png";
    const name = `${feature.id}.${extension}`;
    const filePath = path.join(graphicDir, name);
    const size = await requireFile(filePath);
    if (size > budgets[formFactor].perGraphic) {
      throw new Error(
        `${formFactor}/${name} is ${formatMiB(size)}, above the ${formatMiB(
          budgets[formFactor].perGraphic,
        )} presentation budget.`,
      );
    }
    total += size;
    summary.push(
      `| ${formFactor} | ${name} | ${feature.media === "video" ? "animated WebP" : "PNG screenshot"} | ${formatMiB(size)} |`,
    );

    if (feature.media === "video") {
      const video = path.join(artifactRoot, "videos", formFactor, `${feature.id}.mp4`);
      await requireFile(video);
      assertHighFrameRate(video, dimensions[formFactor]);
      assertAudio(video);
      assertAudible(video);
    }
  }

  if (total > budgets[formFactor].totalGraphics) {
    throw new Error(
      `${formFactor} presentation payload is ${formatMiB(total)}, above the ${formatMiB(
        budgets[formFactor].totalGraphics,
      )} budget.`,
    );
  }
  combinedGraphics += total;
  summary.push(`| **${formFactor} total** | — | — | **${formatMiB(total)}** |`);

  const reelName =
    formFactor === "desktop" ? "lemonade-desktop-highlight.mp4" : "lemonade-mobile-highlight.mp4";
  const animatedReelName =
    formFactor === "desktop" ? "lemonade-desktop-highlight.webp" : "lemonade-mobile-highlight.webp";
  const reel = path.join(artifactRoot, "reels", reelName);
  const animatedReel = path.join(artifactRoot, "reels", animatedReelName);
  await requireFile(reel);
  assertHighFrameRate(reel, dimensions[formFactor]);
  assertAudio(reel);
  assertAudible(reel);
  const animatedSize = await requireFile(animatedReel);
  if (animatedSize > budgets[formFactor].animatedReel) {
    throw new Error(
      `${animatedReelName} is ${formatMiB(animatedSize)}, above the ${formatMiB(
        budgets[formFactor].animatedReel,
      )} budget.`,
    );
  }
}

if (combinedGraphics > 48 * MiB) {
  throw new Error(
    `Combined README/presentation media is ${formatMiB(
      combinedGraphics,
    )}, above the 48.00 MiB review budget.`,
  );
}

summary.push(`| **combined graphics** | — | — | **${formatMiB(combinedGraphics)}** |`, "");

await requireFile(path.join(artifactRoot, "README-showcase.md"));

console.log(summary.join("\n"));
if (process.env.GITHUB_STEP_SUMMARY !== undefined) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${summary.join("\n")}\n`, "utf8");
}
