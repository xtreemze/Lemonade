export interface RendererInfoSource {
  readonly render: Readonly<{
    calls: number;
    frame: number;
    lines: number;
    points: number;
    triangles: number;
  }>;
  readonly memory: Readonly<{
    geometries: number;
    textures: number;
  }>;
}

export type RendererDiagnostics = Readonly<{
  frame: number;
  drawCalls: number;
  triangles: number;
  lines: number;
  points: number;
  geometries: number;
  textures: number;
}>;

export const rendererDiagnostics = (
  info: RendererInfoSource,
): RendererDiagnostics =>
  Object.freeze({
    frame: info.render.frame,
    drawCalls: info.render.calls,
    triangles: info.render.triangles,
    lines: info.render.lines,
    points: info.render.points,
    geometries: info.memory.geometries,
    textures: info.memory.textures,
  });
