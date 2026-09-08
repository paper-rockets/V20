import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const isHttps = process.env.HTTPS === 'true' || process.argv.includes('--https');

  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      ...(isHttps ? [basicSsl()] : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // esbuild minification keeps builds fast; the parse win on mobile comes from
      // splitting, not from squeezing the last few percent out of the bytes.
      target: 'es2020',
      cssCodeSplit: true,
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
        },
        output: {
          /**
           * Vendor splitting.
           *
           * Three.js is by far the largest dependency and it changes only when the
           * package is upgraded. Keeping it in its own chunk means an app-code
           * deploy no longer invalidates it in the browser cache - which matters
           * most on a tablet over mobile data, where re-downloading and re-parsing
           * ~1 MB of engine code is the slowest part of a cold start.
           */
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('three-mesh-bvh')) return 'vendor-bvh';
            if (id.includes('/three/')) return 'vendor-three';
            if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('jszip')) return 'vendor-zip';
            if (id.includes('/motion/') || id.includes('framer-motion')) return 'vendor-motion';
            return undefined;
          },
        },
      },
    },
    clearScreen: false,
    server: {
      host: '0.0.0.0',
      port: 5000,
      strictPort: true,
      cors: true,
      allowedHosts: true,
      fs: {
        allow: ['..', '.'],
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      host: '0.0.0.0',
      port: 5000,
      strictPort: true,
      cors: true,
      allowedHosts: true,
    },
  };
});
