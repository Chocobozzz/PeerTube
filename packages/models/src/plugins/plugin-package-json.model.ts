import { PluginClientScope } from './client/plugin-client-scope.type.js'

export type PluginTranslationPathsJSON = {
  [ locale: string ]: string
}

export type ClientScriptJSON = {
  script: string
  scopes: PluginClientScope[]
}

export type PluginPackageJSON = {
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

  clientScripts: ClientScriptJSON[]

  translations: PluginTranslationPathsJSON
}
