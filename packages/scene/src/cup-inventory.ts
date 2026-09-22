import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  type Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
} from "three";

const MAX_PREPARED_CUPS = 400;

export type CupInventory = Readonly<{
  meshes: readonly InstancedMesh[];
  setCount(count: number): void;
}>;

const glassMaterial = (): MeshStandardMaterial =>
  new MeshStandardMaterial({
    color: 0xaeffff,
    transparent: true,
    opacity: 0.44,
    roughness: 0.22,
    metalness: 0,
    side: DoubleSide,
    depthWrite: false,
  });

const lemonadeMaterial = (): MeshStandardMaterial =>
  new MeshStandardMaterial({
    color: 0xefff00,
    transparent: true,
    opacity: 0.67,
    roughness: 0.73,
  });

const iceMaterial = (): MeshStandardMaterial =>
  new MeshStandardMaterial({
    color: 0xf3fff3,
    transparent: true,
    opacity: 0.88,
    roughness: 0.42,
  });

const strawMaterial = (): MeshStandardMaterial =>
  new MeshStandardMaterial({ color: 0xff551d, roughness: 0.92 });

export const decorateLemonadeCup = (cup: Group): void => {
  const glass = new Mesh(
    new CylinderGeometry(0.075, 0.09, 0.19, 8, 1, true),
    glassMaterial(),
  );
  cup.add(glass);

  const liquid = new Mesh(
    new CylinderGeometry(0.061, 0.073, 0.115, 8),
    lemonadeMaterial(),
  );
  liquid.position.y = -0.022;
  cup.add(liquid);

  for (const [x, y, z, rotation] of [
    [-0.024, 0.025, 0.012, -0.28],
    [0.027, 0.045, -0.006, 0.34],
  ] as const) {
    const ice = new Mesh(new BoxGeometry(0.052, 0.038, 0.05), iceMaterial());
    ice.position.set(x, y, z);
    ice.rotation.y = rotation;
    cup.add(ice);
  }

  const straw = new Mesh(
    new CylinderGeometry(0.008, 0.008, 0.25, 6),
    strawMaterial(),
  );
  straw.position.set(0.028, 0.085, 0.008);
  straw.rotation.z = -0.2;
  cup.add(straw);
};

export const createCupInventory = (): CupInventory => {
  const shells = new InstancedMesh(
    new CylinderGeometry(0.075, 0.09, 0.19, 8, 1, true),
    glassMaterial(),
    MAX_PREPARED_CUPS,
  );
  const liquid = new InstancedMesh(
    new CylinderGeometry(0.061, 0.073, 0.115, 8),
    lemonadeMaterial(),
    MAX_PREPARED_CUPS,
  );
  const iceA = new InstancedMesh(
    new BoxGeometry(0.052, 0.038, 0.05),
    iceMaterial(),
    MAX_PREPARED_CUPS,
  );
  const iceB = new InstancedMesh(
    new BoxGeometry(0.052, 0.038, 0.05),
    iceMaterial(),
    MAX_PREPARED_CUPS,
  );
  const straws = new InstancedMesh(
    new CylinderGeometry(0.008, 0.008, 0.25, 6),
    strawMaterial(),
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
    iceA.setMatrixAt(index, matrix);
    matrix.makeRotationY(0.34).setPosition(x + 0.027, y + 0.045, z - 0.006);
    iceB.setMatrixAt(index, matrix);
    matrix.makeRotationZ(-0.2).setPosition(x + 0.028, y + 0.085, z + 0.008);
    straws.setMatrixAt(index, matrix);
  }

  const meshes = Object.freeze([shells, liquid, iceA, iceB, straws] as const);
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
