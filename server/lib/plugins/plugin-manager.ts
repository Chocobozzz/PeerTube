import { PluginModel } from '../../models/server/plugin'
import { logger } from '../../helpers/logger'
import { basename, join } from 'path'
import { CONFIG } from '../../initializers/config'
import { isLibraryCodeValid, isPackageJSONValid } from '../../helpers/custom-validators/plugins'
import {
  ClientScript,
  PluginPackageJson,
  PluginTranslationPaths as PackagePluginTranslations
} from '../../../shared/models/plugins/plugin-package-json.model'
import { createReadStream, createWriteStream } from 'fs'
import { PLUGIN_GLOBAL_CSS_PATH, VIDEO_CATEGORIES, VIDEO_LANGUAGES, VIDEO_LICENCES } from '../../initializers/constants'
import { PluginType } from '../../../shared/models/plugins/plugin.type'
import { installNpmPlugin, installNpmPluginFromDisk, removeNpmPlugin } from './yarn'
import { outputFile, readJSON } from 'fs-extra'
import { PluginSettingsManager } from '../../../shared/models/plugins/plugin-settings-manager.model'
import { PluginStorageManager } from '../../../shared/models/plugins/plugin-storage-manager.model'
import { ServerHook, ServerHookName, serverHookObject } from '../../../shared/models/plugins/server-hook.model'
import { getHookType, internalRunHook } from '../../../shared/core-utils/plugins/hooks'
import { RegisterServerOptions } from '../../typings/plugins/register-server-option.model'
import { PluginLibrary } from '../../typings/plugins'
import { ClientHtml } from '../client-html'
import { RegisterServerHookOptions } from '../../../shared/models/plugins/register-server-hook.model'
import { RegisterServerSettingOptions } from '../../../shared/models/plugins/register-server-setting.model'
import { PluginVideoLanguageManager } from '../../../shared/models/plugins/plugin-video-language-manager.model'
import { PluginVideoCategoryManager } from '../../../shared/models/plugins/plugin-video-category-manager.model'
import { PluginVideoLicenceManager } from '../../../shared/models/plugins/plugin-video-licence-manager.model'
import { PluginTranslation } from '../../../shared/models/plugins/plugin-translation.model'

export interface RegisteredPlugin {
  npmName: string
  name: string
  version: string
  description: string
  peertubeEngine: string

  type: PluginType

  path: string

  staticDirs: { [name: string]: string }
  clientScripts: { [name: string]: ClientScript }

  css: string[]

  // Only if this is a plugin
  unregister?: Function
}

export interface HookInformationValue {
  npmName: string
  pluginName: string
  handler: Function
  priority: number
}

type AlterableVideoConstant = 'language' | 'licence' | 'category'
type VideoConstant = { [key in number | string]: string }
type UpdatedVideoConstant = {
  [name in AlterableVideoConstant]: {
    [npmName: string]: {
      added: { key: number | string, label: string }[]
      deleted: { key: number | string, label: string }[]
    }
  }
}

type PluginLocalesTranslations = {
  [locale: string]: PluginTranslation
}

export class PluginManager implements ServerHook {

  private static instance: PluginManager

  private registeredPlugins: { [name: string]: RegisteredPlugin } = {}
  private settings: { [name: string]: RegisterServerSettingOptions[] } = {}
  private hooks: { [name: string]: HookInformationValue[] } = {}
  private translations: PluginLocalesTranslations = {}

  private readonly updatedVideoConstants: UpdatedVideoConstant = {
    language: {},
    licence: {},
    category: {}
  }

  private constructor () {
  }

  // ###################### Getters ######################

  isRegistered (npmName: string) {
    return !!this.getRegisteredPluginOrTheme(npmName)
  }

  getRegisteredPluginOrTheme (npmName: string) {
    return this.registeredPlugins[npmName]
  }

