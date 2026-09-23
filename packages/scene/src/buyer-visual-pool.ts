export type ReclaimableBuyerVisual = Readonly<{
  root: {
    visible: boolean;
  };
}>;

export const reclaimBuyerVisualPool = (
  buyers: readonly ReclaimableBuyerVisual[],
): void => {
  for (const buyer of buyers) {
    buyer.root.visible = false;
  }
};
