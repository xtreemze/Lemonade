import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";

import { STAND_LAYOUT } from "./stand-layout.js";

export const STAND_SIGN_CENTER_Y = 3.28;
const STOCK_LEMONS = 8;
const JUICE_FULL_HEIGHT = 0.3;
const JUICE_BOTTOM_Y = STAND_LAYOUT.counterTopY + 0.04;

export type StandDetailController = Readonly<{
  setStock(remaining: number, prepared: number): void;
}>;

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

const finiteStock = (value: number): number =>
  Math.max(0, Number.isFinite(value) ? Math.trunc(value) : 0);

export const stockFraction = (remaining: number, prepared: number): number => {
  const safePrepared = finiteStock(prepared);
  if (safePrepared === 0) return 0;
  return Math.min(1, finiteStock(remaining) / safePrepared);
};

export const visibleLemonCountForStock = (
  remaining: number,
  prepared: number,
): number => {
  const fraction = stockFraction(remaining, prepared);
  if (fraction <= 0) return 0;
  return Math.max(1, Math.ceil(fraction * STOCK_LEMONS));
};

export const populateStand = (
  root: Group,
  shutter: Group,
): StandDetailController => {
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

  addBox(detail, [0.08, 0.54, 0.08], [-0.58, 3.0, 0.58], 0x6b573d);
  addBox(detail, [0.08, 0.54, 0.08], [0.58, 3.0, 0.58], 0x6b573d);
  const signBoard = addBox(
    detail,
    [1.58, 0.56, 0.1],
    [0, STAND_SIGN_CENTER_Y, 0.65],
    0xffe36a,
  );
  signBoard.userData["sceneRole"] = "stand-sign";
  signBoard.rotation.z = -0.055;

  const lemonBadge = new Mesh(
    new SphereGeometry(0.2, 10, 8),
    material(0xf6d33b),
  );
  lemonBadge.scale.set(1.22, 0.86, 0.24);
  lemonBadge.position.set(-0.48, STAND_SIGN_CENTER_Y, 0.72);
  lemonBadge.rotation.z = 0.18;
  detail.add(lemonBadge);

  const badgeLeaf = new Mesh(
    new CylinderGeometry(0, 0.07, 0.2, 5),
    material(0x4f8c4a),
  );
  badgeLeaf.rotation.z = Math.PI / 2.6;
  badgeLeaf.position.set(-0.27, STAND_SIGN_CENTER_Y + 0.15, 0.72);
  detail.add(badgeLeaf);
  addBox(
    detail,
    [0.62, 0.07, 0.04],
    [0.33, STAND_SIGN_CENTER_Y + 0.07, 0.72],
    0x6b573d,
  );
  addBox(
    detail,
    [0.76, 0.06, 0.04],
    [0.25, STAND_SIGN_CENTER_Y - 0.07, 0.72],
    0x6b573d,
  );

  const basket = addBox(
    detail,
    [0.66, 0.25, 0.48],
    [-1.17, STAND_LAYOUT.counterTopY + 0.125, 0.34],
    0x9b6a3c,
  );
  basket.userData["sceneRole"] = "stand-basket";

  const pitcher = new Mesh(
    new CylinderGeometry(0.2, 0.25, 0.5, 10),
    material(0xf0ebd3, {
      transparent: true,
      opacity: 0.72,
      roughness: 0.28,
    }),
  );
  pitcher.position.set(-0.66, STAND_LAYOUT.counterTopY + 0.25, 0.34);
  pitcher.userData["sceneRole"] = "stand-pitcher";
  detail.add(pitcher);

  const pitcherLemonade = new Mesh(
    new CylinderGeometry(0.17, 0.21, JUICE_FULL_HEIGHT, 10),
    material(0xeac54b),
  );
  pitcherLemonade.userData["sceneRole"] = "stand-juice";
  detail.add(pitcherLemonade);

  const lemons = Array.from({ length: STOCK_LEMONS }, (_, index) => {
    const lemon = new Group();
    lemon.userData["sceneRole"] = "stand-stock-lemon";
    const fruit = new Mesh(
      new SphereGeometry(0.12, 7, 5),
      material(0xf6d33b),
    );
    fruit.scale.set(1.15, 0.9, 0.9);
    lemon.add(fruit);

    const leaf = new Mesh(
      new CylinderGeometry(0, 0.045, 0.12, 5),
      material(0x4f8c4a),
    );
    leaf.rotation.z = Math.PI / 2;
    leaf.position.set(0.12, 0.065, 0);
    lemon.add(leaf);

    const column = index % 4;
    const row = Math.floor(index / 4);
    lemon.position.set(
      -1.4 + column * 0.15,
      STAND_LAYOUT.counterTopY + 0.26 + row * 0.15,
      0.31 + (column % 2) * 0.1,
    );
    detail.add(lemon);
    return lemon;
  });

  const setStock = (remaining: number, prepared: number): void => {
    const fraction = stockFraction(remaining, prepared);
    pitcherLemonade.visible = fraction > 0;
    pitcherLemonade.scale.y = Math.max(0.001, fraction);
    pitcherLemonade.position.set(
      -0.66,
      JUICE_BOTTOM_Y + (JUICE_FULL_HEIGHT * fraction) / 2,
      0.34,
    );

    const lemonCount = visibleLemonCountForStock(remaining, prepared);
    lemons.forEach((lemon, index) => {
      lemon.visible = index < lemonCount;
    });
  };

  setStock(0, 0);
  root.add(detail);
  return Object.freeze({ setStock });
};