  getRegisteredPlugin (name: string) {
    const npmName = PluginModel.buildNpmName(name, PluginType.PLUGIN)
    const registered = this.getRegisteredPluginOrTheme(npmName)

    if (!registered || registered.type !== PluginType.PLUGIN) return undefined

    return registered
  }

  getRegisteredTheme (name: string) {
    const npmName = PluginModel.buildNpmName(name, PluginType.THEME)
    const registered = this.getRegisteredPluginOrTheme(npmName)

    if (!registered || registered.type !== PluginType.THEME) return undefined

    return registered
  }

  getRegisteredPlugins () {
    return this.getRegisteredPluginsOrThemes(PluginType.PLUGIN)
  }

  getRegisteredThemes () {
    return this.getRegisteredPluginsOrThemes(PluginType.THEME)
  }

  getRegisteredSettings (npmName: string) {
    return this.settings[npmName] || []
  }

  getTranslations (locale: string) {
    return this.translations[locale] || {}
  }

  // ###################### Hooks ######################

  async runHook<T> (hookName: ServerHookName, result?: T, params?: any): Promise<T> {
    if (!this.hooks[hookName]) return Promise.resolve(result)

    const hookType = getHookType(hookName)

    for (const hook of this.hooks[hookName]) {
      logger.debug('Running hook %s of plugin %s.', hookName, hook.npmName)

      result = await internalRunHook(hook.handler, hookType, result, params, err => {
        logger.error('Cannot run hook %s of plugin %s.', hookName, hook.pluginName, { err })
      })
    }

    return result
  }

  // ###################### Registration ######################

  async registerPluginsAndThemes () {
    await this.resetCSSGlobalFile()

    const plugins = await PluginModel.listEnabledPluginsAndThemes()

    for (const plugin of plugins) {
      try {
        await this.registerPluginOrTheme(plugin)
      } catch (err) {
        // Try to unregister the plugin
        try {
          await this.unregister(PluginModel.buildNpmName(plugin.name, plugin.type))
        } catch {
          // we don't care if we cannot unregister it
        }

        logger.error('Cannot register plugin %s, skipping.', plugin.name, { err })
      }
    }

    this.sortHooksByPriority()
  }

  // Don't need the plugin type since themes cannot register server code
  async unregister (npmName: string) {
    logger.info('Unregister plugin %s.', npmName)

    const plugin = this.getRegisteredPluginOrTheme(npmName)

    if (!plugin) {
      throw new Error(`Unknown plugin ${npmName} to unregister`)
    }

    delete this.registeredPlugins[plugin.npmName]
    delete this.settings[plugin.npmName]

    this.deleteTranslations(plugin.npmName)

    if (plugin.type === PluginType.PLUGIN) {
      await plugin.unregister()

      // Remove hooks of this plugin
      for (const key of Object.keys(this.hooks)) {
        this.hooks[key] = this.hooks[key].filter(h => h.npmName !== npmName)
      }

      this.reinitVideoConstants(plugin.npmName)

      logger.info('Regenerating registered plugin CSS to global file.')
      await this.regeneratePluginGlobalCSS()
    }
  }

  // ###################### Installation ######################

  async install (toInstall: string, version?: string, fromDisk = false) {
    let plugin: PluginModel
    let npmName: string

    logger.info('Installing plugin %s.', toInstall)

    try {
      fromDisk
        ? await installNpmPluginFromDisk(toInstall)
        : await installNpmPlugin(toInstall, version)

      npmName = fromDisk ? basename(toInstall) : toInstall
      const pluginType = PluginModel.getTypeFromNpmName(npmName)
      const pluginName = PluginModel.normalizePluginName(npmName)

      const packageJSON = await this.getPackageJSON(pluginName, pluginType)

      this.sanitizeAndCheckPackageJSONOrThrow(packageJSON, pluginType);

      [ plugin ] = await PluginModel.upsert({
        name: pluginName,
        description: packageJSON.description,
        homepage: packageJSON.homepage,
        type: pluginType,
        version: packageJSON.version,
        enabled: true,
        uninstalled: false,
        peertubeEngine: packageJSON.engine.peertube
      }, { returning: true })
    } catch (err) {
      logger.error('Cannot install plugin %s, removing it...', toInstall, { err })

      try {
        await removeNpmPlugin(npmName)
      } catch (err) {
        logger.error('Cannot remove plugin %s after failed installation.', toInstall, { err })
      }

      throw err
    }

    logger.info('Successful installation of plugin %s.', toInstall)

    await this.registerPluginOrTheme(plugin)

    return plugin
  }

