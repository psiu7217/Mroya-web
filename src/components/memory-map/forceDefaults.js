// Shared by the view controls and the Pixi renderer. Kept in its own module so the
// view can render force controls without importing the renderer (and Pixi) eagerly.
export const defaults = { repulsion: 235, linkDistance: 126, center: 28 };
