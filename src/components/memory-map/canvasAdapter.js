/** Keep Pixi's Canvas text/shader probes safe when WebGL access throws.
 * Only canvases created by Pixi are wrapped; native prototypes are untouched.
 * All other adapter operations and non-WebGL errors retain their behavior. */
export function mapCanvasAdapter(adapter) {
  return {
    ...adapter,
    createCanvas(...size) {
      const canvas = adapter.createCanvas(...size);
      const getContext = canvas.getContext.bind(canvas);
      canvas.getContext = (type, ...options) => {
        try { return getContext(type, ...options); }
        catch (error) {
          if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
          throw error;
        }
      };
      return canvas;
    },
  };
}
