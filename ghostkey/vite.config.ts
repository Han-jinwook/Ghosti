import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sharedSrcDir = path.resolve(__dirname, '../src');
const localNodeModules = path.resolve(__dirname, 'node_modules');
const parentNodeModules = path.resolve(__dirname, '../node_modules');
const nmDir = fs.existsSync(path.join(localNodeModules, 'react'))
  ? localNodeModules
  : parentNodeModules;

export default defineConfig({
  plugins: [...(process.env.VITE_HTTPS === '1' ? [basicSsl()] : [])],
  resolve: {
    dedupe: ['react', 'react-dom', '@supabase/supabase-js', 'lucide-react', 'zustand'],
    alias: {
      '@shared': sharedSrcDir,
      '@supabase/supabase-js': path.join(nmDir, '@supabase/supabase-js'),
      'lucide-react': path.join(nmDir, 'lucide-react'),
      'react-dom': path.join(nmDir, 'react-dom'),
      react: path.join(nmDir, 'react'),
      zustand: path.join(nmDir, 'zustand'),
    },
  },
  // 허브 SDK(CoreLogic/config.ts)가 Next.js식 process.env.* 를 참조 -> Vite dev 브라우저 ReferenceError 방지
  define: {
    'process.env': '{}',
    __GHOSTI_BUILD_ID__: JSON.stringify('20261123_ghostkey_unified_v2'),
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
