export class MapInitializationError extends Error {
  constructor(cause, kind, details) {
    super('Memory Map renderer initialization failed', {cause});
    this.name = 'MapInitializationError';
    this.kind = kind;
    this.details = details;
  }
}

/** No graph/user data is included in initialization diagnostics. */
export function reportMapFailure(error, loadingModule) {
  const kind = loadingModule ? 'chunk-load'
    : error instanceof MapInitializationError ? error.kind : 'renderer-init';
  console.error('[Mroya Memory Map]', {phase:loadingModule ? 'module-load' : 'renderer-init', kind,
    ...(error instanceof MapInitializationError ? error.details : {})}, error);
  return kind;
}

/** Own the canvas even if Pixi rejects before assigning app.renderer. */
export async function initializeMapApplication(app, host, signal) {
  signal?.throwIfAborted();
  const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
  const canvas = document.createElement('canvas');
  const getContext = canvas.getContext;
  let context = null, contextError = null, creationStatus = '';
  const creationError = event => { creationStatus = event.statusMessage || 'WebGL context creation failed'; };
  canvas.addEventListener('webglcontextcreationerror', creationError);
  // Track only this owned canvas. Restore its method once init settles.
  canvas.getContext = function(type, ...options) {
    if (type !== 'webgl' && type !== 'webgl2') return getContext.call(this, type, ...options);
    try { const value = getContext.call(this, type, ...options); if (value) context = value; return value; }
    catch (error) { contextError = error; throw error; }
  };
  try {
    await app.init({canvas, width, height, preference:['webgl'], antialias:true,
      backgroundAlpha:0, resolution:Math.min(window.devicePixelRatio || 1, 2), autoDensity:true});
    signal?.throwIfAborted();
  } catch (error) {
    try {
      if (app.renderer) app.destroy(true, {children:true});
      else {
        app.stage?.destroy({children:true});
        context?.getExtension('WEBGL_lose_context')?.loseContext();
      }
    } catch (cleanupError) { console.warn('[Mroya Memory Map] initialization cleanup failed', cleanupError); }
    canvas.remove();
    if (signal?.aborted) signal.throwIfAborted();
    // These are Pixi 8.22's explicit unsupported-WebGL failures. Other errors
    // remain application/renderer errors rather than being blamed on the GPU.
    const unsupported = contextError || creationStatus || error?.message === 'No available renderer for the current environment'
      || error?.message === 'This browser does not support WebGL. Try using the canvas renderer';
    throw new MapInitializationError(error, unsupported ? 'webgl-unavailable' : 'renderer-init', {width, height, creationStatus});
  } finally {
    canvas.getContext = getContext;
    canvas.removeEventListener('webglcontextcreationerror', creationError);
  }
}
