export const WORLD_SCALE = Object.freeze({
  character: Object.freeze({
    renderScale: 0.8,
    modeledStandingHeight: 2.256,
    modeledFootDrop: 0.225,
    tallestAdultHeightScale: 1.1,
  }),
  house: Object.freeze({
    doorWidth: 1,
    doorHeight: 2.12,
  }),
  stand: Object.freeze({
    counterHeight: 0.94,
    canopyHeight: 2.18,
  }),
  street: Object.freeze({
    laneWidth: 3.05,
    vehicleLanes: 2,
    roadWidth: 6.1,
    sidewalkWidth: 1.65,
    curbGap: 0.25,
    drivewayWidth: 2.7,
  }),
  vehicle: Object.freeze({
    length: 4.2,
    width: 1.78,
    bodyHeight: 0.72,
  }),
  bicycle: Object.freeze({
    length: 1.72,
    wheelDiameter: 0.68,
  }),
  produce: Object.freeze({
    lemonDiameter: 0.09,
  }),
});

export const renderedCharacterHeight = (heightScale: number): number => {
  const safeScale = Number.isFinite(heightScale) ? heightScale : 1;
  return (
    WORLD_SCALE.character.modeledStandingHeight * WORLD_SCALE.character.renderScale * safeScale
  );
};

export const characterGroundClearance = (heightScale: number): number => {
  const safeScale = Number.isFinite(heightScale) ? heightScale : 1;
  return WORLD_SCALE.character.modeledFootDrop * WORLD_SCALE.character.renderScale * safeScale;
};

export const tallestAdultRenderedHeight = (): number =>
  renderedCharacterHeight(WORLD_SCALE.character.tallestAdultHeightScale);
