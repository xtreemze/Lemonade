import type { Group, Object3D } from "three";
import { BoxGeometry, CylinderGeometry, Mesh, MeshStandardMaterial, SphereGeometry } from "three";

import type { CharacterProfile } from "./characters.js";

export type CharacterGender = "male" | "female";
export type CharacterAgeGroup = "adult" | "child";
export type CharacterExpression = "smile" | "neutral" | "focused" | "curious";
export type CharacterIdentity = Readonly<{
  gender: CharacterGender;
  ageGroup: CharacterAgeGroup;
  garmentStyle: 0 | 1 | 2 | 3;
  hairDetail: 0 | 1 | 2 | 3;
  bagStyle: 0 | 1 | 2 | 3;
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
  const ageGroup = actorIndex >= 10_000 || Math.floor(actorIndex / 2) % 3 !== 2 ? "adult" : "child";
  const bagStyle =
    actorIndex >= 10_000
      ? 0
      : ageGroup === "child"
        ? (((actorIndex % 3) + 1) as 1 | 2 | 3)
        : (((identityIndex + actorIndex) & 3) as 0 | 1 | 2 | 3);
  return Object.freeze({
    gender: actorIndex % 2 === 0 ? "male" : "female",
    ageGroup,
    garmentStyle: identityIndex as 0 | 1 | 2 | 3,
    hairDetail: ((identityIndex + profile.hairStyle + actorIndex) & 3) as 0 | 1 | 2 | 3,
    bagStyle,
    expression: expressions[(identityIndex + profile.accessory) & 3] ?? "neutral",
  });
};

const mark = <T extends Object3D>(object: T, role: string): T => {
  object.userData.sceneRole = role;
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

  const eyeWhiteMaterial = material(0xf5_f2_e8);
  const pupilMaterial = material(0x26_32_38);
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

  const nose = new Mesh(new SphereGeometry(0.038, 8, 6), material(profile.skinColor));
  nose.scale.set(0.8, 1, 1.25);
  nose.position.set(0, -0.015, 0.258);
  head.add(nose);

  const expressionColor = 0x4d_30_2d;
  const browTilt =
    identity.expression === "curious"
      ? 0.16
      : identity.expression === "focused"
        ? -0.13
        : identity.expression === "smile"
          ? 0.06
          : 0;
  addFaceBar(head, 0.075, [-profile.eyeSpacing, 0.112, 0.264], browTilt, expressionColor);
  addFaceBar(head, 0.075, [profile.eyeSpacing, 0.112, 0.264], -browTilt, expressionColor);

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
    addFaceBar(head, 0.07, [-0.035, mouthY, 0.266], -mouthTilt, 0x8b_4c_48);
    addFaceBar(head, 0.07, [0.035, mouthY, 0.266], mouthTilt, 0x8b_4c_48);
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

  if (profile.hairStyle === 1) {
    for (const direction of [-1, 1] as const) {
      const sideHair = mark(
        new Mesh(new BoxGeometry(0.085, 0.26, 0.18), material(profile.hairColor)),
        "hair-cover",
      );
      sideHair.position.set(direction * 0.235, 0.035, -0.025);
      sideHair.rotation.z = direction * 0.08;
      head.add(sideHair);
    }
  } else if (profile.hairStyle === 2) {
    const fringe = mark(
      new Mesh(new BoxGeometry(0.42, 0.1, 0.12), material(profile.hairColor)),
      "hair-cover",
    );
    fringe.position.set(0, 0.13, 0.205);
    fringe.rotation.z = identity.gender === "female" ? -0.08 : 0.04;
    head.add(fringe);
  } else if (profile.hairStyle === 3) {
    const bun = mark(
      new Mesh(new SphereGeometry(0.12, 9, 7), material(profile.hairColor)),
      "hair-cover",
    );
    bun.position.set(identity.gender === "female" ? 0.14 : -0.12, 0.255, -0.12);
    head.add(bun);
  }

  const hairMaterial = material(profile.hairColor);
  if (identity.hairDetail === 0) {
    for (const offset of [-0.11, 0, 0.11]) {
      const tuft = mark(
        new Mesh(new SphereGeometry(0.075, 8, 6), hairMaterial.clone()),
        "hair-detail",
      );
      tuft.scale.set(0.78, 1.28, 0.72);
      tuft.position.set(offset, 0.285 - Math.abs(offset) * 0.22, 0.045);
      head.add(tuft);
    }
  } else if (identity.hairDetail === 1) {
    for (const direction of [-1, 1] as const) {
      const lock = mark(
        new Mesh(new CylinderGeometry(0.035, 0.05, 0.3, 7), hairMaterial.clone()),
        "hair-detail",
      );
      lock.position.set(direction * 0.235, 0.015, 0.02);
      lock.rotation.z = direction * 0.08;
      head.add(lock);
    }
  } else if (identity.hairDetail === 2) {
    const ponytail = mark(
      new Mesh(new SphereGeometry(0.12, 9, 7), hairMaterial.clone()),
      "hair-detail",
    );
    ponytail.scale.set(0.72, 1.45, 0.72);
    ponytail.position.set(identity.gender === "female" ? 0.15 : -0.13, 0.03, -0.255);
    ponytail.rotation.z = identity.gender === "female" ? -0.22 : 0.22;
    head.add(ponytail);
  } else {
    for (const direction of [-1, 1] as const) {
      const curl = mark(
        new Mesh(new SphereGeometry(0.095, 9, 7), hairMaterial.clone()),
        "hair-detail",
      );
      curl.scale.set(0.82, 1.12, 0.8);
      curl.position.set(direction * 0.19, 0.18, -0.15);
      head.add(curl);
    }
  }

  if (profile.accessory === 1) {
    const brim = new Mesh(new BoxGeometry(0.46, 0.035, 0.34), material(profile.hairColor));
    brim.position.set(0, 0.23, 0.05);
    head.add(brim);
  } else if (profile.accessory === 2) {
    const bridge = new Mesh(new BoxGeometry(0.18, 0.018, 0.018), material(0x27_30_36));
    bridge.position.set(0, 0.035, 0.275);
    head.add(bridge);
  }
};

