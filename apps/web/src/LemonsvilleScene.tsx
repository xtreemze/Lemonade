import { useEffect, useMemo, useRef, useState } from "react";

import {
  createLemonsvilleScene,
  type CustomerActivity,
  type LemonsvilleSceneController,
  type LemonsvilleSceneState,
} from "@lemonade/scene";
import type { DayEnvironment } from "@lemonade/simulation";

const activityBySentiment: Record<DayEnvironment["sentiment"]["kind"], CustomerActivity> = {
  "very-cold": "quiet",
  cold: "light",
  neutral: "steady",
  warm: "lively",
  hot: "busy",
};

type LemonsvilleSceneProps = Readonly<{
  environment: DayEnvironment;
  visibleSigns: number;
  phase: "deciding" | "report";
  sold: number;
  prepared: number;
}>;

export const LemonsvilleScene = ({
  environment,
  visibleSigns,
  phase,
  sold,
  prepared,
}: LemonsvilleSceneProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<LemonsvilleSceneController | null>(null);
  const [fallback, setFallback] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const sceneState = useMemo<LemonsvilleSceneState>(
    () =>
      Object.freeze({
        weather: environment.weather.kind,
        customerActivity: activityBySentiment[environment.sentiment.kind],
        visibleSigns,
        sellThroughBasisPoints:
          prepared > 0 ? Math.round((Math.max(0, sold) / prepared) * 10_000) : 0,
        phase,
        reducedMotion,
      }),
    [environment, visibleSigns, phase, sold, prepared, reducedMotion],
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (): void => {
      setReducedMotion(media.matches);
    };
    media.addEventListener("change", onChange);
    return () => {
      media.removeEventListener("change", onChange);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    const controller = createLemonsvilleScene(canvas, sceneState);
    if (controller === null) {
      setFallback(true);
      return;
    }

    controllerRef.current = controller;
    const resize = (): void => {
      controller.resize(canvas.clientWidth, canvas.clientHeight);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    return () => {
      observer.disconnect();
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.update(sceneState);
  }, [sceneState]);

  const description = `${environment.weather.kind.replaceAll("-", " ")} weather; ${environment.sentiment.kind.replaceAll("-", " ")} market sentiment; ${String(visibleSigns)} advertising signs visible.`;

  return (
    <section className="stand-stage" aria-label="Lemonsville lemonade stand">
      <canvas
        ref={canvasRef}
        className={fallback ? "scene-canvas scene-canvas-hidden" : "scene-canvas"}
        role="img"
        aria-label={description}
      />
      {fallback && (
        <div className="scene-fallback" role="img" aria-label={description}>
          <strong>Lemonsville</strong>
          <span>{description}</span>
        </div>
      )}
      <p className="scene-equivalent">{description}</p>
    </section>
  );
};
