export const createPriceSignSurface = (priceLabel: string): HTMLCanvasElement => {
  const surface = document.createElement("canvas");
  surface.width = 512;
  surface.height = 256;
  const context = surface.getContext("2d");
  if (context === null) return surface;

  context.fillStyle = "#f5d34c";
  context.fillRect(0, 0, surface.width, surface.height);
  context.fillStyle = "#211d14";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "900 60px system-ui, sans-serif";
  context.fillText("LEMONADE", surface.width / 2, 66);
  context.font = "900 92px ui-monospace, monospace";
  context.fillText(priceLabel + " / CUP", surface.width / 2, 166);
  return surface;
};
