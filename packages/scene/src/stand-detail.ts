import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";

import { STAND_LAYOUT } from "./stand-layout.js";

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

export const populateStand = (root: Group, shutter: Group): void => {
  addBox(root, STAND_LAYOUT.body.size, STAND_LAYOUT.body.position, 0xe7c672);
  addBox(root, STAND_LAYOUT.counter.size, STAND_LAYOUT.counter.position, 0xf3d85d);
  addBox(root, STAND_LAYOUT.frontPanel.size, STAND_LAYOUT.frontPanel.position, 0xffefaf);
  for (const post of STAND_LAYOUT.posts) {
    addBox(root, post.size, post.position, 0x5e4934);
  }
  addBox(root, STAND_LAYOUT.canopy.size, STAND_LAYOUT.canopy.position, 0xe6a93b);
  addBox(shutter, [3.0, 0.82, 0.1], [0, 0.96, 0.78], 0xd39b43);
  addBox(shutter, [0.92, 0.24, 0.04], [0, 0.98, 0.84], 0xf4dc83);

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
    [-1.1, STAND_LAYOUT.counterTopY + 0.14, 0.34],
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
  pitcher.position.set(1.08, STAND_LAYOUT.counterTopY + 0.25, 0.34);
  detail.add(pitcher);

  const pitcherLemonade = new Mesh(
    new CylinderGeometry(0.17, 0.21, 0.3, 10),
    material(0xeac54b),
  );
  pitcherLemonade.position.set(1.08, STAND_LAYOUT.counterTopY + 0.17, 0.34);
  detail.add(pitcherLemonade);

  root.add(detail);
};
