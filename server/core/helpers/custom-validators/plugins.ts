import { PluginPackageJSON, PluginType, PluginType_Type } from '@peertube/peertube-models'
import validator from 'validator'
import { CONSTRAINTS_FIELDS } from '../../initializers/constants.js'
import { isUrlValid } from './activitypub/misc.js'
import { exists, isArray, isSafePath } from './misc.js'

const PLUGINS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.PLUGINS

export function isPluginTypeValid (value: any) {
  return exists(value) &&
    (value === PluginType.PLUGIN || value === PluginType.THEME)
}

export function isPluginNameValid (value: string) {
  return exists(value) &&
    validator.default.isLength(value, PLUGINS_CONSTRAINTS_FIELDS.NAME) &&
    validator.default.matches(value, /^[a-z-0-9]+$/)
}

export function isNpmPluginNameValid (value: string) {
  return exists(value) &&
    validator.default.isLength(value, PLUGINS_CONSTRAINTS_FIELDS.NAME) &&
    validator.default.matches(value, /^[a-z\-._0-9]+$/) &&
    (value.startsWith('peertube-plugin-') || value.startsWith('peertube-theme-'))
}

export function isPluginDescriptionValid (value: string) {
  return exists(value) && validator.default.isLength(value, PLUGINS_CONSTRAINTS_FIELDS.DESCRIPTION)
}

export function isPluginEngineValid (engine: any) {
  return exists(engine) && exists(engine.peertube)
}

export function isPluginHomepage (value: string) {
  return exists(value) && (!value || isUrlValid(value))
}

export function isPluginBugs (value: string) {
  return exists(value) && (!value || isUrlValid(value))
}

export function areStaticDirectoriesValid (staticDirs: any) {
  if (!exists(staticDirs) || typeof staticDirs !== 'object') return false

  for (const key of Object.keys(staticDirs)) {
    if (!isSafePath(staticDirs[key])) return false
  }

  return true
}

export function areClientScriptsValid (clientScripts: any[]) {
  return isArray(clientScripts) &&
    clientScripts.every(c => {
      return isSafePath(c.script) && isArray(c.scopes)
    })
}

export function areTranslationPathsValid (translations: any) {
  if (!exists(translations) || typeof translations !== 'object') return false

  for (const key of Object.keys(translations)) {
    if (!isSafePath(translations[key])) return false
  }

  return true
}

export function areCSSPathsValid (css: any[]) {
  return isArray(css) && css.every(c => isSafePath(c))
}

export function isThemeNameValid (name: string) {
  return name && typeof name === 'string' &&
    (isPluginNameValid(name) || name.startsWith('peertube-core-'))
}

export function isPackageJSONValid (packageJSON: PluginPackageJSON, pluginType: PluginType_Type) {
  let result = true
  const badFields: string[] = []

  if (!isNpmPluginNameValid(packageJSON.name)) {
    result = false
    badFields.push('name')
  }

  if (!isPluginDescriptionValid(packageJSON.description)) {
    result = false
    badFields.push('description')
  }

  if (!isPluginEngineValid(packageJSON.engine)) {
    result = false
    badFields.push('engine')
  }

  if (!isPluginHomepage(packageJSON.homepage)) {
    result = false
    badFields.push('homepage')
  }

  if (!exists(packageJSON.author)) {
    result = false
    badFields.push('author')
  }

  if (!isPluginBugs(packageJSON.bugs)) {
    result = false
    badFields.push('bugs')
  }

  if (pluginType === PluginType.PLUGIN && !isSafePath(packageJSON.library)) {
    result = false
    badFields.push('library')
  }

  if (!areStaticDirectoriesValid(packageJSON.staticDirs)) {
    result = false
    badFields.push('staticDirs')
  }

  if (!areCSSPathsValid(packageJSON.css)) {
    result = false
    badFields.push('css')
  }

  if (!areClientScriptsValid(packageJSON.clientScripts)) {
    result = false
    badFields.push('clientScripts')
  }

  if (!areTranslationPathsValid(packageJSON.translations)) {
    result = false
    badFields.push('translations')
  }

  return { result, badFields }
}

export function isLibraryCodeValid (library: any) {
  return typeof library.register === 'function' &&
    typeof library.unregister === 'function'
}
