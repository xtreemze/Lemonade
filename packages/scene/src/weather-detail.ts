import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";
import type {
  DirectionalLight,
  HemisphereLight,
  WebGLRenderer,
} from "three";

import {
  CLOUDY_TOWN_CLOUD_LAYOUT,
  WEATHER_BACKDROP_LAYOUT,
} from "./weather-layout.js";

export type WeatherKind = "sunny" | "cloudy" | "hot-and-dry" | "thunderstorm";
export type WeatherPhase = "idle" | "simulation" | "forecast";
type WeatherGroups = Readonly<Record<WeatherKind, Group>>;

export type BusinessDayFrame = Readonly<{
  progress: number;
  skyColor: number;
  hemisphereIntensity: number;
  sunlightIntensity: number;
  sunlightColor: number;
  sunPosition: readonly [number, number, number];
}>;

export type WeatherDetailController = Readonly<{
  update(
    weather: WeatherKind,
    phase: WeatherPhase,
    elapsedMs: number,
    durationMs: number,
    reducedMotion: boolean,
  ): void;
}>;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const lerp = (start: number, end: number, progress: number): number =>
  start + (end - start) * progress;

const blendHex = (from: number, to: number, progress: number): number => {
  const p = clamp01(progress);
  const channel = (shift: number): number =>
    Math.round(lerp((from >> shift) & 0xff, (to >> shift) & 0xff, p));
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
};

const DAY_SKY: Readonly<Record<WeatherKind, number>> = Object.freeze({
  sunny: 0x79cbe0,
  cloudy: 0xaabcc3,
  "hot-and-dry": 0x9fc9d3,
  thunderstorm: 0x536471,
});

const NIGHT_SKY: Readonly<Record<WeatherKind, number>> = Object.freeze({
  sunny: 0x22364d,
  cloudy: 0x273845,
  "hot-and-dry": 0x29394a,
  thunderstorm: 0x182631,
});

const WEATHER_LIGHT_FACTOR: Readonly<Record<WeatherKind, number>> = Object.freeze({
  sunny: 1,
  cloudy: 0.72,
  "hot-and-dry": 1.08,
  thunderstorm: 0.52,
});

export const businessDayProgressAt = (
  phase: WeatherPhase,
  elapsedMs: number,
  durationMs: number,
): number => {
  if (phase === "forecast") return 0.04;
  if (phase !== "simulation") return 0.56;
  const duration = Math.max(1, Number.isFinite(durationMs) ? durationMs : 1);
  return 0.06 + clamp01(Math.max(0, elapsedMs) / duration) * 0.9;
};

export const businessDayFrameAt = (
  weather: WeatherKind,
  phase: WeatherPhase,
  elapsedMs: number,
  durationMs: number,
): BusinessDayFrame => {
  const progress = businessDayProgressAt(phase, elapsedMs, durationMs);
  const dawn = weather === "thunderstorm" ? 0x465765 : 0x8fa9bc;
  const day = DAY_SKY[weather];
  const sunset = weather === "thunderstorm" ? 0x434b59 : 0xd58a6c;
  const night = NIGHT_SKY[weather];

  let skyColor = day;
  if (progress < 0.22) {
    skyColor = blendHex(dawn, day, progress / 0.22);
  } else if (progress > 0.62 && progress < 0.82) {
    skyColor = blendHex(day, sunset, (progress - 0.62) / 0.2);
  } else if (progress >= 0.82) {
    skyColor = blendHex(sunset, night, (progress - 0.82) / 0.18);
  }

  const daylightArc = Math.max(0, Math.sin(progress * Math.PI));
  const weatherFactor = WEATHER_LIGHT_FACTOR[weather];
  const sunlightIntensity = (0.2 + daylightArc * 1.75) * weatherFactor;
  const hemisphereIntensity =
    (0.52 + Math.sqrt(daylightArc) * 1.32) *
    (weather === "thunderstorm" ? 0.78 : weather === "cloudy" ? 0.9 : 1);

  const sunlightColor =
    progress < 0.22
      ? blendHex(0xffb875, 0xfff0c9, progress / 0.22)
      : progress < 0.68
        ? 0xfff0c9
        : blendHex(0xffc47f, 0x90a8cf, (progress - 0.68) / 0.28);

  return Object.freeze({
    progress,
    skyColor,
    hemisphereIntensity,
    sunlightIntensity,
    sunlightColor,
    sunPosition: Object.freeze([
      lerp(-12, 12, progress),
      2.8 + daylightArc * 12.5,
      7,
    ] as const),
  });
};

const flashPulse = (progress: number, center: number, width: number): number => {
  const distance = Math.abs(progress - center);
  if (distance >= width) return 0;
  const normalized = 1 - distance / width;
  return normalized * normalized;
};

export const lightningFlashAt = (
  elapsedMs: number,
  durationMs: number,
): number => {
  const duration = Math.max(1, Number.isFinite(durationMs) ? durationMs : 1);
  const progress = clamp01(Math.max(0, elapsedMs) / duration);
  return Math.max(
    flashPulse(progress, 0.2, 0.022),
    flashPulse(progress, 0.235, 0.012) * 0.62,
    flashPulse(progress, 0.57, 0.026),
    flashPulse(progress, 0.78, 0.018),
    flashPulse(progress, 0.805, 0.01) * 0.48,
  );
};

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