  async update (toUpdate: string, version?: string, fromDisk = false) {
    const npmName = fromDisk ? basename(toUpdate) : toUpdate

    logger.info('Updating plugin %s.', npmName)

    // Unregister old hooks
    await this.unregister(npmName)

    return this.install(toUpdate, version, fromDisk)
  }

  async uninstall (npmName: string) {
    logger.info('Uninstalling plugin %s.', npmName)

    try {
      await this.unregister(npmName)
    } catch (err) {
      logger.warn('Cannot unregister plugin %s.', npmName, { err })
    }

    const plugin = await PluginModel.loadByNpmName(npmName)
    if (!plugin || plugin.uninstalled === true) {
      logger.error('Cannot uninstall plugin %s: it does not exist or is already uninstalled.', npmName)
      return
    }

    plugin.enabled = false
    plugin.uninstalled = true

    await plugin.save()

    await removeNpmPlugin(npmName)

    logger.info('Plugin %s uninstalled.', npmName)
  }

  // ###################### Private register ######################

  private async registerPluginOrTheme (plugin: PluginModel) {
    const npmName = PluginModel.buildNpmName(plugin.name, plugin.type)

    logger.info('Registering plugin or theme %s.', npmName)

    const packageJSON = await this.getPackageJSON(plugin.name, plugin.type)
    const pluginPath = this.getPluginPath(plugin.name, plugin.type)

    this.sanitizeAndCheckPackageJSONOrThrow(packageJSON, plugin.type)

    let library: PluginLibrary
    if (plugin.type === PluginType.PLUGIN) {
      library = await this.registerPlugin(plugin, pluginPath, packageJSON)
    }

    const clientScripts: { [id: string]: ClientScript } = {}
    for (const c of packageJSON.clientScripts) {
      clientScripts[c.script] = c
    }

    this.registeredPlugins[npmName] = {
      npmName,
      name: plugin.name,
      type: plugin.type,
      version: plugin.version,
      description: plugin.description,
      peertubeEngine: plugin.peertubeEngine,
      path: pluginPath,
      staticDirs: packageJSON.staticDirs,
      clientScripts,
      css: packageJSON.css,
      unregister: library ? library.unregister : undefined
    }

    await this.addTranslations(plugin, npmName, packageJSON.translations)
  }

  private async registerPlugin (plugin: PluginModel, pluginPath: string, packageJSON: PluginPackageJson) {
    const npmName = PluginModel.buildNpmName(plugin.name, plugin.type)

    // Delete cache if needed
    const modulePath = join(pluginPath, packageJSON.library)
    delete require.cache[modulePath]
    const library: PluginLibrary = require(modulePath)

    if (!isLibraryCodeValid(library)) {
      throw new Error('Library code is not valid (miss register or unregister function)')
    }

    const registerHelpers = this.getRegisterHelpers(npmName, plugin)
    library.register(registerHelpers)
           .catch(err => logger.error('Cannot register plugin %s.', npmName, { err }))

    logger.info('Add plugin %s CSS to global file.', npmName)

    await this.addCSSToGlobalFile(pluginPath, packageJSON.css)

    return library
  }

  // ###################### Translations ######################

  private async addTranslations (plugin: PluginModel, npmName: string, translationPaths: PackagePluginTranslations) {
    for (const locale of Object.keys(translationPaths)) {
      const path = translationPaths[locale]
      const json = await readJSON(join(this.getPluginPath(plugin.name, plugin.type), path))

      if (!this.translations[locale]) this.translations[locale] = {}
      this.translations[locale][npmName] = json

      logger.info('Added locale %s of plugin %s.', locale, npmName)
    }
  }

