export type PluginPackageJson = {
  name: string
  version: string
  description: string
  engine: { peertube: string },

  homepage: string,
  author: string,
  bugs: string,
  library: string,

  staticDirs: { [ name: string ]: string }
  css: string[]

  clientScripts: { script: string, scopes: string[] }[]
}