const addCloud = (parent: Group, color: number): void => {
  const cloudMaterial = weatherMaterial(color);
  for (const [radius, x, y, z] of [
    [0.72, -0.78, 0, 0],
    [0.84, -0.08, 0.22, 0],
    [0.74, 0.72, 0.02, 0],
    [0.62, -0.22, -0.18, 0.18],
    [0.58, 0.3, -0.16, 0.12],
  ] as const) {
    const puff = new Mesh(new SphereGeometry(radius, 20, 16), cloudMaterial.clone());
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

export const populateWeatherObjects = (
  weather: WeatherGroups,
  renderer: WebGLRenderer,
  hemisphere: HemisphereLight,
  sunlight: DirectionalLight,
): WeatherDetailController => {
  const origins: Record<WeatherKind, number> = {
    sunny: 0,
    cloudy: 0,
    "hot-and-dry": 0,
    thunderstorm: 0,
  };

  for (const [kind, group] of Object.entries(weather) as [WeatherKind, Group][]) {
    const layout = WEATHER_BACKDROP_LAYOUT[kind];
    group.position.set(...layout.position);
    group.scale.setScalar(layout.scale);
    origins[kind] = layout.position[0];
  }

  const sunContainer = new Group();
  addSun(sunContainer, 0.82);
  weather.sunny.add(sunContainer);

  const partlySun = new Group();
  partlySun.userData["sceneRole"] = "partly-sun";
  partlySun.position.set(0, 0.8, -2);
  addSun(partlySun, 0.62);
  weather["hot-and-dry"].add(partlySun);

  const partlyCloudGroup = new Group();
  const cloudPositions = [
    { position: [-3.5, 1.8, -0.2] as const, scale: 0.85 },
    { position: [-2.2, 1.2, -0.2] as const, scale: 0.95 },
    { position: [1.8, 1.6, -0.2] as const, scale: 0.88 },
  ] as const;
  for (const [index, baseLayout] of cloudPositions.entries()) {
    const partlyCloud = new Group();
    partlyCloud.userData["sceneRole"] = `partly-cloud-${index}`;
    partlyCloud.position.set(
      baseLayout.position[0],
      baseLayout.position[1],
      baseLayout.position[2],
    );
    partlyCloud.scale.setScalar(baseLayout.scale);
    addCloud(partlyCloud, 0xd7e0df);
    partlyCloudGroup.add(partlyCloud);
  }
  weather["hot-and-dry"].add(partlyCloudGroup);

  addCloud(weather.cloudy, 0xd7e0df);

  const cloudyTownClouds = CLOUDY_TOWN_CLOUD_LAYOUT.slice(0, 5).map((layout, index) => {
    const cloud = new Group();
    cloud.userData["sceneRole"] = "town-cloud";
    cloud.userData["driftPhase"] = layout.driftPhase;
    cloud.userData["baseX"] = layout.position[0];
    addCloud(cloud, index % 2 === 0 ? 0xcbd7d7 : 0xd5dddd);
    cloud.position.set(layout.position[0], layout.position[1], layout.position[2]);
    cloud.scale.setScalar(layout.scale);
    weather.cloudy.add(cloud);
    return cloud;
  });

  const thunderstormClouds = [
    { position: [-1.5, 1.5, -0.3] as const, scale: 1.2, driftPhase: 0 },
    { position: [0, 0.5, -0.5] as const, scale: 1, driftPhase: 1.5 },
    { position: [1.5, 1.8, -0.2] as const, scale: 1.1, driftPhase: 3 },
  ].map((layout) => {
    const cloud = new Group();
    cloud.userData["turbulentCloud"] = true;
    cloud.userData["driftPhase"] = layout.driftPhase;
    cloud.userData["baseX"] = layout.position[0];
    cloud.userData["baseY"] = layout.position[1];
    cloud.userData["baseZ"] = layout.position[2];
    addCloud(cloud, 0x657786);
    cloud.position.set(layout.position[0], layout.position[1], layout.position[2]);
    cloud.scale.setScalar(layout.scale);
    weather.thunderstorm.add(cloud);
    return cloud;
  });

  const lightning = new Group();
  lightning.userData["sceneRole"] = "storm-lightning";
  lightning.position.set(0.45, 0, 1.15);
  const lightningMaterials: MeshStandardMaterial[] = [];
  for (const [x, y, length, rotation] of [
    [0, 0, 0.34, 0.34],
    [0.08, -0.26, 0.3, -0.28],
    [0.02, -0.48, 0.26, 0.42],
  ] as const) {
    const boltMaterial = weatherMaterial(0xf8ec9b, 0xffffd1, 0);
    lightningMaterials.push(boltMaterial);
    const bolt = new Mesh(
      new CylinderGeometry(0.025, 0.055, length, 6),
      boltMaterial,
    );
    bolt.position.set(x, y, 0);
    bolt.rotation.z = rotation;
    lightning.add(bolt);
  }
  lightning.visible = false;
  weather.thunderstorm.add(lightning);

  const rainGroups = thunderstormClouds.map((cloud, cloudIndex) => {
    const rainGroup = new Group();
    rainGroup.userData["rainCloudIndex"] = cloudIndex;
    rainGroup.userData["baseCloudX"] = cloud.position.x;
    rainGroup.userData["baseCloudY"] = cloud.position.y;

    for (let dropIndex = 0; dropIndex < 6; dropIndex += 1) {
      const drop = new Mesh(
        new CylinderGeometry(0.015, 0.015, 1.2, 6),
        weatherMaterial(0x7dc7df),
      );
      drop.position.set(
        (dropIndex - 2.5) * 0.25,
        -0.4 - dropIndex * 0.15,
        0,
      );
      drop.scale.y = 0.6;
      drop.rotation.z = -0.2;
      rainGroup.add(drop);
    }

    rainGroup.position.set(
      cloud.userData["baseX"] as number,
      cloud.userData["baseY"] as number,
      0,
    );
    weather.thunderstorm.add(rainGroup);
    return rainGroup;
  });

  return Object.freeze({
    update(
      activeWeather,
      phase,
      elapsedMs,
      durationMs,
      reducedMotion,
    ): void {
      for (const [kind, group] of Object.entries(weather) as [WeatherKind, Group][]) {
        group.visible = kind === activeWeather;
      }

      const active = weather[activeWeather];
      const drift = reducedMotion ? 0 : Math.sin(elapsedMs * 0.00045) *
        (activeWeather === "sunny" ? 0.08 : 0.3);
      active.position.x = origins[activeWeather] + drift;

      cloudyTownClouds.forEach((cloud, index) => {
        const baseX =
          typeof cloud.userData["baseX"] === "number"
            ? cloud.userData["baseX"]
            : cloud.position.x;
        const phaseOffset =
          typeof cloud.userData["driftPhase"] === "number"
            ? cloud.userData["driftPhase"]
            : index;
        const localDrift = reducedMotion
          ? 0
          : Math.sin(elapsedMs * (0.00016 + index * 0.000025) + phaseOffset) *
            (0.18 + index * 0.035);
        cloud.position.x = baseX + localDrift;
      });

      thunderstormClouds.forEach((cloud, cloudIndex) => {
        const baseX =
          typeof cloud.userData["baseX"] === "number"
            ? cloud.userData["baseX"]
            : cloud.position.x;
        const baseY =
          typeof cloud.userData["baseY"] === "number"
            ? cloud.userData["baseY"]
            : cloud.position.y;
        const phaseOffset =
          typeof cloud.userData["driftPhase"] === "number"
            ? cloud.userData["driftPhase"]
            : 0;

        if (!reducedMotion) {
          const turbulence1 = Math.sin(elapsedMs * 0.0008 + phaseOffset) * 0.6;
          const turbulence2 = Math.cos(elapsedMs * 0.00063 + phaseOffset * 1.5) * 0.4;
          const turbulenceY = Math.sin(elapsedMs * 0.0005 + phaseOffset * 2) * 0.3;
          cloud.position.x = baseX + turbulence1 + turbulence2;
          cloud.position.y = baseY + turbulenceY;
        }

        const rainGroup = rainGroups[cloudIndex];
        if (rainGroup) {
          rainGroup.position.x = cloud.position.x;
          rainGroup.position.y = cloud.position.y - 0.8;
        }
      });

      const daylightElapsed =
        reducedMotion && phase === "simulation"
          ? Math.max(1, durationMs) * 0.5
          : elapsedMs;
      const daylight = businessDayFrameAt(
        activeWeather,
        phase,
        daylightElapsed,
        durationMs,
      );
      const flash =
        activeWeather === "thunderstorm" && !reducedMotion
          ? lightningFlashAt(elapsedMs, durationMs)
          : 0;

      renderer.setClearColor(
        flash > 0
          ? blendHex(daylight.skyColor, 0xd9e8ef, flash * 0.48)
          : daylight.skyColor,
        1,
      );
      hemisphere.intensity = daylight.hemisphereIntensity + flash * 0.95;
      hemisphere.color.setHex(
        daylight.progress > 0.82 ? 0x91a6c8 : 0xfff2c6,
      );
      hemisphere.groundColor.setHex(
        daylight.progress > 0.82 ? 0x29352f : 0x526b51,
      );

      sunlight.intensity = daylight.sunlightIntensity + flash * 3.2;
      sunlight.color.setHex(
        flash > 0
          ? blendHex(daylight.sunlightColor, 0xe8f5ff, flash)
          : daylight.sunlightColor,
      );
      sunlight.position.set(...daylight.sunPosition);

      const sunArc = Math.max(0, Math.sin(daylight.progress * Math.PI));
      sunContainer.position.y = sunArc * 2.5 - 0.8;
      sunContainer.position.z = -6 - sunArc * 2;

      lightning.visible = flash > 0.06;
      for (const boltMaterial of lightningMaterials) {
        boltMaterial.emissiveIntensity = 0.3 + flash * 5.5;
      }
    },
  });
};
