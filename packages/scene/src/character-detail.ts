import {
  BoxGeometry,
  CylinderGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";
import type { Group, Object3D } from "three";

import type { CharacterProfile } from "./characters.js";

export type CharacterGender = "male" | "female";
export type CharacterAgeGroup = "adult" | "child";
export type CharacterExpression = "smile" | "neutral" | "focused" | "curious";
export type CharacterIdentity = Readonly<{
  gender: CharacterGender;
  ageGroup: CharacterAgeGroup;
  garmentStyle: 0 | 1 | 2 | 3;
  expression: CharacterExpression;
}>;

const material = (color: number): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, flatShading: false, roughness: 0.88 });

const expressions = ["smile", "neutral", "focused", "curious"] as const;

export const characterIdentityFor = (
  index: number,
  profile: CharacterProfile,
): CharacterIdentity => {
  const actorIndex = Number.isFinite(index) ? Math.abs(Math.trunc(index)) : 0;
  const identityIndex = (profile.hairStyle + profile.accessory + actorIndex) & 3;
  return Object.freeze({
    gender: actorIndex % 2 === 0 ? "male" : "female",
    ageGroup:
      actorIndex >= 10_000 || Math.floor(actorIndex / 2) % 3 !== 2
        ? "adult"
        : "child",
    garmentStyle: identityIndex as 0 | 1 | 2 | 3,
    expression: expressions[(identityIndex + profile.accessory) & 3] ?? "neutral",
  });
};

const mark = <T extends Object3D>(object: T, role: string): T => {
  object.userData["sceneRole"] = role;
  return object;
};

const addFaceBar = (
  head: Mesh,
  width: number,
  position: readonly [number, number, number],
  rotationZ: number,
  color: number,
): Mesh => {
  const bar = mark(
    new Mesh(new BoxGeometry(width, 0.022, 0.024), material(color)),
    "face-expression",
  );
  bar.position.set(...position);
  bar.rotation.z = rotationZ;
  head.add(bar);
  return bar;
};

