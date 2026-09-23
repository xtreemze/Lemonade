import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const artifactRoot = path.resolve("artifacts/e2e-media");
const sourceManifestPath = path.resolve("e2e/showcase/manifest.json");
const manifest = JSON.parse(await readFile(sourceManifestPath, "utf8"));

const run = (args) => {
  const result = spawnSync("ffmpeg", args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed with status ${String(result.status)}: ${args.join(" ")}`);
  }
};

const formFactors = {
  desktop: {
    width: 1440,
    height: 900,
    gifWidth: 760,
    reelName: "lemonade-desktop-highlight.mp4",
  },
  mobile: {
    width: 390,
    height: 844,
    gifWidth: 320,
    reelName: "lemonade-mobile-highlight.mp4",
  },
};

await mkdir(artifactRoot, { recursive: true });
await writeFile(
  path.join(artifactRoot, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

for (const [formFactor, format] of Object.entries(formFactors)) {
  const rawDir = path.join(artifactRoot, "raw", formFactor);
  const gifDir = path.join(artifactRoot, "gifs", formFactor);
  const clipDir = path.join(artifactRoot, ".render", formFactor);
  const reelDir = path.join(artifactRoot, "reels");

  await rm(gifDir, { recursive: true, force: true });
  await rm(clipDir, { recursive: true, force: true });
  await mkdir(gifDir, { recursive: true });
  await mkdir(clipDir, { recursive: true });
  await mkdir(reelDir, { recursive: true });

  const clips = [];
  for (const feature of manifest.features) {
    const input = path.join(rawDir, `${feature.id}.webm`);
    const clip = path.join(clipDir, `${feature.id}.mp4`);
    const gif = path.join(gifDir, `${feature.id}.gif`);
    const duration = String(feature.durationSeconds);

    run([
      "-y",
      "-sseof",
      `-${duration}`,
      "-i",
      input,
      "-t",
      duration,
      "-vf",
      `fps=30,scale=${format.width}:${format.height}:flags=lanczos,setsar=1`,
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "22",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      clip,
    ]);

    run([
      "-y",
      "-sseof",
      `-${duration}`,
      "-i",
      input,
      "-t",
      duration,
      "-filter_complex",
      `fps=10,scale=${format.gifWidth}:-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96:stats_mode=diff[p];[s1][p]paletteuse=dither=sierra2_4a`,
      "-loop",
      "0",
      gif,
    ]);

    clips.push(clip);
  }

  const concatInputs = clips.flatMap((clip) => ["-i", clip]);
  const concatPads = clips.map((_, index) => `[${index}:v]`).join("");
  const reel = path.join(reelDir, format.reelName);
  run([
    "-y",
    ...concatInputs,
    "-filter_complex",
    `${concatPads}concat=n=${String(clips.length)}:v=1:a=0[outv]`,
    "-map",
    "[outv]",
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "21",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    reel,
  ]);
}

const imageWidth = { desktop: 760, mobile: 320 };
const renderSection = (formFactor, heading) => {
  const lines = [`### ${heading}`, ""];
  for (const feature of manifest.features) {
    lines.push(
      `#### ${feature.title}`,
      "",
      feature.description,
      "",
      `<img src="${manifest.stableBaseUrl}/${formFactor}/${feature.id}.gif" alt="${feature.alt}" width="${String(imageWidth[formFactor])}" />`,
      "",
    );
  }
  const reelName =
    formFactor === "desktop"
      ? "lemonade-desktop-highlight.mp4"
      : "lemonade-mobile-highlight.mp4";
  lines.push(
    `[Watch the ${heading.toLowerCase()} highlight reel](${manifest.stableBaseUrl}/reels/${reelName})`,
    "",
  );
  return lines;
};

const readme = [
  "## Product in motion",
  "",
  "These visuals are recorded from the real application in Chromium by the dedicated CI showcase workflow.",
  "",
  ...renderSection("desktop", "Desktop"),
  ...renderSection("mobile", "Mobile"),
].join("\n");

await writeFile(path.join(artifactRoot, "README-showcase.md"), `${readme}\n`, "utf8");
await rm(path.join(artifactRoot, ".render"), { recursive: true, force: true });
