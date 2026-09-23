import {
  BoxGeometry,
  type BufferGeometry,
  CylinderGeometry,
  SphereGeometry,
} from "three";

export interface CharacterGeometryPool {
  box(x: number, y: number, z: number): BufferGeometry;
  cylinder(
    radiusTop: number,
    radiusBottom: number,
    height: number,
    radialSegments: number,
  ): BufferGeometry;
  sphere(
    radius: number,
    widthSegments: number,
    heightSegments: number,
  ): BufferGeometry;
  owns(geometry: BufferGeometry): boolean;
  dispose(): void;
}

const key = (kind: string, values: readonly number[]): string =>
  `${kind}:${values.join(",")}`;

export const createCharacterGeometryPool = (): CharacterGeometryPool => {
  const geometries = new Map<string, BufferGeometry>();
  const owned = new Set<BufferGeometry>();

  const get = (
    cacheKey: string,
    create: () => BufferGeometry,
  ): BufferGeometry => {
    const existing = geometries.get(cacheKey);
    if (existing !== undefined) return existing;
    const geometry = create();
    geometries.set(cacheKey, geometry);
    owned.add(geometry);
    return geometry;
  };

  return Object.freeze({
    box(x, y, z) {
      return get(key("box", [x, y, z]), () => new BoxGeometry(x, y, z));
    },
    cylinder(radiusTop, radiusBottom, height, radialSegments) {
      return get(
        key("cylinder", [radiusTop, radiusBottom, height, radialSegments]),
        () =>
          new CylinderGeometry(
            radiusTop,
            radiusBottom,
            height,
            radialSegments,
          ),
      );
    },
    sphere(radius, widthSegments, heightSegments) {
      return get(
        key("sphere", [radius, widthSegments, heightSegments]),
        () => new SphereGeometry(radius, widthSegments, heightSegments),
      );
    },
    owns(geometry) {
      return owned.has(geometry);
    },
    dispose() {
      for (const geometry of owned) geometry.dispose();
      geometries.clear();
      owned.clear();
    },
  });
};
