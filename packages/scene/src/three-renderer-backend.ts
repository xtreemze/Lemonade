import { SRGBColorSpace, WebGLRenderer } from "three";

export type ThreeRendererBackendKind = "three-webgl";

export interface ThreeRendererBackend {
  readonly kind: ThreeRendererBackendKind;
  readonly renderer: WebGLRenderer;
  dispose: () => void;
}

export const rendererPixelRatio = (devicePixelRatio: number): number => {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) {
    return 1;
  }
  return Math.min(devicePixelRatio, 2);
};

export const createThreeRendererBackend = (
  canvas: HTMLCanvasElement,
  devicePixelRatio: number,
): ThreeRendererBackend | null => {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }

  renderer.setPixelRatio(rendererPixelRatio(devicePixelRatio));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = false;
  renderer.setClearColor(0x8f_a7_b8, 1);

  return Object.freeze({
    kind: "three-webgl" as const,
    renderer,
    dispose(): void {
      renderer.dispose();
    },
  });
};
