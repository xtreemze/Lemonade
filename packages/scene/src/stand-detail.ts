import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";

import { STAND_LAYOUT } from "./stand-layout.js";
import { WORLD_SCALE } from "./world-scale.js";

export const STAND_SIGN_CENTER_Y = 2.62;
const STOCK_LEMONS = 8;
const JUICE_FULL_HEIGHT = 0.24;
const JUICE_BOTTOM_Y = STAND_LAYOUT.counterTopY + 0.04;

export type StandDetailController = Readonly<{
  setStock: (remaining: number, prepared: number) => void;
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
  if (safePrepared === 0) {
    return 0;
  }
  return Math.min(1, finiteStock(remaining) / safePrepared);
};

export const visibleLemonCountForStock = (remaining: number, prepared: number): number => {
  const fraction = stockFraction(remaining, prepared);
  if (fraction <= 0) {
    return 0;
  }
  return Math.max(1, Math.ceil(fraction * STOCK_LEMONS));
};

export const populateStand = (root: Group, shutter: Group): StandDetailController => {
  addBox(root, STAND_LAYOUT.body.size, STAND_LAYOUT.body.position, 0xe7_c6_72);
  addBox(root, STAND_LAYOUT.counter.size, STAND_LAYOUT.counter.position, 0xf3_d8_5d);
  addBox(root, STAND_LAYOUT.frontPanel.size, STAND_LAYOUT.frontPanel.position, 0xff_ef_af);
  for (const post of STAND_LAYOUT.posts) {
    addBox(root, post.size, post.position, 0x5e_49_34);
  }
  addBox(root, STAND_LAYOUT.canopy.size, STAND_LAYOUT.canopy.position, 0xe6_a9_3b);
  addBox(shutter, [2.42, 1.02, 0.08], [0, 1.48, 0.7], 0xd3_9b_43);
  addBox(shutter, [0.78, 0.2, 0.04], [0, 1.5, 0.75], 0xf4_dc_83);

  const detail = new Group();
  detail.userData.sceneRole = "stand-detail";

  addBox(detail, [0.06, 0.42, 0.06], [-0.52, 2.39, 0.52], 0x6b_57_3d);
  addBox(detail, [0.06, 0.42, 0.06], [0.52, 2.39, 0.52], 0x6b_57_3d);
  const signBoard = addBox(detail, [1.58, 0.56, 0.1], [0, STAND_SIGN_CENTER_Y, 0.65], 0xff_e3_6a);
  signBoard.userData.sceneRole = "stand-sign";
  signBoard.rotation.z = -0.055;

  const lemonBadge = new Mesh(new SphereGeometry(0.13, 10, 8), material(0xf6_d3_3b));
  lemonBadge.scale.set(1.22, 0.86, 0.24);
  lemonBadge.position.set(-0.5, STAND_SIGN_CENTER_Y, 0.72);
  lemonBadge.rotation.z = 0.18;
  detail.add(lemonBadge);

  const badgeLeaf = new Mesh(new CylinderGeometry(0, 0.04, 0.11, 5), material(0x4f_8c_4a));
  badgeLeaf.rotation.z = Math.PI / 2.6;
  badgeLeaf.position.set(-0.37, STAND_SIGN_CENTER_Y + 0.1, 0.72);
  detail.add(badgeLeaf);
  addBox(detail, [0.62, 0.07, 0.04], [0.33, STAND_SIGN_CENTER_Y + 0.07, 0.72], 0x6b_57_3d);
  addBox(detail, [0.76, 0.06, 0.04], [0.25, STAND_SIGN_CENTER_Y - 0.07, 0.72], 0x6b_57_3d);

  const basket = new Group();
  basket.userData.sceneRole = "stand-basket";
  basket.position.set(-0.91, STAND_LAYOUT.counterTopY, 0.3);
  addBox(basket, [0.54, 0.05, 0.36], [0, 0.025, 0], 0x9b_6a_3c);
  addBox(basket, [0.54, 0.09, 0.04], [0, 0.09, -0.16], 0xa7_77_45);
  addBox(basket, [0.54, 0.09, 0.04], [0, 0.09, 0.16], 0xa7_77_45);
  addBox(basket, [0.04, 0.09, 0.28], [-0.25, 0.09, 0], 0xa7_77_45);
  addBox(basket, [0.04, 0.09, 0.28], [0.25, 0.09, 0], 0xa7_77_45);
  detail.add(basket);

  const pitcher = new Mesh(
    new CylinderGeometry(0.15, 0.19, 0.38, 10),
    material(0xf0_eb_d3, {
      transparent: true,
      opacity: 0.72,
      roughness: 0.28,
    }),
  );
  pitcher.position.set(-0.57, STAND_LAYOUT.counterTopY + 0.19, 0.28);
  pitcher.userData.sceneRole = "stand-pitcher";
  detail.add(pitcher);

  const pitcherLemonade = new Mesh(
    new CylinderGeometry(0.12, 0.16, JUICE_FULL_HEIGHT, 10),
    material(0xea_c5_4b),
  );
  pitcherLemonade.userData.sceneRole = "stand-juice";
  detail.add(pitcherLemonade);

  const lemons = Array.from({ length: STOCK_LEMONS }, (_, index) => {
    const lemon = new Group();
    lemon.userData.sceneRole = "stand-stock-lemon";
    const fruit = new Mesh(
      new SphereGeometry(WORLD_SCALE.produce.lemonDiameter / 2, 7, 5),
      material(0xf6_d3_3b),
    );
    fruit.scale.set(1.15, 0.9, 0.9);
    lemon.add(fruit);

    const leaf = new Mesh(new CylinderGeometry(0, 0.018, 0.05, 5), material(0x4f_8c_4a));
    leaf.rotation.z = Math.PI / 2;
    leaf.position.set(0.047, 0.026, 0);
    lemon.add(leaf);

    const column = index % 4;
    const row = Math.floor(index / 4);
    lemon.position.set(-0.165 + column * 0.11, 0.11 + row * 0.055, -0.055 + (column % 2) * 0.09);
    basket.add(lemon);
    return lemon;
  });

  const setStock = (remaining: number, prepared: number): void => {
    const fraction = stockFraction(remaining, prepared);
    pitcherLemonade.visible = fraction > 0;
    pitcherLemonade.scale.y = Math.max(0.001, fraction);
    pitcherLemonade.position.set(-0.57, JUICE_BOTTOM_Y + (JUICE_FULL_HEIGHT * fraction) / 2, 0.28);

    const lemonCount = visibleLemonCountForStock(remaining, prepared);
    lemons.forEach((lemon, index) => {
      lemon.visible = index < lemonCount;
    });
  };

  setStock(0, 0);
  root.add(detail);
  return Object.freeze({ setStock });
};