  private deleteTranslations (npmName: string) {
    for (const locale of Object.keys(this.translations)) {
      delete this.translations[locale][npmName]

      logger.info('Deleted locale %s of plugin %s.', locale, npmName)
    }
  }

  // ###################### CSS ######################

  private resetCSSGlobalFile () {
    ClientHtml.invalidCache()

    return outputFile(PLUGIN_GLOBAL_CSS_PATH, '')
  }

  private async addCSSToGlobalFile (pluginPath: string, cssRelativePaths: string[]) {
    for (const cssPath of cssRelativePaths) {
      await this.concatFiles(join(pluginPath, cssPath), PLUGIN_GLOBAL_CSS_PATH)
    }

    ClientHtml.invalidCache()
  }

  private concatFiles (input: string, output: string) {
    return new Promise<void>((res, rej) => {
      const inputStream = createReadStream(input)
      const outputStream = createWriteStream(output, { flags: 'a' })

      inputStream.pipe(outputStream)

      inputStream.on('end', () => res())
      inputStream.on('error', err => rej(err))
    })
  }

  private async regeneratePluginGlobalCSS () {
    await this.resetCSSGlobalFile()

    for (const plugin of this.getRegisteredPlugins()) {
      await this.addCSSToGlobalFile(plugin.path, plugin.css)
    }
  }

  // ###################### Utils ######################

  private sortHooksByPriority () {
    for (const hookName of Object.keys(this.hooks)) {
      this.hooks[hookName].sort((a, b) => {
        return b.priority - a.priority
      })
    }
  }

  private getPackageJSON (pluginName: string, pluginType: PluginType) {
    const pluginPath = join(this.getPluginPath(pluginName, pluginType), 'package.json')

    return readJSON(pluginPath) as Promise<PluginPackageJson>
  }

  private getPluginPath (pluginName: string, pluginType: PluginType) {
    const npmName = PluginModel.buildNpmName(pluginName, pluginType)

    return join(CONFIG.STORAGE.PLUGINS_DIR, 'node_modules', npmName)
  }

  // ###################### Private getters ######################

  private getRegisteredPluginsOrThemes (type: PluginType) {
    const plugins: RegisteredPlugin[] = []

    for (const npmName of Object.keys(this.registeredPlugins)) {
      const plugin = this.registeredPlugins[npmName]
      if (plugin.type !== type) continue

      plugins.push(plugin)
    }

    return plugins
  }

  // ###################### Generate register helpers ######################

  private getRegisterHelpers (npmName: string, plugin: PluginModel): RegisterServerOptions {
    const registerHook = (options: RegisterServerHookOptions) => {
      if (serverHookObject[options.target] !== true) {
        logger.warn('Unknown hook %s of plugin %s. Skipping.', options.target, npmName)
        return
      }

      if (!this.hooks[options.target]) this.hooks[options.target] = []

      this.hooks[options.target].push({
        npmName,
        pluginName: plugin.name,
        handler: options.handler,
        priority: options.priority || 0
      })
    }

    const registerSetting = (options: RegisterServerSettingOptions) => {
      if (!this.settings[npmName]) this.settings[npmName] = []

      this.settings[npmName].push(options)
    }

    const settingsManager: PluginSettingsManager = {
      getSetting: (name: string) => PluginModel.getSetting(plugin.name, plugin.type, name),

      setSetting: (name: string, value: string) => PluginModel.setSetting(plugin.name, plugin.type, name, value)
    }

    const storageManager: PluginStorageManager = {
      getData: (key: string) => PluginModel.getData(plugin.name, plugin.type, key),

      storeData: (key: string, data: any) => PluginModel.storeData(plugin.name, plugin.type, key, data)
    }

    const videoLanguageManager: PluginVideoLanguageManager = {
      addLanguage: (key: string, label: string) => this.addConstant({ npmName, type: 'language', obj: VIDEO_LANGUAGES, key, label }),

      deleteLanguage: (key: string) => this.deleteConstant({ npmName, type: 'language', obj: VIDEO_LANGUAGES, key })
    }

    const videoCategoryManager: PluginVideoCategoryManager = {
      addCategory: (key: number, label: string) => this.addConstant({ npmName, type: 'category', obj: VIDEO_CATEGORIES, key, label }),

      deleteCategory: (key: number) => this.deleteConstant({ npmName, type: 'category', obj: VIDEO_CATEGORIES, key })
    }

    const videoLicenceManager: PluginVideoLicenceManager = {
      addLicence: (key: number, label: string) => this.addConstant({ npmName, type: 'licence', obj: VIDEO_LICENCES, key, label }),

      deleteLicence: (key: number) => this.deleteConstant({ npmName, type: 'licence', obj: VIDEO_LICENCES, key })
    }

    const peertubeHelpers = {
      logger
    }

    return {
      registerHook,
      registerSetting,
      settingsManager,
      storageManager,
      videoLanguageManager,
      videoCategoryManager,
      videoLicenceManager,
      peertubeHelpers
    }
  }

