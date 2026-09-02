import { esmExternalRequirePlugin } from "vite";
import react from '@vitejs/plugin-react';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pkg from './package.json';

const peers = Object.keys(pkg?.peerDependencies ?? {});
const external = [
  ...peers,
  /^react(\/.*)?$/, /^react-dom(\/.*)?$/,
  /^@mui\/material(\/.*)?$/, /^@mui\/system(\/.*)?$/,
  /^@emotion\/react(\/.*)?$/, /^@emotion\/styled(\/.*)?$/,
  /^mirador(\/.*)?$/,
  "i18next",
  "react-i18next"
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
      // Externalization is handled entirely by `esmExternalRequirePlugin`
      // below (it externalizes `external` itself, in addition to rewriting
      // requires of it) — listing the same packages here too just produces a
      // "duplicate external" build warning.
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
    // Rollup's CJS interop leaves a literal `require('react')` (etc.) call
    // behind when it bundles a dependency that itself does a plain `require`
    // of something in `external` from inside a function body it can't
    // statically hoist — e.g. react-redux's `use-sync-external-store` shim.
    // Unpatched, that call survives into the ESM output and throws at runtime
    // in any bundle with no `require` (the browser). Mirador's own build
    // already uses this exact plugin for the same reason; MAE didn't. See
    // strapi-plugins#8 ("Calling `require` for react in an environment that
    // doesn't expose the require function", surfacing when MAE is embedded in
    // the Strapi admin panel).
    esmExternalRequirePlugin({ external })
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
