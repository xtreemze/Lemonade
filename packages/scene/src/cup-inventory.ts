import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
} from "three";

const MAX_PREPARED_CUPS = 400;

export type CupInventory = Readonly<{
  meshes: readonly InstancedMesh[];
  setCount(count: number): void;
}>;

export const createCupInventory = (): CupInventory => {
  const shells = new InstancedMesh(
    new CylinderGeometry(0.075, 0.09, 0.19, 8, 1, true),
    new MeshStandardMaterial({
      color: 0xaeffff,
      transparent: true,
      opacity: 0.42,
      roughness: 0.22,
      metalness: 0,
      side: DoubleSide,
      depthWrite: false,
    }),
    MAX_PREPARED_CUPS,
  );
  const liquid = new InstancedMesh(
    new CylinderGeometry(0.061, 0.073, 0.115, 8),
    new MeshStandardMaterial({
      color: 0xefff00,
      transparent: true,
      opacity: 0.66,
      roughness: 0.72,
    }),
    MAX_PREPARED_CUPS,
  );
  const ice = new InstancedMesh(
    new BoxGeometry(0.052, 0.038, 0.05),
    new MeshStandardMaterial({
      color: 0xf3fff3,
      transparent: true,
      opacity: 0.88,
      roughness: 0.42,
    }),
    MAX_PREPARED_CUPS,
  );
  const straws = new InstancedMesh(
    new CylinderGeometry(0.008, 0.008, 0.25, 6),
    new MeshStandardMaterial({ color: 0xff551d, roughness: 0.92 }),
    MAX_PREPARED_CUPS,
  );

  const matrix = new Matrix4();
  for (let index = 0; index < MAX_PREPARED_CUPS; index += 1) {
    const column = index % 20;
    const row = Math.floor(index / 20) % 7;
    const depth = Math.floor(index / 140);
    const x = -1.7 + column * 0.18;
    const y = 1.45 + row * 0.19;
    const z = 1.04 - depth * 0.14;

    matrix.makeTranslation(x, y, z);
    shells.setMatrixAt(index, matrix);
    matrix.makeTranslation(x, y - 0.022, z + 0.003);
    liquid.setMatrixAt(index, matrix);
    matrix.makeRotationY(-0.28).setPosition(x - 0.024, y + 0.025, z + 0.012);
    ice.setMatrixAt(index, matrix);
    matrix.makeRotationZ(-0.2).setPosition(x + 0.028, y + 0.085, z + 0.008);
    straws.setMatrixAt(index, matrix);
  }

  const meshes = Object.freeze([shells, liquid, ice, straws] as const);
  for (const mesh of meshes) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = 0;
  }

  return Object.freeze({
    meshes,
    setCount(count: number): void {
      const visible = Math.min(
        MAX_PREPARED_CUPS,
        Math.max(0, Number.isFinite(count) ? Math.trunc(count) : 0),
      );
      for (const mesh of meshes) mesh.count = visible;
    },
  });
};
