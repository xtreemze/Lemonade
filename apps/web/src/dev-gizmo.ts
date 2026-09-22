/**
 * Dev Tool: 3D Gizmo Scene Editor
 *
 * Enable the 3D gizmo dev tool by adding this to your browser console:
 *
 * `localStorage.setItem('LEMONADE_DEV_GIZMO', '1')`
 *
 * Then refresh the page. The gizmo UI will appear in the top-left corner.
 *
 * Usage:
 * - Click on 3D objects to select them (magenta bounding box appears)
 * - G key: Translate (move) mode
 * - R key: Rotate mode
 * - S key: Scale mode
 * - Drag with left mouse button to transform
 * - ESC: Deselect object
 * - Click "💾 Save Transform" to save an object's position
 * - Click "📋 Export JSON" or "📝 Export Code" to download transforms
 *
 * To disable:
 * `localStorage.removeItem('LEMONADE_DEV_GIZMO')`
 */

export const isGizmoEnabled = (): boolean => {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return false;
  }
  return localStorage.getItem("LEMONADE_DEV_GIZMO") === "1";
};

export const enableGizmo = (): void => {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("LEMONADE_DEV_GIZMO", "1");
    console.log("🎨 Gizmo enabled! Refresh the page to activate.");
  }
};

export const disableGizmo = (): void => {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("LEMONADE_DEV_GIZMO");
    console.log("🎨 Gizmo disabled. Refresh the page.");
  }
};

export const printGizmoHelp = (): void => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║              3D Gizmo Dev Tool - Quick Start                   ║
╚════════════════════════════════════════════════════════════════╝

ENABLE:
  enableGizmo()           # Enable gizmo and refresh
  disableGizmo()          # Disable gizmo

Or use localStorage directly:
  localStorage.setItem('LEMONADE_DEV_GIZMO', '1')
  localStorage.removeItem('LEMONADE_DEV_GIZMO')

CONTROLS:
  Click            - Select an object
  G key           - Translate (move) mode
  R key           - Rotate mode
  S key           - Scale mode
  Drag            - Transform selected object
  ESC             - Deselect

UI BUTTONS:
  💾 Save Transform    - Save current object's transform
  📋 Export JSON       - Download transforms as JSON
  📝 Export Code       - Download transforms as TypeScript
  📋 Copy JSON         - Copy transforms to clipboard

COMMANDS IN GIZMO UI:
  All transforms are logged to console
  Saved positions can be exported and used to update the scene

EXAMPLE:
  1. Select an object by clicking it
  2. Press 'G' to enter move mode
  3. Drag the object to a new position
  4. Press 'S' to switch to scale mode
  5. Drag to scale the object
  6. Click 'Save Transform' to save it
  7. Click 'Export Code' to download the code
  8. Use that code to update your scene permanently

═══════════════════════════════════════════════════════════════════
  `);
};

// Make dev tools globally available.
if (typeof window !== "undefined") {
  Object.assign(window, {
    enableGizmo,
    disableGizmo,
    gizmoHelp: printGizmoHelp,
  });
}
