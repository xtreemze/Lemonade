# Visual showcase pipeline

Lemonade’s presentation evidence is generated from the real application in real Chromium sessions. The showcase is not a mock, a separate demo application, or a set of hand-authored screenshots.

The dedicated `Visual Showcase` workflow records the same five product capabilities on desktop and mobile:

1. weather forecast;
2. three-decision planning;
3. live Lemonsville simulation;
4. day report;
5. sales history.

Desktop capture uses a 1440×900 Chromium viewport and exercises pointer/keyboard behavior where the feature supports it. Mobile capture uses the project’s certified 390×844 portrait viewport with touch enabled and the actual responsive layout. The two form factors share scene intent and labels, but interaction routines may differ so mobile is not forced through desktop mechanics.

## Published media

The stable GitHub Pages collections are:

- Desktop GIFs: https://xtreemze.github.io/Lemonade/showcase/desktop/
- Mobile GIFs: https://xtreemze.github.io/Lemonade/showcase/mobile/
- Desktop highlight reel: https://xtreemze.github.io/Lemonade/showcase/reels/lemonade-desktop-highlight.mp4
- Mobile highlight reel: https://xtreemze.github.io/Lemonade/showcase/reels/lemonade-mobile-highlight.mp4

README markup is generated from `e2e/showcase/manifest.json` into the CI artifact as `README-showcase.md`. The committed README uses the same stable filenames, and contract tests prevent the manifest and documentation from drifting apart.

## Artifact layout

Each successful showcase run uploads `artifacts/e2e-media` with:

- ten raw Chromium videos;
- ten final screenshots;
- per-scene metadata;
- five optimized desktop GIFs;
- five optimized mobile GIFs;
- one desktop H.264 highlight reel;
- one portrait mobile H.264 highlight reel;
- the manifest;
- generated README-ready markup;
- Playwright traces/results when retained.

Raw media stays in CI artifacts for later visual diagnosis. Generated GIF and MP4 binaries are not committed to source control.

## Rendering policy

FFmpeg performs deterministic trimming, scaling, H.264 composition, and GIF palette generation/use. GIFs use infinite looping, 10 fps, a 96-color constrained palette, and Lanczos scaling. Desktop GIFs target 760 px width; mobile GIFs target 320 px width while retaining portrait orientation.

The verifier reports every GIF size plus desktop, mobile, and combined payload totals. Size budgets fail CI rather than allowing README media to grow silently.

## Deployment

The normal GitHub Pages workflow runs the same capture/render/verification commands for the master revision being published, then copies the finished media into `apps/web/dist/showcase` before uploading the Pages artifact. This keeps README and documentation URLs stable while ensuring the published imagery corresponds to a tested application revision.
