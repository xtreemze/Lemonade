/** Lightweight production-safe flag check for the optional 3D gizmo dev tool. */
export const isGizmoEnabled = (): boolean =>
  typeof localStorage !== "undefined" &&
  localStorage.getItem("LEMONADE_DEV_GIZMO") === "1";
