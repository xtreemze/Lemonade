import {
  BoxGeometry,
  CylinderGeometry,
  type Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";
import type { Group } from "three";

import type { CharacterProfile } from "./characters.js";

const material = (color: number): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, flatShading: false, roughness: 0.88 });

export const decorateCharacterHead = (
  head: Mesh,
  profile: CharacterProfile,
  includeMouth = true,
): void => {
  const eyeMaterial = material(0x263238);
  for (const x of [-0.09, 0.09]) {
    const eye = new Mesh(new SphereGeometry(0.026, 8, 6), eyeMaterial.clone());
    eye.position.set(x, 0.045, 0.248);
    head.add(eye);
  }

  const nose = new Mesh(
    new SphereGeometry(0.038, 8, 6),
    material(profile.skinColor),
  );
  nose.scale.set(0.8, 1, 1.25);
  nose.position.set(0, -0.015, 0.258);
  head.add(nose);

  if (includeMouth) {
    const mouth = new Mesh(
      new BoxGeometry(0.11, 0.018, 0.016),
      material(0x7f4640),
    );
    mouth.position.set(0, -0.11, 0.246);
    head.add(mouth);
  }

  if (profile.hairStyle === 1) {
    const hair = new Mesh(new SphereGeometry(0.265, 11, 7), material(profile.hairColor));
    hair.scale.set(1, 0.42, 1);
    hair.position.y = 0.16;
    head.add(hair);
  } else if (profile.hairStyle === 2) {
    const hair = new Mesh(new BoxGeometry(0.42, 0.11, 0.34), material(profile.hairColor));
    hair.position.set(0, 0.18, -0.01);
    head.add(hair);
  } else if (profile.hairStyle === 3) {
    const hair = new Mesh(
      new CylinderGeometry(0.22, 0.25, 0.12, 10),
      material(profile.hairColor),
    );
    hair.position.y = 0.18;
    head.add(hair);
  }

  if (profile.accessory === 1) {
    const brim = new Mesh(new BoxGeometry(0.46, 0.035, 0.34), material(profile.hairColor));
    brim.position.set(0, 0.23, 0.05);
    head.add(brim);
  } else if (profile.accessory === 2) {
    const bridge = new Mesh(new BoxGeometry(0.18, 0.018, 0.018), material(0x273036));
    bridge.position.set(0, 0.035, 0.235);
    head.add(bridge);
  }
};


export const decorateSellerExpression = (
  eyebrows: readonly [Group, Group],
  mouth: readonly [Group, Group],
): void => {
  const expressionMaterial = material(0x3a2a25);
  for (const brow of eyebrows) {
    brow.add(
      new Mesh(
        new BoxGeometry(0.11, 0.018, 0.018),
        expressionMaterial.clone(),
      ),
    );
  }
  for (const half of mouth) {
    half.add(
      new Mesh(
        new BoxGeometry(0.12, 0.018, 0.018),
        expressionMaterial.clone(),
      ),
    );
  }
};
