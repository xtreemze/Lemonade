import {
  BoxGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  PlaneGeometry,
} from "three";

export interface AdvertisingSignAnchor {
  readonly root: Group;
}

export interface AdvertisingSignField {
  readonly signs: readonly AdvertisingSignAnchor[];
  readonly labelMaterial: MeshStandardMaterial;
  readonly meshes: readonly InstancedMesh[];
  sync(): void;
}

const material = (color: number): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, flatShading: true, roughness: 0.92 });

const localMatrix = (x: number, y: number, z: number): Matrix4 =>
  new Matrix4().makeTranslation(x, y, z);

export const createAdvertisingSignField = (
  count: number,
): AdvertisingSignField => {
  const safeCount = Math.max(0, Math.trunc(count));
  const signs = Array.from({ length: safeCount }, () => {
    const root = new Group();
    root.visible = false;
    return Object.freeze({ root });
  });

  const postMaterial = material(0x644c34);
  const boardMaterial = material(0xf5d34c);
  const labelMaterial = new MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.35,
    roughness: 0.9,
    side: DoubleSide,
  });

  const postMesh = new InstancedMesh(
    new BoxGeometry(0.1, 0.85, 0.1),
    postMaterial,
    safeCount,
  );
  const boardMesh = new InstancedMesh(
    new BoxGeometry(0.95, 0.62, 0.12),
    boardMaterial,
    safeCount,
  );
  const labelMesh = new InstancedMesh(
    new PlaneGeometry(0.86, 0.52),
    labelMaterial,
    safeCount,
  );
  postMesh.name = "AdvertisingSignPosts";
  boardMesh.name = "AdvertisingSignBoards";
  labelMesh.name = "AdvertisingSignLabels";

  const postLocal = localMatrix(0, 0.43, 0);
  const boardLocal = localMatrix(0, 1.05, 0);
  const labelLocal = localMatrix(0, 1.05, 0.066);
  const hidden = new Matrix4().makeScale(0, 0, 0);
  const composed = new Matrix4();

  const syncMesh = (
    mesh: InstancedMesh,
    local: Matrix4,
  ): void => {
    signs.forEach((sign, index) => {
      if (!sign.root.visible) {
        mesh.setMatrixAt(index, hidden);
        return;
      }
      sign.root.updateMatrixWorld(true);
      composed.multiplyMatrices(sign.root.matrixWorld, local);
      mesh.setMatrixAt(index, composed);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };

  const sync = (): void => {
    syncMesh(postMesh, postLocal);
    syncMesh(boardMesh, boardLocal);
    syncMesh(labelMesh, labelLocal);
  };

  sync();

  return Object.freeze({
    signs: Object.freeze(signs),
    labelMaterial,
    meshes: Object.freeze([postMesh, boardMesh, labelMesh]),
    sync,
  });
};
