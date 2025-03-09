import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Whether to polyfill specific Node.js globals
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // Whether to polyfill Node.js builtins
      protocolImports: true,
    }),
  ],
  resolve: {
    alias: {
      // Add any specific aliases if needed
    },
  },
  optimizeDeps: {
    include: ['pg-promise', 'pg-protocol', 'pg', 'pg-types'],
    exclude: ['bcrypt', 'mock-aws-s3', 'aws-sdk', 'nock'],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  server: {
    // Add this to see more detailed errors
    hmr: {
      overlay: true,
    },
  },
})
