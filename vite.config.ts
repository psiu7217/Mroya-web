import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({ mode }) => {
  const target = process.env.MROYA_BUILD_TARGET ?? (mode === 'design' ? 'design' : 'production');
  if (!['design', 'production'].includes(target)) throw new Error('Invalid MROYA_BUILD_TARGET');
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
        '@mroya/entry': path.resolve(import.meta.dirname, target === 'design' ? 'src/demo/DesignRoot.tsx' : 'src/providers/ProductionRoot.tsx'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
