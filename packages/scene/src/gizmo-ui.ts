import type { GizmoController, TransformMode } from "./gizmo-controller.js";

export interface GizmoUIOptions {
  gizmoController: GizmoController;
  container: HTMLElement;
}

const createButton = (
  text: string,
  onClick: () => void,
): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.addEventListener("click", onClick);
  button.style.cssText = `
    min-height: 44px;
    padding: 8px 12px;
    background: #333;
    color: #fff;
    border: 1px solid #666;
    border-radius: 4px;
    cursor: pointer;
    font: 12px monospace;
  `;
  return button;
};

export const createGizmoUI = (options: GizmoUIOptions): HTMLElement => {
  const { gizmoController, container } = options;
  const panel = document.createElement("aside");
  panel.setAttribute("aria-label", "3D transform controls");
  panel.style.cssText = `
    position: absolute;
    top: 10px;
    left: 10px;
    width: min(300px, calc(100% - 20px));
    padding: 12px;
    background: rgb(0 0 0 / 90%);
    border: 2px solid #ff00ff;
    border-radius: 8px;
    color: #fff;
    font: 12px monospace;
    z-index: 1000;
  `;

  const title = document.createElement("strong");
  title.textContent = "3D Gizmo";
  panel.appendChild(title);

  const modes = document.createElement("div");
  modes.style.cssText = "display:flex;gap:4px;flex-wrap:wrap;margin-block:8px;";

  const modeButtons = new Map<TransformMode, HTMLButtonElement>();
  for (const [mode, label] of [
    ["translate", "Move (G)"],
    ["rotate", "Rotate (R)"],
    ["scale", "Scale (S)"],
  ] as const) {
    const button = createButton(label, () => {
      gizmoController.setMode(mode);
      sync();
    });
    modeButtons.set(mode, button);
    modes.appendChild(button);
  }
  panel.appendChild(modes);

  const selectedInfo = document.createElement("div");
  selectedInfo.style.cssText =
    "margin-block:8px;padding:8px;background:#1a1a1a;border:1px solid #444;color:#0f0;";
  panel.appendChild(selectedInfo);

  const actions = document.createElement("div");
  actions.style.cssText = "display:grid;gap:6px;";

  const savedCount = document.createElement("div");
  savedCount.style.cssText = "margin-top:8px;color:#0f0;";

  actions.appendChild(
    createButton("Save transform", () => {
      gizmoController.saveTransform();
      sync();
    }),
  );
  actions.appendChild(
    createButton("Export JSON", () => {
      const blob = new Blob([gizmoController.exportAsJSON()], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "scene-transforms.json";
      anchor.click();
      URL.revokeObjectURL(url);
    }),
  );
  actions.appendChild(
    createButton("Export code", () => {
      const blob = new Blob([gizmoController.exportAsCode()], {
        type: "text/plain",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "scene-transforms.ts";
      anchor.click();
      URL.revokeObjectURL(url);
    }),
  );
  actions.appendChild(
    createButton("Copy JSON", () => {
      void navigator.clipboard
        .writeText(gizmoController.exportAsJSON())
        .catch(() => undefined);
    }),
  );
  panel.append(actions, savedCount);

  let animationFrame: number | null = null;
  let disposed = false;

  function sync(): void {
    if (disposed) return;
    for (const [mode, button] of modeButtons) {
      const active = gizmoController.getMode() === mode;
      button.style.background = active ? "#ff00ff" : "#333";
      button.style.color = active ? "#000" : "#fff";
    }

    const selected = gizmoController.getSelectedObject();
    if (selected === null) {
      selectedInfo.textContent = "No object selected.";
    } else {
      selectedInfo.textContent =
        `${selected.name || "unnamed"} · ` +
        `pos ${selected.position.x.toFixed(2)}, ${selected.position.y.toFixed(2)}, ${selected.position.z.toFixed(2)}`;
    }

    const saved = gizmoController.getSavedTransforms();
    savedCount.textContent = `Saved: ${String(saved.length)}`;
  }

  const frame = (): void => {
    sync();
    if (!disposed) animationFrame = window.requestAnimationFrame(frame);
  };

  const observer = new MutationObserver(() => {
    if (!container.contains(panel)) {
      disposed = true;
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
    }
  });
  observer.observe(container, { childList: true, subtree: true });

  sync();
  animationFrame = window.requestAnimationFrame(frame);
  return panel;
};