export const decorateCharacterHead = (
  head: Mesh,
  profile: CharacterProfile,
  identity: CharacterIdentity,
  includeMouth = true,
): void => {
  head.scale.x *= profile.headWidthScale;
  head.scale.y *= profile.headHeightScale;

  const eyeWhiteMaterial = material(0xf5f2e8);
  const pupilMaterial = material(0x263238);
  for (const direction of [-1, 1] as const) {
    const white = mark(
      new Mesh(new SphereGeometry(0.038, 9, 7), eyeWhiteMaterial.clone()),
      "eye-white",
    );
    white.scale.set(1.08, 0.82, 0.42);
    white.position.set(direction * profile.eyeSpacing, 0.047, 0.251);
    head.add(white);

    const pupil = mark(
      new Mesh(new SphereGeometry(0.015, 8, 6), pupilMaterial.clone()),
      "eye-pupil",
    );
    pupil.position.set(direction * profile.eyeSpacing, 0.047, 0.273);
    head.add(pupil);
  }

  const nose = new Mesh(
    new SphereGeometry(0.038, 8, 6),
    material(profile.skinColor),
  );
  nose.scale.set(0.8, 1, 1.25);
  nose.position.set(0, -0.015, 0.258);
  head.add(nose);

  const expressionColor = 0x4d302d;
  const browTilt =
    identity.expression === "curious"
      ? 0.16
      : identity.expression === "focused"
        ? -0.13
        : identity.expression === "smile"
          ? 0.06
          : 0;
  addFaceBar(
    head,
    0.075,
    [-profile.eyeSpacing, 0.112, 0.264],
    browTilt,
    expressionColor,
  );
  addFaceBar(
    head,
    0.075,
    [profile.eyeSpacing, 0.112, 0.264],
    -browTilt,
    expressionColor,
  );

  if (includeMouth) {
    const mouthTilt =
      identity.expression === "smile"
        ? 0.24
        : identity.expression === "focused"
          ? -0.14
          : identity.expression === "curious"
            ? 0.08
            : 0;
    const mouthY = identity.expression === "focused" ? -0.098 : -0.105;
    addFaceBar(head, 0.07, [-0.035, mouthY, 0.266], -mouthTilt, 0x8b4c48);
    addFaceBar(head, 0.07, [0.035, mouthY, 0.266], mouthTilt, 0x8b4c48);
  }

  // Every hairstyle starts with a full crown shell. Style-specific geometry sits
  // on top of it, preventing the scalp pinhole that appeared with partial caps.
  const crown = mark(
    new Mesh(new SphereGeometry(0.282, 12, 8), material(profile.hairColor)),
    "hair-cover",
  );
  crown.scale.set(1.06, 0.68, 0.98);
  crown.position.set(0, 0.12, -0.012);
  head.add(crown);

  if (profile.hairStyle === 0) {
    for (const [x, y, z, scale] of [
      [-0.13, 0.21, 0.12, 0.78],
      [0.02, 0.245, 0.15, 0.9],
      [0.15, 0.205, 0.1, 0.72],
    ] as const) {
      const tuft = mark(
        new Mesh(new SphereGeometry(0.09, 8, 6), material(profile.hairColor)),
        "hair-detail",
      );
      tuft.scale.set(scale, 0.72, 0.68);
      tuft.position.set(x, y, z);
      head.add(tuft);
    }
  } else if (profile.hairStyle === 1) {
    for (const direction of [-1, 1] as const) {
      const sideHair = mark(
        new Mesh(new BoxGeometry(0.09, 0.34, 0.19), material(profile.hairColor)),
        "hair-detail",
      );
      sideHair.position.set(direction * 0.235, -0.005, -0.025);
      sideHair.rotation.z = direction * 0.09;
      head.add(sideHair);
    }
    const ponytail = mark(
      new Mesh(new SphereGeometry(0.105, 9, 7), material(profile.hairColor)),
      "hair-detail",
    );
    ponytail.scale.set(0.82, 1.45, 0.72);
    ponytail.position.set(-0.17, 0.02, -0.245);
    ponytail.rotation.z = -0.18;
    head.add(ponytail);
  } else if (profile.hairStyle === 2) {
    for (const [x, rotation] of [
      [-0.14, -0.16],
      [0, 0.04],
      [0.14, 0.17],
    ] as const) {
      const fringe = mark(
        new Mesh(new BoxGeometry(0.16, 0.12, 0.1), material(profile.hairColor)),
        "hair-detail",
      );
      fringe.position.set(x, 0.13 - Math.abs(x) * 0.16, 0.205);
      fringe.rotation.z = rotation;
      head.add(fringe);
    }
  } else {
    const bun = mark(
      new Mesh(new SphereGeometry(0.125, 10, 8), material(profile.hairColor)),
      "hair-detail",
    );
    bun.position.set(
      identity.gender === "female" ? 0.14 : -0.12,
      0.27,
      -0.13,
    );
    head.add(bun);
    for (const direction of [-1, 1] as const) {
      const tendril = mark(
        new Mesh(new CylinderGeometry(0.018, 0.025, 0.24, 6), material(profile.hairColor)),
        "hair-detail",
      );
      tendril.position.set(direction * 0.205, -0.035, 0.12);
      tendril.rotation.z = direction * 0.12;
      head.add(tendril);
    }
  }

  if (profile.accessory === 1) {
    const brim = new Mesh(new BoxGeometry(0.46, 0.035, 0.34), material(profile.hairColor));
    brim.position.set(0, 0.23, 0.05);
    head.add(brim);
  } else if (profile.accessory === 2) {
    const bridge = new Mesh(new BoxGeometry(0.18, 0.018, 0.018), material(0x273036));
    bridge.position.set(0, 0.035, 0.275);
    head.add(bridge);
  }
};

const addGarment = (
  root: Group,
  mesh: Mesh,
  position: readonly [number, number, number],
): Mesh => {
  mark(mesh, "garment-detail");
  mesh.position.set(...position);
  root.add(mesh);
  return mesh;
};

