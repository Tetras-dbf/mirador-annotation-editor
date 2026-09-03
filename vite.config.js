import react from '@vitejs/plugin-react';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as vite from 'vite';
import pkg from './package.json';

const peers = Object.keys(pkg?.peerDependencies ?? {});

const externalIds = [
  ...peers,
  /^react(\/.*)?$/, /^react-dom(\/.*)?$/,
  /^@mui\/material(\/.*)?$/, /^@mui\/system(\/.*)?$/,
  /^@emotion\/react(\/.*)?$/, /^@emotion\/styled(\/.*)?$/,
  /^dbf-mirador(\/.*)?$/,
  'i18next',
  'react-i18next',
];

export default {
  build: {
    lib: {
      cssFileName: 'index.css',
      entry: './src/index.js',
      fileName: (format) => `mirador-annotation-editor.${format}.js`, // Better naming
      formats: ['es', 'cjs'],
      name: 'MiradorAnnotationEditor',
    },
    rollupOptions: {
      output: {
        assetFileNames: 'index.[ext]',
        exports: 'named', // Fixes the warning
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          '@mui/material': 'MaterialUI',
          '@emotion/react': 'EmotionReact',
          '@emotion/styled': 'EmotionStyled',
          'i18next': 'i18next',
          'react-i18next': 'reactI18next',
        },
      },
    },
    sourcemap: true,
  },
  esbuild: { include: [/src\/.*\.jsx?$/], loader: 'jsx' },
  optimizeDeps: {
    esbuildOptions: {
      plugins: [{
        name: 'load-js-files-as-jsx',
        setup(build) {
          build.onLoad({ filter: /(src|__tests__)\/.*\.js$/ }, async (args) => ({
            contents: await fs.readFile(args.path, 'utf8'),
            loader: 'jsx',
          }));
        },
      }],
    },
    include: ['@emotion/react', '@mui/material', 'i18next'],
  },
  plugins: [
    react(),
    // Bundled deps (e.g. react-redux's use-sync-external-store shim) call
    // require('react') at runtime. Rolldown (Vite 8's bundler) leaves that as
    // a literal require() against the externalized "react" module instead of
    // converting it to a static import, which throws in the browser ("Dynamic
    // require of "react" is not supported"). This plugin rewrites those
    // require() calls into proper ESM imports.
    // https://rolldown.rs/in-depth/bundling-cjs#require-external-modules
    // Only present on Vite 8+ (Rolldown); @vitejs/plugin-react@^4 caps the
    // installed vite at ^7, so this is a no-op until that dep is upgraded.
    ...(vite.esmExternalRequirePlugin ? [vite.esmExternalRequirePlugin({ external: externalIds })] : []),
  ],
  resolve: {
    alias: { '@tests/': fileURLToPath(new URL('./__tests__', import.meta.url)) },
    dedupe: [
      'react', 'react-dom',
      '@mui/material', '@mui/system',
      '@emotion/react', '@emotion/styled',
    ],
  },
  server: { open: '/demo/src/index.html', port: 4444 },
};
