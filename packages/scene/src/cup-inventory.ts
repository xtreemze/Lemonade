import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
} from "three";
import type { Group } from "three";

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

const lemonadeBackMaterial = (): MeshStandardMaterial =>
  new MeshStandardMaterial({
    color: 0xe8b06a,
    transparent: true,
    opacity: 0.45,
    roughness: 0.73,
  });

const lemonadeFrontMaterial = (): MeshStandardMaterial =>
  new MeshStandardMaterial({
    color: 0xefff00,
    transparent: true,
    opacity: 0.56,
    roughness: 0.68,
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

  const liquidBack = new Mesh(
    new CylinderGeometry(0.061, 0.073, 0.118, 8),
    lemonadeBackMaterial(),
  );
  liquidBack.position.y = -0.021;
  cup.add(liquidBack);

  const liquidFront = new Mesh(
    new CylinderGeometry(0.059, 0.071, 0.108, 8),
    lemonadeFrontMaterial(),
  );
  liquidFront.position.set(0, -0.014, 0.004);
  cup.add(liquidFront);

  for (const [x, y, z, rotation] of [
    [-0.027, 0.018, 0.014, -0.28],
    [0.027, 0.041, -0.006, 0.34],
    [-0.004, 0.062, 0.018, 0.12],
    [-0.035, 0.068, -0.014, -0.18],
    [0.036, 0.071, 0.009, 0.27],
  ] as const) {
    const ice = new Mesh(new BoxGeometry(0.046, 0.034, 0.044), iceMaterial());
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
  const liquidBack = new InstancedMesh(
    new CylinderGeometry(0.061, 0.073, 0.118, 8),
    lemonadeBackMaterial(),
    MAX_PREPARED_CUPS,
  );
  const liquidFront = new InstancedMesh(
    new CylinderGeometry(0.059, 0.071, 0.108, 8),
    lemonadeFrontMaterial(),
    MAX_PREPARED_CUPS,
  );
  const iceA = new InstancedMesh(
    new BoxGeometry(0.046, 0.034, 0.044),
    iceMaterial(),
    MAX_PREPARED_CUPS,
  );
  const iceB = new InstancedMesh(
    new BoxGeometry(0.046, 0.034, 0.044),
    iceMaterial(),
    MAX_PREPARED_CUPS,
  );
  const iceC = new InstancedMesh(
    new BoxGeometry(0.046, 0.034, 0.044),
    iceMaterial(),
    MAX_PREPARED_CUPS,
  );
  const iceD = new InstancedMesh(
    new BoxGeometry(0.046, 0.034, 0.044),
    iceMaterial(),
    MAX_PREPARED_CUPS,
  );
  const iceE = new InstancedMesh(
    new BoxGeometry(0.046, 0.034, 0.044),
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
    matrix.makeTranslation(x, y - 0.021, z + 0.001);
    liquidBack.setMatrixAt(index, matrix);
    matrix.makeTranslation(x, y - 0.014, z + 0.006);
    liquidFront.setMatrixAt(index, matrix);
    matrix.makeRotationY(-0.28).setPosition(x - 0.027, y + 0.018, z + 0.014);
    iceA.setMatrixAt(index, matrix);
    matrix.makeRotationY(0.34).setPosition(x + 0.027, y + 0.041, z - 0.006);
    iceB.setMatrixAt(index, matrix);
    matrix.makeRotationY(0.12).setPosition(x - 0.004, y + 0.062, z + 0.018);
    iceC.setMatrixAt(index, matrix);
    matrix.makeRotationY(-0.18).setPosition(x - 0.035, y + 0.068, z - 0.014);
    iceD.setMatrixAt(index, matrix);
    matrix.makeRotationY(0.27).setPosition(x + 0.036, y + 0.071, z + 0.009);
    iceE.setMatrixAt(index, matrix);
    matrix.makeRotationZ(-0.2).setPosition(x + 0.028, y + 0.085, z + 0.008);
    straws.setMatrixAt(index, matrix);
  }

  const meshes = Object.freeze([
    shells,
    liquidBack,
    liquidFront,
    iceA,
    iceB,
    iceC,
    iceD,
    iceE,
    straws,
  ] as const);
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
