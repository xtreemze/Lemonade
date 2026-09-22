import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";

type WeatherKind = "sunny" | "cloudy" | "hot-and-dry" | "thunderstorm";
type WeatherGroups = Readonly<Record<WeatherKind, Group>>;

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
  const material = weatherMaterial(color);
  for (const [radius, x, y, z] of [
    [0.72, -0.78, 0, 0],
    [0.84, -0.08, 0.22, 0],
    [0.74, 0.72, 0.02, 0],
    [0.62, -0.22, -0.18, 0.18],
    [0.58, 0.3, -0.16, 0.12],
  ] as const) {
    const puff = new Mesh(new SphereGeometry(radius, 20, 16), material.clone());
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

export const populateWeatherObjects = (weather: WeatherGroups): void => {
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
  addCloud(weather.thunderstorm, 0x657786);

  const bolt = new Mesh(
    new CylinderGeometry(0, 0.16, 1.05, 8),
    weatherMaterial(0xf8d346, 0xf8d346, 0.3),
  );
  bolt.position.set(0.4, -1.05, 0.08);
  bolt.rotation.z = 0.35;
  weather.thunderstorm.add(bolt);

  for (let index = 0; index < 7; index += 1) {
    const drop = new Mesh(
      new CylinderGeometry(0.02, 0.02, 0.62, 8),
      weatherMaterial(0x7dc7df),
    );
    drop.position.set(-1.05 + index * 0.35, -1.25 - (index % 2) * 0.45, 0.15);
    drop.rotation.z = -0.18;
    weather.thunderstorm.add(drop);
  }
};
