import { exists, isArray, isSafePath } from './misc'
import * as validator from 'validator'
import { PluginType } from '../../../shared/models/plugins/plugin.type'
import { CONSTRAINTS_FIELDS } from '../../initializers/constants'
import { PluginPackageJson } from '../../../shared/models/plugins/plugin-package-json.model'
import { isUrlValid } from './activitypub/misc'

const PLUGINS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.PLUGINS

function isPluginTypeValid (value: any) {
  return exists(value) && validator.isInt('' + value) && PluginType[value] !== undefined
}

function isPluginNameValid (value: string) {
  return exists(value) &&
    validator.isLength(value, PLUGINS_CONSTRAINTS_FIELDS.NAME) &&
    validator.matches(value, /^[a-z\-]+$/)
}

function isNpmPluginNameValid (value: string) {
  return exists(value) &&
    validator.isLength(value, PLUGINS_CONSTRAINTS_FIELDS.NAME) &&
    validator.matches(value, /^[a-z\-]+$/) &&
    (value.startsWith('peertube-plugin-') || value.startsWith('peertube-theme-'))
}

function isPluginDescriptionValid (value: string) {
  return exists(value) && validator.isLength(value, PLUGINS_CONSTRAINTS_FIELDS.DESCRIPTION)
}

function isPluginVersionValid (value: string) {
  if (!exists(value)) return false

  const parts = (value + '').split('.')

  return parts.length === 3 && parts.every(p => validator.isInt(p))
}

function isPluginEngineValid (engine: any) {
  return exists(engine) && exists(engine.peertube)
}

function isPluginHomepage (value: string) {
  return exists(value) && (!value || isUrlValid(value))
}

function isPluginBugs (value: string) {
  return exists(value) && (!value || isUrlValid(value))
}

function areStaticDirectoriesValid (staticDirs: any) {
  if (!exists(staticDirs) || typeof staticDirs !== 'object') return false

  for (const key of Object.keys(staticDirs)) {
    if (!isSafePath(staticDirs[key])) return false
  }

  return true
}

function areClientScriptsValid (clientScripts: any[]) {
  return isArray(clientScripts) &&
    clientScripts.every(c => {
      return isSafePath(c.script) && isArray(c.scopes)
    })
}

function areTranslationPathsValid (translations: any) {
  if (!exists(translations) || typeof translations !== 'object') return false

  for (const key of Object.keys(translations)) {
    if (!isSafePath(translations[key])) return false
  }

  return true
}

function areCSSPathsValid (css: any[]) {
  return isArray(css) && css.every(c => isSafePath(c))
}

function isThemeNameValid (name: string) {
  return isPluginNameValid(name)
}

function isPackageJSONValid (packageJSON: PluginPackageJson, pluginType: PluginType) {
  return isNpmPluginNameValid(packageJSON.name) &&
    isPluginDescriptionValid(packageJSON.description) &&
    isPluginEngineValid(packageJSON.engine) &&
    isPluginHomepage(packageJSON.homepage) &&
    exists(packageJSON.author) &&
    isPluginBugs(packageJSON.bugs) &&
    (pluginType === PluginType.THEME || isSafePath(packageJSON.library)) &&
    areStaticDirectoriesValid(packageJSON.staticDirs) &&
    areCSSPathsValid(packageJSON.css) &&
    areClientScriptsValid(packageJSON.clientScripts) &&
    areTranslationPathsValid(packageJSON.translations)
}

function isLibraryCodeValid (library: any) {
  return typeof library.register === 'function'
    && typeof library.unregister === 'function'
}

export {
  isPluginTypeValid,
  isPackageJSONValid,
  isThemeNameValid,
  isPluginHomepage,
  isPluginVersionValid,
  isPluginNameValid,
  isPluginDescriptionValid,
  isLibraryCodeValid,
  isNpmPluginNameValid
}
