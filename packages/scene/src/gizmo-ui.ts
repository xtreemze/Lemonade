import type { GizmoController } from "./gizmo-controller.js";

export interface GizmoUIOptions {
  gizmoController: GizmoController;
}

const createButton = (text: string, onClick: () => void): HTMLButtonElement => {
  const button = document.createElement("button");
  button.textContent = text;
  button.onclick = onClick;
  button.style.cssText = `
    padding: 8px 12px;
    margin: 4px;
    background: #333;
    color: #fff;
    border: 1px solid #666;
    border-radius: 4px;
    cursor: pointer;
    font-family: monospace;
    font-size: 12px;
  `;
  return button;
};

export const createGizmoUI = (options: GizmoUIOptions): HTMLElement => {
  const { gizmoController } = options;

  const panel = document.createElement("div");
  panel.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    background: rgba(0, 0, 0, 0.9);
    border: 2px solid #ff00ff;
    border-radius: 8px;
    padding: 12px;
    font-family: monospace;
    font-size: 12px;
    color: #fff;
    z-index: 1000;
    max-width: 300px;
  `;

  const title = document.createElement("div");
  title.textContent = "🎨 3D Gizmo Dev Tool";
  title.style.cssText = `
    font-weight: bold;
    margin-bottom: 8px;
    color: #ff00ff;
    font-size: 14px;
  `;
  panel.appendChild(title);

  const modeContainer = document.createElement("div");
  modeContainer.style.cssText = "margin-bottom: 8px;";

  const modeLabel = document.createElement("div");
  modeLabel.textContent = "Transform Mode (G/R/S):";
  modeLabel.style.cssText = "margin-bottom: 4px; color: #aaa;";
  modeContainer.appendChild(modeLabel);

  const updateActiveMode = () => {
    Array.from(modeContainer.querySelectorAll("button")).forEach((btn) => {
      btn.style.background = "#333";
      btn.style.color = "#fff";
    });
    const activeBtn = modeContainer.querySelector<HTMLButtonElement>(
      `button[data-mode="${gizmoController.getMode()}"]`,
    );
    if (activeBtn) {
      activeBtn.style.background = "#ff00ff";
      activeBtn.style.color = "#000";
    }
  };

  const translateBtn = document.createElement("button");
  translateBtn.textContent = "Move (G)";
  translateBtn.setAttribute("data-mode", "translate");
  translateBtn.onclick = () => {
    gizmoController.setMode("translate");
    updateActiveMode();
  };
  translateBtn.style.cssText = `
    padding: 6px 10px;
    margin: 2px;
    background: #ff00ff;
    color: #000;
    border: 1px solid #666;
    border-radius: 4px;
    cursor: pointer;
    font-family: monospace;
    font-size: 11px;
    font-weight: bold;
  `;

  const rotateBtn = document.createElement("button");
  rotateBtn.textContent = "Rotate (R)";
  rotateBtn.setAttribute("data-mode", "rotate");
  rotateBtn.onclick = () => {
    gizmoController.setMode("rotate");
    updateActiveMode();
  };
  rotateBtn.style.cssText = `
    padding: 6px 10px;
    margin: 2px;
    background: #333;
    color: #fff;
    border: 1px solid #666;
    border-radius: 4px;
    cursor: pointer;
    font-family: monospace;
    font-size: 11px;
  `;

  const scaleBtn = document.createElement("button");
  scaleBtn.textContent = "Scale (S)";
  scaleBtn.setAttribute("data-mode", "scale");
  scaleBtn.onclick = () => {
    gizmoController.setMode("scale");
    updateActiveMode();
  };
  scaleBtn.style.cssText = `
    padding: 6px 10px;
    margin: 2px;
    background: #333;
    color: #fff;
    border: 1px solid #666;
    border-radius: 4px;
    cursor: pointer;
    font-family: monospace;
    font-size: 11px;
  `;

  modeContainer.appendChild(translateBtn);
  modeContainer.appendChild(rotateBtn);
  modeContainer.appendChild(scaleBtn);
  panel.appendChild(modeContainer);

  const infoContainer = document.createElement("div");
  infoContainer.style.cssText = `
    background: #1a1a1a;
    border: 1px solid #444;
    border-radius: 4px;
    padding: 8px;
    margin-bottom: 8px;
    font-size: 11px;
    color: #0f0;
  `;

  const selectedInfo = document.createElement("div");
  selectedInfo.id = "selected-info";
  selectedInfo.textContent = "No object selected (ESC to deselect)";
  infoContainer.appendChild(selectedInfo);

  const positionInfo = document.createElement("div");
  positionInfo.id = "position-info";
  positionInfo.style.cssText = "margin-top: 4px; font-size: 10px;";
  infoContainer.appendChild(positionInfo);

  panel.appendChild(infoContainer);

  const actionContainer = document.createElement("div");
  actionContainer.style.cssText = "display: flex; flex-direction: column; gap: 6px;";

  const saveBtn = createButton("💾 Save Transform", () => {
    gizmoController.saveTransform();
    updateSavedCount();
  });
  actionContainer.appendChild(saveBtn);

  const exportJsonBtn = createButton("📋 Export JSON", () => {
    const json = gizmoController.exportAsJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "scene-transforms.json";
    a.click();
    URL.revokeObjectURL(url);
  });
  actionContainer.appendChild(exportJsonBtn);

  const exportCodeBtn = createButton("📝 Export Code", () => {
    const code = gizmoController.exportAsCode();
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "scene-transforms.ts";
    a.click();
    URL.revokeObjectURL(url);
  });
  actionContainer.appendChild(exportCodeBtn);

  const copyToClipboardBtn = createButton("📋 Copy JSON", () => {
    const json = gizmoController.exportAsJSON();
    void navigator.clipboard.writeText(json).then(() => {
      copyToClipboardBtn.textContent = "✓ Copied!";
      setTimeout(() => {
        copyToClipboardBtn.textContent = "📋 Copy JSON";
      }, 2000);
    });
  });
  actionContainer.appendChild(copyToClipboardBtn);

  panel.appendChild(actionContainer);

  const savedCountContainer = document.createElement("div");
  savedCountContainer.id = "saved-count";
  savedCountContainer.style.cssText = `
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #444;
    font-size: 11px;
    color: #0f0;
  `;
  panel.appendChild(savedCountContainer);

  const updateSavedCount = () => {
    const saved = gizmoController.getSavedTransforms();
    savedCountContainer.textContent = `Saved: ${String(saved.length)} object${saved.length === 1 ? "" : "s"}`;
  };

  const updateUi = () => {
    const selected = gizmoController.getSelectedObject();
    if (selected) {
      selectedInfo.textContent = `Selected: ${selected.name || "unnamed"}`;
      const pos = selected.position;
      const rot = selected.rotation;
      const scale = selected.scale;
      positionInfo.innerHTML = `
        <div>Pos: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})</div>
        <div>Rot: (${rot.x.toFixed(2)}, ${rot.y.toFixed(2)}, ${rot.z.toFixed(2)})</div>
        <div>Scale: (${scale.x.toFixed(2)}, ${scale.y.toFixed(2)}, ${scale.z.toFixed(2)})</div>
      `;
    } else {
      selectedInfo.textContent = "No object selected (ESC to deselect)";
      positionInfo.innerHTML = "";
    }
    updateSavedCount();
  };

  // Update UI on animation frame
  const updateLoop = () => {
    updateUi();
    requestAnimationFrame(updateLoop);
  };
  updateLoop();

  return panel;
};

declare global {
  interface Window {
    __updateActiveMode?: () => void;
  }
}
