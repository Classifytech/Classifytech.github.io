import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const isHmrDisabled = process.env.DISABLE_HMR === 'true';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), '.'),
      },
    },
    server: {
      hmr: !isHmrDisabled,
      watch: isHmrDisabled ? null : {},
      allowedHosts: true,
    },
    build: {
      rollupOptions: {
        output: {
          entryFileNames: 'assets/classifytech.js',
          assetFileNames: (assetInfo) =>
            assetInfo.name?.endsWith('.css') || assetInfo.names?.some((n) => n.endsWith('.css'))
              ? 'assets/classifytech.css'
              : 'assets/[name][extname]',
          inlineDynamicImports: true,
        },
      },
      chunkSizeWarningLimit: 800,
    },
  };
});
