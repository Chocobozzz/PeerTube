import { PluginClientScope } from './plugin-client-scope.type'

export type PluginTranslationPaths = {
  [ locale: string ]: string
}

export type ClientScript = {
  script: string
  scopes: PluginClientScope[]
}

export type PluginPackageJson = {
  name: string
  version: string
  description: string
  engine: { peertube: string }

  homepage: string
  author: string
  bugs: string
  library: string

  staticDirs: { [ name: string ]: string }
  css: string[]

  clientScripts: ClientScript[]

  translations: PluginTranslationPaths
}
