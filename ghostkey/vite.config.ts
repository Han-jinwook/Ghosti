import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sharedSrcDir = path.resolve(__dirname, '../src');

export default defineConfig({
  plugins: [...(process.env.VITE_HTTPS === '1' ? [basicSsl()] : [])],
  resolve: {
    alias: {
      '@shared': sharedSrcDir,
    },
  },
  // 허브 SDK(CoreLogic/config.ts)가 Next.js식 process.env.* 를 참조 -> Vite dev 브라우저 ReferenceError 방지
  define: {
    'process.env': '{}',
    __GHOSTI_BUILD_ID__: JSON.stringify('20261123_ghostkey_unified_v1'),
  },
  server: {
    host: true,
    port: 5174,
    allowedHosts: true,
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/zustand')) {
            return 'vendor-core';
          }
          return undefined;
        },
      },
    },
  },
});
