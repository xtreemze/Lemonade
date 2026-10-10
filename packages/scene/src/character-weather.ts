import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  SphereGeometry,
} from "three";

export type CharacterPresentationWeather =
  | "sunny"
  | "cloudy"
  | "hot-and-dry"
  | "thunderstorm";

export type CharacterWeatherPresentation = Readonly<{
  headAccessory: "none" | "sunglasses" | "sun-hat" | "rain-hood";
  bodyLayer: "none" | "raincoat";
  carriedAccessory: "none" | "umbrella" | "newspaper";
  gaitRate: number;
  hunch: number;
}>;

export type CharacterWeatherRoots = Readonly<{
  head: Group;
  body: Group;
  carry: Group;
}>;

const mix = (seed: number, salt: number): number => {
  let value = ((seed >>> 0) ^ Math.imul(salt >>> 0, 0x9e_37_79_b1)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21_f0_aa_ad);
  value = Math.imul(value ^ (value >>> 15), 0x73_5a_2d_97);
  return (value ^ (value >>> 15)) >>> 0;
};

export const characterWeatherPresentationFor = (
  visualSeedValue: number,
  weather: CharacterPresentationWeather,
): CharacterWeatherPresentation => {
  const visualSeed = (Number.isFinite(visualSeedValue) ? Math.trunc(visualSeedValue) : 0) >>> 0;
  const selector = mix(visualSeed, 0x57_ea_7e_12);

  if (weather === "cloudy") {
    return Object.freeze({
      headAccessory: "none",
      bodyLayer: "none",
      carriedAccessory: "none",
      gaitRate: 1,
      hunch: 0,
    });
  }

  if (weather === "sunny") {
    const choice = selector % 5;
    return Object.freeze({
      headAccessory: choice === 0 ? "sun-hat" : choice <= 2 ? "sunglasses" : "none",
      bodyLayer: "none",
      carriedAccessory: "none",
      gaitRate: 0.96,
      hunch: 0,
    });
  }

  if (weather === "hot-and-dry") {
    return Object.freeze({
      headAccessory: selector % 3 === 0 ? "sun-hat" : "sunglasses",
      bodyLayer: "none",
      carriedAccessory: "none",
      gaitRate: 0.94,
      hunch: 0,
    });
  }

  return Object.freeze({
    headAccessory: selector % 3 === 0 ? "rain-hood" : "none",
    bodyLayer: "raincoat",
    carriedAccessory: selector % 4 === 0 ? "newspaper" : "umbrella",
    gaitRate: 1.12,
    hunch: 0.1,
  });
};

const material = (color: number): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, flatShading: false, roughness: 0.86 });

const mark = <T extends Object3D>(object: T, role: string): T => {
  object.userData["sceneRole"] = role;
  return object;
};

const disposeTree = (root: Object3D): void => {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const entry of materials) {
      entry.dispose();
    }
  });
};

const clearRoot = (root: Group): void => {
  for (const child of [...root.children]) {
    root.remove(child);
    disposeTree(child);
  }
};

const addHeadAccessory = (
  root: Group,
  presentation: CharacterWeatherPresentation,
): void => {
  if (presentation.headAccessory === "sunglasses") {
    const lensMaterial = material(0x20_2a_31);
    for (const direction of [-1, 1] as const) {
      const lens = mark(
        new Mesh(new BoxGeometry(0.105, 0.055, 0.025), lensMaterial.clone()),
        "weather-sunglasses",
      );
      lens.position.set(direction * 0.09, 0.045, 0.286);
      root.add(lens);
    }
    const bridge = mark(
      new Mesh(new BoxGeometry(0.075, 0.015, 0.018), lensMaterial.clone()),
      "weather-sunglasses",
    );
    bridge.position.set(0, 0.045, 0.286);
    root.add(bridge);
    lensMaterial.dispose();
  } else if (presentation.headAccessory === "sun-hat") {
    const hatMaterial = material(0xd8_bd_74);
    const brim = mark(
      new Mesh(new CylinderGeometry(0.34, 0.34, 0.035, 14), hatMaterial.clone()),
      "weather-sun-hat",
    );
    brim.position.y = 0.29;
    root.add(brim);
    const crown = mark(
      new Mesh(new CylinderGeometry(0.2, 0.23, 0.18, 12), hatMaterial.clone()),
      "weather-sun-hat",
    );
    crown.position.y = 0.38;
    root.add(crown);
    hatMaterial.dispose();
  } else if (presentation.headAccessory === "rain-hood") {
    const hood = mark(
      new Mesh(new SphereGeometry(0.32, 12, 8), material(0x43_5d_78)),
      "weather-rain-hood",
    );
    hood.scale.set(1.06, 1.08, 0.72);
    hood.position.set(0, 0.04, -0.09);
    root.add(hood);
  }
};

const addBodyLayer = (
  root: Group,
  presentation: CharacterWeatherPresentation,
): void => {
  if (presentation.bodyLayer !== "raincoat") {
    return;
  }
  const coat = mark(
    new Mesh(new CylinderGeometry(0.34, 0.42, 0.92, 12), material(0x4e_79_91)),
    "weather-raincoat",
  );
  coat.position.set(0, -0.1, 0);
  root.add(coat);
};

const addCarriedAccessory = (
  root: Group,
  presentation: CharacterWeatherPresentation,
): void => {
  if (presentation.carriedAccessory === "umbrella") {
    const handle = mark(
      new Mesh(new CylinderGeometry(0.018, 0.018, 1.25, 8), material(0x38_3d_42)),
      "weather-umbrella",
    );
    handle.position.set(0.05, 0.55, 0);
    root.add(handle);

    const canopy = mark(
      new Mesh(new SphereGeometry(0.55, 14, 8), material(0x5a_6f_9d)),
      "weather-umbrella",
    );
    canopy.scale.set(1, 0.28, 1);
    canopy.position.set(0.05, 1.18, 0);
    root.add(canopy);
  } else if (presentation.carriedAccessory === "newspaper") {
    const paper = mark(
      new Mesh(new BoxGeometry(0.48, 0.34, 0.025), material(0xe6_e0_ca)),
      "weather-newspaper",
    );
    paper.position.set(0.16, 0.16, 0.08);
    paper.rotation.z = -0.18;
    root.add(paper);
  }
};

export const syncCharacterWeatherPresentation = (
  roots: CharacterWeatherRoots,
  visualSeedValue: number,
  weather: CharacterPresentationWeather,
): CharacterWeatherPresentation => {
  const visualSeed = (Number.isFinite(visualSeedValue) ? Math.trunc(visualSeedValue) : 0) >>> 0;
  const cacheKey = `${String(visualSeed)}:${weather}`;
  const presentation = characterWeatherPresentationFor(visualSeed, weather);
  if (roots.body.userData["weatherPresentationKey"] === cacheKey) {
    return presentation;
  }

  clearRoot(roots.head);
  clearRoot(roots.body);
  clearRoot(roots.carry);

  addHeadAccessory(roots.head, presentation);
  addBodyLayer(roots.body, presentation);
  addCarriedAccessory(roots.carry, presentation);

  roots.body.userData["weatherPresentationKey"] = cacheKey;
  roots.head.userData["weatherPresentationKey"] = cacheKey;
  roots.carry.userData["weatherPresentationKey"] = cacheKey;
  return presentation;
};
