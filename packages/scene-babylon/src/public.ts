import type {
  LemonsvilleSceneController,
  LemonsvilleSceneOptions,
  LemonsvilleSceneState,
} from "@lemonade/scene-contracts/scene-state";

export declare const createBabylonLemonsvilleScene: (
  canvas: HTMLCanvasElement,
  initialState: LemonsvilleSceneState,
  options?: LemonsvilleSceneOptions,
) => LemonsvilleSceneController | null;