export const decorateCharacterBody = (
  root: Group,
  profile: CharacterProfile,
  identity: CharacterIdentity,
): void => {
  root.userData["characterGender"] = identity.gender;
  root.userData["characterAgeGroup"] = identity.ageGroup;

  const cloth = material(profile.clothingColor);
  const trim = material(profile.trouserColor);
  const collar = addGarment(
    root,
    new Mesh(new CylinderGeometry(0.255, 0.275, 0.075, 10), cloth.clone()),
    [0, 1.45, 0],
  );
  collar.scale.x = identity.gender === "female" ? 0.92 : 1;

  const hem = addGarment(
    root,
    new Mesh(
      new CylinderGeometry(
        identity.gender === "female" ? 0.31 : 0.34,
        identity.gender === "female" ? 0.37 : 0.35,
        0.09,
        10,
      ),
      cloth.clone(),
    ),
    [0, 0.61, 0],
  );

  if (identity.garmentStyle === 0) {
    const stripe = addGarment(
      root,
      new Mesh(new BoxGeometry(0.48, 0.1, 0.035), trim.clone()),
      [0, 1.04, 0.31],
    );
    stripe.rotation.z = 0.015;
  } else if (identity.garmentStyle === 1) {
    for (const direction of [-1, 1] as const) {
      const panel = addGarment(
        root,
        new Mesh(new BoxGeometry(0.2, 0.68, 0.045), cloth.clone()),
        [direction * 0.115, 1.03, 0.305],
      );
      panel.rotation.z = direction * 0.035;
    }
  } else if (identity.garmentStyle === 2) {
    const lower = addGarment(
      root,
      new Mesh(
        new CylinderGeometry(
          identity.gender === "female" ? 0.33 : 0.31,
          identity.gender === "female" ? 0.44 : 0.36,
          0.34,
          10,
        ),
        cloth.clone(),
      ),
      [0, 0.69, 0],
    );
    lower.rotation.y = 0.05;
  } else {
    const pocket = addGarment(
      root,
      new Mesh(new BoxGeometry(0.36, 0.19, 0.06), trim.clone()),
      [0, 0.88, 0.31],
    );
    pocket.rotation.x = -0.03;
    const hood = addGarment(
      root,
      new Mesh(new SphereGeometry(0.27, 10, 7), cloth.clone()),
      [0, 1.48, -0.09],
    );
    hood.scale.set(0.92, 0.55, 0.5);
  }

  const buttonMaterial = material(0xd9c8a2);
  for (let index = 0; index < 3; index += 1) {
    const button = mark(
      new Mesh(new SphereGeometry(0.025, 7, 5), buttonMaterial.clone()),
      "clothing-item",
    );
    button.position.set(0, 1.18 - index * 0.16, 0.337);
    root.add(button);
  }

  if (identity.garmentStyle === 1 || identity.garmentStyle === 3) {
    const scarf = mark(
      new Mesh(
        new CylinderGeometry(0.285, 0.25, 0.085, 10),
        material(profile.trouserColor),
      ),
      "clothing-item",
    );
    scarf.position.set(0, 1.46, 0);
    scarf.rotation.z = identity.gender === "female" ? -0.06 : 0.04;
    root.add(scarf);
  }

  const bagVariant = (profile.accessory + identity.garmentStyle) % 3;
  if (bagVariant !== 1) {
    const bag = mark(
      new Mesh(
        new BoxGeometry(
          identity.ageGroup === "child" ? 0.28 : 0.34,
          identity.ageGroup === "child" ? 0.34 : 0.42,
          0.14,
        ),
        material(profile.trouserColor),
      ),
      "bag-detail",
    );
    const side = bagVariant === 0 ? -1 : 1;
    bag.position.set(side * 0.34, 0.93, -0.17);
    bag.rotation.z = side * 0.08;
    root.add(bag);

    const strap = mark(
      new Mesh(
        new BoxGeometry(0.045, 0.95, 0.035),
        material(profile.trouserColor),
      ),
      "bag-detail",
    );
    strap.position.set(-side * 0.13, 1.14, 0.05);
    strap.rotation.z = side * 0.48;
    root.add(strap);
  }

  if (identity.garmentStyle === 2) {
    for (const direction of [-1, 1] as const) {
      const lapel = mark(
        new Mesh(new BoxGeometry(0.14, 0.36, 0.04), cloth.clone()),
        "clothing-item",
      );
      lapel.position.set(direction * 0.09, 1.23, 0.325);
      lapel.rotation.z = direction * 0.26;
      root.add(lapel);
    }
  }

  // Garment geometry stays attached to the character root so child scaling and
  // the seeded body proportions apply to clothing and anatomy together.
  hem.rotation.y = identity.garmentStyle * 0.015;
};

export const decorateCharacter = (
  root: Group,
  head: Mesh,
  profile: CharacterProfile,
  index: number,
  includeMouth = true,
): void => {
  const identity = characterIdentityFor(index, profile);
  decorateCharacterBody(root, profile, identity);
  decorateCharacterHead(head, profile, identity, includeMouth);
};

export const decorateSellerExpression = (
  eyebrows: readonly [Group, Group],
  mouth: readonly [Group, Group],
): void => {
  const expressionMaterial = material(0x3a2a25);
  for (const brow of eyebrows) {
    const mesh = mark(
      new Mesh(
        new BoxGeometry(0.11, 0.018, 0.018),
        expressionMaterial.clone(),
      ),
      "face-expression",
    );
    brow.add(mesh);
  }
  for (const half of mouth) {
    const mesh = mark(
      new Mesh(
        new BoxGeometry(0.12, 0.018, 0.018),
        expressionMaterial.clone(),
      ),
      "face-expression",
    );
    half.add(mesh);
  }
};


export type DecoratableCharacter = Readonly<{
  root: Group;
  head: Mesh;
  profile: CharacterProfile;
}>;

export const decorateSceneCharacters = (
  customers: readonly DecoratableCharacter[],
  buyers: readonly DecoratableCharacter[],
  seller: DecoratableCharacter,
  eyebrows: readonly [Group, Group],
  mouth: readonly [Group, Group],
): void => {
  customers.forEach((person, index) => {
    decorateCharacter(person.root, person.head, person.profile, index);
  });
  buyers.forEach((person, index) => {
    decorateCharacter(
      person.root,
      person.head,
      person.profile,
      index + customers.length,
    );
  });
  decorateCharacter(seller.root, seller.head, seller.profile, 10_001, false);
  decorateSellerExpression(eyebrows, mouth);
};
