import {
  BoxGeometry,
  CylinderGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";
import type { Group, Object3D } from "three";

import type { CharacterProfile } from "./characters.js";

const material = (color: number): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, flatShading: false, roughness: 0.88 });

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
    new Mesh(new BoxGeometry(width, 0.018, 0.018), material(color)),
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
    profile.expression === "curious"
      ? 0.16
      : profile.expression === "focused"
        ? -0.13
        : profile.expression === "smile"
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
      profile.expression === "smile"
        ? 0.24
        : profile.expression === "focused"
          ? -0.14
          : profile.expression === "curious"
            ? 0.08
            : 0;
    const mouthY = profile.expression === "focused" ? -0.098 : -0.105;
    addFaceBar(head, 0.07, [-0.035, mouthY, 0.266], -mouthTilt, 0x8b4c48);
    addFaceBar(head, 0.07, [0.035, mouthY, 0.266], mouthTilt, 0x8b4c48);
  }

  // Every hairstyle starts with a full crown shell. Style-specific geometry sits
  // on top of it, preventing the scalp pinhole that appeared with partial caps.
  const crown = mark(
    new Mesh(new SphereGeometry(0.282, 12, 8), material(profile.hairColor)),
    "hair-cover",
  );
  crown.scale.set(1.035, 0.52, 1.025);
  crown.position.y = 0.145;
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
    fringe.rotation.z = profile.gender === "female" ? -0.08 : 0.04;
    head.add(fringe);
  } else if (profile.hairStyle === 3) {
    const bun = mark(
      new Mesh(new SphereGeometry(0.12, 9, 7), material(profile.hairColor)),
      "hair-cover",
    );
    bun.position.set(
      profile.gender === "female" ? 0.14 : -0.12,
      0.255,
      -0.12,
    );
    head.add(bun);
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
): void => {
  root.userData["characterGender"] = profile.gender;
  root.userData["characterAgeGroup"] = profile.ageGroup;

  const cloth = material(profile.clothingColor);
  const trim = material(profile.trouserColor);
  const collar = addGarment(
    root,
    new Mesh(new CylinderGeometry(0.255, 0.275, 0.075, 10), cloth.clone()),
    [0, 1.45, 0],
  );
  collar.scale.x = profile.gender === "female" ? 0.92 : 1;

  const hem = addGarment(
    root,
    new Mesh(
      new CylinderGeometry(
        profile.gender === "female" ? 0.31 : 0.34,
        profile.gender === "female" ? 0.37 : 0.35,
        0.09,
        10,
      ),
      cloth.clone(),
    ),
    [0, 0.61, 0],
  );

  if (profile.garmentStyle === 0) {
    const stripe = addGarment(
      root,
      new Mesh(new BoxGeometry(0.48, 0.1, 0.035), trim.clone()),
      [0, 1.04, 0.31],
    );
    stripe.rotation.z = 0.015;
  } else if (profile.garmentStyle === 1) {
    for (const direction of [-1, 1] as const) {
      const panel = addGarment(
        root,
        new Mesh(new BoxGeometry(0.2, 0.68, 0.045), cloth.clone()),
        [direction * 0.115, 1.03, 0.305],
      );
      panel.rotation.z = direction * 0.035;
    }
  } else if (profile.garmentStyle === 2) {
    const lower = addGarment(
      root,
      new Mesh(
        new CylinderGeometry(
          profile.gender === "female" ? 0.33 : 0.31,
          profile.gender === "female" ? 0.44 : 0.36,
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

  // Garment geometry stays attached to the character root so child scaling and
  // the seeded body proportions apply to clothing and anatomy together.
  hem.rotation.y = profile.garmentStyle * 0.015;
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
