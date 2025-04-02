import { resolve } from 'path'

export function getCSSConfig (root: string) {
  return {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        loadPaths: [ resolve(root, './src/sass/include') ],
        // FIXME: Wait for bootstrap upgrade that fixes deprecated sass utils
        silenceDeprecations: [ 'import', 'mixed-decls', 'color-functions', 'global-builtin' ]
      }
    }
  }
}

export function getAliasConfig (root: string) {
  return [
    { find: /^video.js$/, replacement: resolve(root, './node_modules/video.js/core.js') },
    { find: '@root-helpers', replacement: resolve(root, './src/root-helpers') }
  ]
}
