import type {
  LemonsvilleSceneControllerContract,
  LemonsvilleSceneOptions,
  LemonsvilleSceneState,
} from "@lemonade/scene/scene-state";

export declare const createBabylonLemonsvilleScene: (
  canvas: HTMLCanvasElement,
  initialState: LemonsvilleSceneState,
  options?: LemonsvilleSceneOptions,
) => LemonsvilleSceneControllerContract | null;
