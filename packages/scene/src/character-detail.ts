import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";

import type { CharacterProfile } from "./characters.js";

const material = (color: number): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, flatShading: false, roughness: 0.88 });

const expressionCurve = (profile: CharacterProfile): number => {
  switch (profile.expression) {
    case "bright":
      return 0.34;
    case "curious":
      return 0.12;
    case "serious":
      return -0.26;
    case "calm":
      return 0;
  }
};

const addHair = (head: Mesh, profile: CharacterProfile): void => {
  const hairMaterial = material(profile.hairColor);
  const cap = new Mesh(new SphereGeometry(0.278, 12, 8), hairMaterial);
  cap.scale.set(1.05, 0.66, 1.04);
  cap.position.set(0, 0.135, -0.012);
  cap.userData["sceneRole"] = "character-hair";
  head.add(cap);

  if (profile.hairStyle === 0) {
    const fringe = new Mesh(new BoxGeometry(0.31, 0.075, 0.08), hairMaterial.clone());
    fringe.position.set(-0.035, 0.105, 0.22);
    fringe.rotation.z = -0.08;
    head.add(fringe);
  } else if (profile.hairStyle === 1) {
    const side = new Mesh(new SphereGeometry(0.18, 9, 6), hairMaterial.clone());
    side.scale.set(0.72, 1.32, 0.88);
    side.position.set(-0.2, -0.005, -0.005);
    head.add(side);
  } else if (profile.hairStyle === 2) {
    const back = new Mesh(new SphereGeometry(0.23, 10, 7), hairMaterial.clone());
    back.scale.set(1.04, 1.25, 0.62);
    back.position.set(0, -0.055, -0.19);
    head.add(back);
  } else if (profile.hairStyle === 3) {
    const tail = new Mesh(new SphereGeometry(0.115, 8, 6), hairMaterial.clone());
    tail.scale.set(0.8, 1.45, 0.8);
    tail.position.set(0, -0.045, -0.31);
    head.add(tail);
  } else {
    for (const direction of [-1, 0, 1] as const) {
      const curl = new Mesh(new SphereGeometry(0.105, 8, 6), hairMaterial.clone());
      curl.position.set(direction * 0.15, 0.15 - Math.abs(direction) * 0.025, 0.14);
      head.add(curl);
    }
  }
};

export const decorateCharacterHead = (
  head: Mesh,
  profile: CharacterProfile,
  includeMouth = true,
): void => {
  head.scale.x *= profile.headWidthScale;
  head.scale.y *= profile.headHeightScale;
  if (profile.ageGroup === "child") {
    head.scale.multiplyScalar(1.08);
  }

  const white = material(0xf6f2e8);
  const iris = material(0x263238);
  for (const direction of [-1, 1] as const) {
    const eye = new Mesh(new SphereGeometry(0.035, 8, 6), white.clone());
    eye.position.set(direction * profile.eyeSpacing, 0.045, 0.246);
    const pupil = new Mesh(new SphereGeometry(0.018, 8, 6), iris.clone());
    pupil.position.set(0, 0, 0.028);
    eye.add(pupil);
    head.add(eye);

    if (includeMouth) {
      const brow = new Mesh(
        new BoxGeometry(0.09, 0.015, 0.018),
        material(profile.hairColor),
      );
      brow.position.set(direction * profile.eyeSpacing, 0.118, 0.255);
      const curve = expressionCurve(profile);
      brow.rotation.z =
        direction *
        (profile.expression === "curious"
          ? direction === -1
            ? 0.18
            : -0.02
          : -curve * 0.34);
      head.add(brow);
    }
  }

  const nose = new Mesh(
    new SphereGeometry(0.038, 8, 6),
    material(profile.skinColor),
  );
  nose.scale.set(0.8, 1, 1.25);
  nose.position.set(0, -0.015, 0.258);
  head.add(nose);

  if (includeMouth) {
    const curve = expressionCurve(profile);
    for (const direction of [-1, 1] as const) {
      const mouth = new Mesh(
        new BoxGeometry(0.064, 0.017, 0.016),
        material(0x7f4640),
      );
      mouth.position.set(direction * 0.03, -0.11 + Math.abs(curve) * 0.008, 0.252);
      mouth.rotation.z = direction * curve;
      head.add(mouth);
    }
  }

  addHair(head, profile);

  if (profile.accessory === 1) {
    const brim = new Mesh(new BoxGeometry(0.48, 0.035, 0.36), material(profile.hairColor));
    brim.position.set(0, 0.245, 0.045);
    head.add(brim);
  } else if (profile.accessory === 2) {
    const bridge = new Mesh(new BoxGeometry(0.18, 0.018, 0.018), material(0x273036));
    bridge.position.set(0, 0.035, 0.257);
    head.add(bridge);
    for (const direction of [-1, 1] as const) {
      const lens = new Mesh(new BoxGeometry(0.11, 0.07, 0.014), material(0x59656d));
      lens.position.set(direction * 0.09, 0.035, 0.252);
      head.add(lens);
    }
  }
};

export const decorateCharacterClothing = (
  root: Group,
  profile: CharacterProfile,
): Group => {
  const clothing = new Group();
  clothing.userData["sceneRole"] = "character-clothing";

  const collar = new Mesh(
    new CylinderGeometry(0.245, 0.27, 0.075, 10),
    material(profile.clothingColor),
  );
  collar.position.y = 1.46;
  clothing.add(collar);

  const hem = new Mesh(
    new CylinderGeometry(0.335, 0.35, 0.12, 10),
    material(profile.clothingColor),
  );
  hem.position.y = 0.65;
  clothing.add(hem);

  if (profile.outfitStyle === 1) {
    for (const direction of [-1, 1] as const) {
      const panel = new Mesh(
        new BoxGeometry(0.2, 0.62, 0.055),
        material(profile.clothingColor),
      );
      panel.position.set(direction * 0.11, 1.03, 0.285);
      panel.rotation.z = direction * 0.05;
      clothing.add(panel);
    }
  } else if (profile.outfitStyle === 2) {
    const skirt = new Mesh(
      new CylinderGeometry(0.29, 0.43, 0.38, 10),
      material(profile.clothingColor),
    );
    skirt.position.y = 0.56;
    clothing.add(skirt);
  } else if (profile.outfitStyle === 3) {
    for (const direction of [-1, 1] as const) {
      const shorts = new Mesh(
        new BoxGeometry(0.25, 0.24, 0.34),
        material(profile.trouserColor),
      );
      shorts.position.set(direction * 0.14, 0.68, 0);
      clothing.add(shorts);
    }
  }

  root.add(clothing);
  return clothing;
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