const addGarment = (root: Group, mesh: Mesh, position: readonly [number, number, number]): Mesh => {
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
  root.userData.characterGender = identity.gender;
  root.userData.characterAgeGroup = identity.ageGroup;

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
      const panel = addGarment(root, new Mesh(new BoxGeometry(0.2, 0.68, 0.045), cloth.clone()), [
        direction * 0.115,
        1.03,
        0.305,
      ]);
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

  const accent = material(
    identity.garmentStyle % 2 === 0 ? profile.trouserColor : profile.clothingColor,
  );
  if (identity.garmentStyle === 0 || identity.garmentStyle === 3) {
    const belt = addGarment(
      root,
      new Mesh(new BoxGeometry(0.54, 0.055, 0.05), accent.clone()),
      [0, 0.78, 0.29],
    );
    belt.rotation.z = -0.01;
  }
  if (identity.garmentStyle === 1 || identity.garmentStyle === 3) {
    for (const direction of [-1, 1] as const) {
      const cuff = addGarment(
        root,
        new Mesh(new CylinderGeometry(0.09, 0.09, 0.08, 8), accent.clone()),
        [direction * 0.35, 1.08, 0],
      );
      cuff.rotation.z = Math.PI / 2;
    }
  }
  if (identity.garmentStyle === 2) {
    const scarf = addGarment(
      root,
      new Mesh(new CylinderGeometry(0.27, 0.29, 0.08, 10), accent.clone()),
      [0, 1.39, 0],
    );
    scarf.rotation.y = 0.08;
  }

  const bagMaterial = material(profile.trouserColor);
  if (identity.bagStyle === 1) {
    const bag = mark(
      new Mesh(new BoxGeometry(0.42, 0.52, 0.18), bagMaterial.clone()),
      "character-bag",
    );
    bag.position.set(0, 1.02, -0.31);
    root.add(bag);
    for (const direction of [-1, 1] as const) {
      const strap = mark(
        new Mesh(new BoxGeometry(0.045, 0.72, 0.035), bagMaterial.clone()),
        "character-bag",
      );
      strap.position.set(direction * 0.2, 1.14, -0.16);
      strap.rotation.z = direction * 0.08;
      root.add(strap);
    }
  } else if (identity.bagStyle === 2) {
    const strap = mark(
      new Mesh(new BoxGeometry(0.045, 0.92, 0.035), bagMaterial.clone()),
      "character-bag",
    );
    strap.position.set(0, 1.12, 0.31);
    strap.rotation.z = -0.42;
    root.add(strap);
    const satchel = mark(
      new Mesh(new BoxGeometry(0.32, 0.28, 0.12), bagMaterial.clone()),
      "character-bag",
    );
    satchel.position.set(0.28, 0.78, 0.31);
    root.add(satchel);
  } else if (identity.bagStyle === 3) {
    const tote = mark(
      new Mesh(new BoxGeometry(0.34, 0.38, 0.1), bagMaterial.clone()),
      "character-bag",
    );
    tote.position.set(0.43, 0.72, 0.02);
    root.add(tote);
    const handle = mark(
      new Mesh(new CylinderGeometry(0.035, 0.035, 0.34, 7), bagMaterial.clone()),
      "character-bag",
    );
    handle.position.set(0.43, 1.01, 0.02);
    handle.rotation.z = Math.PI / 2;
    root.add(handle);
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

export type SellerGestureApplier = (
  torso: Mesh,
  head: Mesh,
  leftArm: Group,
  rightArm: Group,
  progress: number,
  confidence: number,
) => void;

export const applySellerConfidenceGesture: SellerGestureApplier = (
  torso,
  head,
  leftArm,
  rightArm,
  progress,
  confidence,
): void => {
  const closeup = Math.min(1, Math.max(0, progress));
  const gestureProgress = Math.min(1, Math.max(0, (closeup - 0.32) / 0.68));
  const strength = gestureProgress * gestureProgress * (3 - 2 * gestureProgress);
  const normalizedConfidence = Math.min(1, Math.max(0, confidence / 5));
  const mix = (low: number, high: number): number => low + (high - low) * normalizedConfidence;

  torso.position.y += mix(-0.035, 0.055) * strength;
  head.rotation.x += mix(0.075, -0.05) * strength;
  const armLift = mix(0.08, -0.62) * strength;
  const armSpread = mix(0.06, 0.5) * strength;
  leftArm.rotation.x += armLift;
  rightArm.rotation.x += armLift;
  leftArm.rotation.z = -armSpread;
  rightArm.rotation.z = armSpread;
};

export const decorateSellerExpression = (
  eyebrows: readonly [Group, Group],
  mouth: readonly [Group, Group],
): void => {
  const expressionMaterial = material(0x3a_2a_25);
  for (const brow of eyebrows) {
    const mesh = mark(
      new Mesh(new BoxGeometry(0.11, 0.018, 0.018), expressionMaterial.clone()),
      "face-expression",
    );
    brow.add(mesh);
  }
  for (const half of mouth) {
    const mesh = mark(
      new Mesh(new BoxGeometry(0.12, 0.018, 0.018), expressionMaterial.clone()),
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
    decorateCharacter(person.root, person.head, person.profile, index + customers.length);
  });
  decorateCharacter(seller.root, seller.head, seller.profile, 10_001, false);
  decorateSellerExpression(eyebrows, mouth);
};