  private addConstant<T extends string | number> (parameters: {
    npmName: string
    type: AlterableVideoConstant
    obj: VideoConstant
    key: T
    label: string
  }) {
    const { npmName, type, obj, key, label } = parameters

    if (obj[key]) {
      logger.warn('Cannot add %s %s by plugin %s: key already exists.', type, npmName, key)
      return false
    }

    if (!this.updatedVideoConstants[type][npmName]) {
      this.updatedVideoConstants[type][npmName] = {
        added: [],
        deleted: []
      }
    }

    this.updatedVideoConstants[type][npmName].added.push({ key, label })
    obj[key] = label

    return true
  }

  private deleteConstant<T extends string | number> (parameters: {
    npmName: string
    type: AlterableVideoConstant
    obj: VideoConstant
    key: T
  }) {
    const { npmName, type, obj, key } = parameters

    if (!obj[key]) {
      logger.warn('Cannot delete %s %s by plugin %s: key does not exist.', type, npmName, key)
      return false
    }

    if (!this.updatedVideoConstants[type][npmName]) {
      this.updatedVideoConstants[type][npmName] = {
        added: [],
        deleted: []
      }
    }

    this.updatedVideoConstants[type][npmName].deleted.push({ key, label: obj[key] })
    delete obj[key]

    return true
  }

  private reinitVideoConstants (npmName: string) {
    const hash = {
      language: VIDEO_LANGUAGES,
      licence: VIDEO_LICENCES,
      category: VIDEO_CATEGORIES
    }
    const types: AlterableVideoConstant[] = [ 'language', 'licence', 'category' ]

    for (const type of types) {
      const updatedConstants = this.updatedVideoConstants[type][npmName]
      if (!updatedConstants) continue

      for (const added of updatedConstants.added) {
        delete hash[type][added.key]
      }

      for (const deleted of updatedConstants.deleted) {
        hash[type][deleted.key] = deleted.label
      }

      delete this.updatedVideoConstants[type][npmName]
    }
  }

  private sanitizeAndCheckPackageJSONOrThrow (packageJSON: PluginPackageJson, pluginType: PluginType) {
    if (!packageJSON.staticDirs) packageJSON.staticDirs = {}
    if (!packageJSON.css) packageJSON.css = []
    if (!packageJSON.clientScripts) packageJSON.clientScripts = []
    if (!packageJSON.translations) packageJSON.translations = {}

    const { result: packageJSONValid, badFields } = isPackageJSONValid(packageJSON, pluginType)
    if (!packageJSONValid) {
      const formattedFields = badFields.map(f => `"${f}"`)
                                       .join(', ')

      throw new Error(`PackageJSON is invalid (invalid fields: ${formattedFields}).`)
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
