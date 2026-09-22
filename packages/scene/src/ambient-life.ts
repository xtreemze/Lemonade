import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  type Scene,
} from "three";

export type AmbientWeather = "sunny" | "cloudy" | "hot-and-dry" | "thunderstorm";
export type AmbientPhase = "idle" | "simulation" | "forecast";

export type AmbientPopulation = Readonly<{
  pets: number;
  bicycles: number;
  vehicles: number;
}>;

export type AmbientLifeController = Readonly<{
  update(weather: AmbientWeather, phase: AmbientPhase, elapsedMs: number, durationMs: number): void;
}>;

const material = (color: number): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, roughness: 0.88 });

export const ambientPopulationFor = (
  weather: AmbientWeather,
  phase: AmbientPhase,
): AmbientPopulation => {
  if (phase !== "simulation") {
    return Object.freeze({ pets: 0, bicycles: 0, vehicles: 0 });
  }
  switch (weather) {
    case "sunny":
      return Object.freeze({ pets: 2, bicycles: 2, vehicles: 1 });
    case "hot-and-dry":
      return Object.freeze({ pets: 1, bicycles: 1, vehicles: 1 });
    case "cloudy":
      return Object.freeze({ pets: 1, bicycles: 1, vehicles: 1 });
    case "thunderstorm":
      return Object.freeze({ pets: 0, bicycles: 0, vehicles: 2 });
  }
};

const createPet = (color: number): Group => {
  const root = new Group();
  const body = new Mesh(new BoxGeometry(0.5, 0.28, 0.22), material(color));
  body.position.y = 0.3;
  const head = new Mesh(new SphereGeometry(0.16, 8, 6), material(color));
  head.position.set(0.3, 0.4, 0);
  root.add(body, head);
  for (const x of [-0.18, 0.18]) {
    for (const z of [-0.07, 0.07]) {
      const leg = new Mesh(new CylinderGeometry(0.025, 0.025, 0.24, 5), material(color));
      leg.position.set(x, 0.14, z);
      root.add(leg);
    }
  }
  return root;
};

const createBicycle = (color: number): Group => {
  const root = new Group();
  const wheelMaterial = material(0x2f3438);
  for (const x of [-0.42, 0.42]) {
    const wheel = new Mesh(new TorusGeometry(0.28, 0.035, 6, 14), wheelMaterial);
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(x, 0.3, 0);
    root.add(wheel);
  }
  const frame = new Mesh(new BoxGeometry(0.76, 0.055, 0.055), material(color));
  frame.position.y = 0.42;
  frame.rotation.z = 0.08;
  root.add(frame);
  const rider = new Mesh(new SphereGeometry(0.13, 8, 6), material(0xd5a27d));
  rider.position.set(0, 1.15, 0);
  root.add(rider);
  const torso = new Mesh(new CylinderGeometry(0.14, 0.18, 0.55, 8), material(color));
  torso.position.set(0, 0.82, 0);
  torso.rotation.z = -0.18;
  root.add(torso);
  return root;
};

const createVehicle = (color: number): Group => {
  const root = new Group();
  const body = new Mesh(new BoxGeometry(1.65, 0.52, 0.82), material(color));
  body.position.y = 0.48;
  root.add(body);
  const cabin = new Mesh(new BoxGeometry(0.84, 0.42, 0.72), material(0xb9d2d8));
  cabin.position.set(-0.12, 0.92, 0);
  root.add(cabin);
  for (const x of [-0.55, 0.55]) {
    for (const z of [-0.36, 0.36]) {
      const wheel = new Mesh(
        new CylinderGeometry(0.18, 0.18, 0.12, 10),
        material(0x2c3034),
      );
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.24, z);
      root.add(wheel);
    }
  }
  return root;
};

const routeProgress = (elapsedMs: number, durationMs: number, offset: number, speed: number): number => {
  const duration = Math.max(1, durationMs);
  const progress = elapsedMs / duration * speed + offset;
  return progress - Math.floor(progress);
};

export const createAmbientLife = (scene: Scene, seed: number): AmbientLifeController => {
  const pets = [createPet(0xa96f45), createPet(0x3e3a36), createPet(0xd1b48b)];
  const bicycles = [createBicycle(0x4f7f91), createBicycle(0xb45d4c)];
  const vehicles = [createVehicle(0x7189a8), createVehicle(0xa65e52)];

  for (const actor of [...pets, ...bicycles, ...vehicles]) {
    actor.visible = false;
    scene.add(actor);
  }

  return Object.freeze({
    update(weather, phase, elapsedMs, durationMs): void {
      const population = ambientPopulationFor(weather, phase);
      pets.forEach((pet, index) => {
        pet.visible = index < population.pets;
        if (!pet.visible) return;
        const progress = routeProgress(elapsedMs, durationMs, index * 0.31 + (seed & 7) * 0.013, 0.58 + index * 0.08);
        pet.position.set(-10 + progress * 20, 0, 2.55 + index * 0.34);
        pet.rotation.y = Math.PI / 2;
        pet.position.y = Math.abs(Math.sin(progress * Math.PI * 10)) * 0.015;
      });
      bicycles.forEach((bike, index) => {
        bike.visible = index < population.bicycles;
        if (!bike.visible) return;
        const progress = routeProgress(elapsedMs, durationMs, index * 0.47 + 0.18, 0.9 + index * 0.12);
        bike.position.set(12 - progress * 24, 0.02, 4.75 + index * 0.42);
        bike.rotation.y = -Math.PI / 2;
      });
      vehicles.forEach((vehicle, index) => {
        vehicle.visible = index < population.vehicles;
        if (!vehicle.visible) return;
        const direction = index % 2 === 0 ? 1 : -1;
        const progress = routeProgress(elapsedMs, durationMs, index * 0.53 + 0.08, 0.52 + index * 0.09);
        vehicle.position.set(direction * (-18 + progress * 36), 0.02, 5.7 + index * 0.72);
        vehicle.rotation.y = direction === 1 ? Math.PI / 2 : -Math.PI / 2;
      });
    },
  });
};
