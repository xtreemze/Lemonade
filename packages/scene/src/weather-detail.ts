import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
} from "three";

import { WEATHER_BACKDROP_LAYOUT } from "./weather-layout.js";

type WeatherKind = "sunny" | "cloudy" | "hot-and-dry" | "thunderstorm";
type WeatherGroups = Readonly<Record<WeatherKind, Group>>;

export type WeatherDetailController = Readonly<{
  update(kind: WeatherKind, elapsedMs: number, durationMs: number): void;
}>;

const weatherMaterial = (
  color: number,
  emissive = 0x000000,
  emissiveIntensity = 0,
): MeshStandardMaterial =>
  new MeshStandardMaterial({
    color,
    roughness: 0.88,
    emissive,
    emissiveIntensity,
  });

const addCloud = (parent: Group, color: number, density = 1): void => {
  const cloudMaterial = weatherMaterial(color);
  for (const [radius, x, y, z] of [
    [0.72, -0.78, 0, 0],
    [0.84, -0.08, 0.22, 0],
    [0.74, 0.72, 0.02, 0],
    [0.62, -0.22, -0.18, 0.18],
    [0.58, 0.3, -0.16, 0.12],
  ] as const) {
    const puff = new Mesh(
      new SphereGeometry(radius * density, 20, 16),
      cloudMaterial.clone(),
    );
    puff.position.set(x, y, z);
    parent.add(puff);
  }
};

const addSun = (parent: Group, radius: number): void => {
  parent.add(
    new Mesh(
      new SphereGeometry(radius, 24, 18),
      weatherMaterial(0xffd447, 0xffc93a, 0.55),
    ),
  );
  const halo = new Mesh(
    new SphereGeometry(radius * 1.18, 24, 18),
    new MeshStandardMaterial({
      color: 0xffe27a,
      emissive: 0xffd447,
      emissiveIntensity: 0.45,
      roughness: 1,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    }),
  );
  parent.add(halo);
};

const flashCenters = [0.18, 0.47, 0.76] as const;

export const lightningFlashAt = (
  elapsedMs: number,
  durationMs: number,
): number => {
  const duration = Math.max(1, Number.isFinite(durationMs) ? durationMs : 1);
  const progress =
    Math.min(duration, Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0)) /
    duration;
  let flash = 0;
  for (const center of flashCenters) {
    const distance = Math.abs(progress - center);
    const primary = Math.max(0, 1 - distance / 0.018);
    const echo = Math.max(0, 1 - Math.abs(progress - (center + 0.028)) / 0.01) * 0.42;
    flash = Math.max(flash, primary, echo);
  }
  return Math.min(1, flash);
};

export const populateWeatherObjects = (
  weather: WeatherGroups,
): WeatherDetailController => {
  for (const [kind, group] of Object.entries(weather) as [WeatherKind, Group][]) {
    const layout = WEATHER_BACKDROP_LAYOUT[kind];
    group.position.set(...layout.position);
    group.scale.setScalar(layout.scale);
  }

  addSun(weather.sunny, 0.82);

  const partlySun = new Group();
  partlySun.position.set(0.88, 0.5, -0.25);
  addSun(partlySun, 0.62);
  weather["hot-and-dry"].add(partlySun);

  const partlyCloud = new Group();
  partlyCloud.position.set(-0.35, 0, 0.15);
  addCloud(partlyCloud, 0xd7e0df);
  weather["hot-and-dry"].add(partlyCloud);

  addCloud(weather.cloudy, 0xd7e0df);

  const stormCloudA = new Group();
  addCloud(stormCloudA, 0x596a79, 1.14);
  stormCloudA.position.set(-0.45, 0.16, 0);
  weather.thunderstorm.add(stormCloudA);

  const stormCloudB = new Group();
  addCloud(stormCloudB, 0x485968, 0.9);
  stormCloudB.position.set(1.05, -0.12, 0.25);
  weather.thunderstorm.add(stormCloudB);

  const boltMaterial = weatherMaterial(0xf7ec9b, 0xffffff, 0.4);
  const bolt = new Mesh(
    new CylinderGeometry(0, 0.13, 1.25, 6),
    boltMaterial,
  );
  bolt.position.set(0.18, -1.2, 0.42);
  bolt.rotation.z = 0.32;
  bolt.userData["sceneRole"] = "lightning-bolt";
  weather.thunderstorm.add(bolt);

  const lightning = new PointLight(0xeaf3ff, 0, 150, 1.35);
  lightning.position.set(0.1, -0.25, 1.4);
  lightning.userData["sceneRole"] = "lightning-flash";
  weather.thunderstorm.add(lightning);

  for (let index = 0; index < 7; index += 1) {
    const drop = new Mesh(
      new CylinderGeometry(0.02, 0.02, 0.62, 8),
      weatherMaterial(0x7dc7df),
    );
    drop.position.set(-1.05 + index * 0.35, -1.25 - (index % 2) * 0.45, 0.15);
    drop.rotation.z = -0.18;
    weather.thunderstorm.add(drop);
  }

  const update = (
    kind: WeatherKind,
    elapsedMs: number,
    durationMs: number,
  ): void => {
    const flash = kind === "thunderstorm"
      ? lightningFlashAt(elapsedMs, durationMs)
      : 0;
    bolt.visible = flash > 0.08;
    boltMaterial.emissiveIntensity = 0.4 + flash * 4.2;
    lightning.intensity = flash * 7.5;
    stormCloudA.rotation.z = Math.sin(elapsedMs * 0.00022) * 0.018;
    stormCloudB.rotation.z = -Math.sin(elapsedMs * 0.00018 + 0.8) * 0.014;
  };

  update("sunny", 0, 1);
  return Object.freeze({ update });
};
