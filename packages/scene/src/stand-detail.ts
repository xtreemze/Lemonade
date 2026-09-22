import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";

const material = (
  color: number,
  options: Readonly<{
    transparent?: boolean;
    opacity?: number;
    roughness?: number;
  }> = {},
): MeshStandardMaterial =>
  new MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: options.roughness ?? 0.92,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
  });

const addBox = (
  parent: Group,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  color: number,
): Mesh => {
  const mesh = new Mesh(new BoxGeometry(...size), material(color));
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
};

export const decorateStand = (root: Group, counterTopY: number): void => {
  const detail = new Group();
  detail.userData["sceneRole"] = "stand-detail";

  const signBoard = addBox(detail, [1.58, 0.56, 0.1], [0, 2.43, 0.65], 0xffe36a);
  signBoard.rotation.z = -0.055;

  const lemonBadge = new Mesh(
    new SphereGeometry(0.2, 10, 8),
    material(0xf6d33b),
  );
  lemonBadge.scale.set(1.22, 0.86, 0.24);
  lemonBadge.position.set(-0.48, 2.43, 0.72);
  lemonBadge.rotation.z = 0.18;
  detail.add(lemonBadge);

  const badgeLeaf = new Mesh(
    new CylinderGeometry(0, 0.07, 0.2, 5),
    material(0x4f8c4a),
  );
  badgeLeaf.rotation.z = Math.PI / 2.6;
  badgeLeaf.position.set(-0.27, 2.58, 0.72);
  detail.add(badgeLeaf);
  addBox(detail, [0.62, 0.07, 0.04], [0.33, 2.5, 0.72], 0x6b573d);
  addBox(detail, [0.76, 0.06, 0.04], [0.25, 2.36, 0.72], 0x6b573d);

  addBox(
    detail,
    [0.62, 0.28, 0.48],
    [-1.1, counterTopY + 0.14, 0.34],
    0x9b6a3c,
  );

  const pitcher = new Mesh(
    new CylinderGeometry(0.2, 0.25, 0.5, 10),
    material(0xf0ebd3, {
      transparent: true,
      opacity: 0.72,
      roughness: 0.28,
    }),
  );
  pitcher.position.set(1.08, counterTopY + 0.25, 0.34);
  detail.add(pitcher);

  const pitcherLemonade = new Mesh(
    new CylinderGeometry(0.17, 0.21, 0.3, 10),
    material(0xeac54b),
  );
  pitcherLemonade.position.set(1.08, counterTopY + 0.17, 0.34);
  detail.add(pitcherLemonade);

  root.add(detail);
};
