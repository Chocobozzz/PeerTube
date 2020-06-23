import { createReadStream, createWriteStream } from 'fs'
import { outputFile, readJSON } from 'fs-extra'
import { basename, join } from 'path'
import { MOAuthTokenUser, MUser } from '@server/types/models'
import { RegisterServerHookOptions } from '@shared/models/plugins/register-server-hook.model'
import { getHookType, internalRunHook } from '../../../shared/core-utils/plugins/hooks'
import {
  ClientScript,
  PluginPackageJson,
  PluginTranslationPaths as PackagePluginTranslations
} from '../../../shared/models/plugins/plugin-package-json.model'
import { PluginTranslation } from '../../../shared/models/plugins/plugin-translation.model'
import { PluginType } from '../../../shared/models/plugins/plugin.type'
import { ServerHook, ServerHookName } from '../../../shared/models/plugins/server-hook.model'
import { isLibraryCodeValid, isPackageJSONValid } from '../../helpers/custom-validators/plugins'
import { logger } from '../../helpers/logger'
import { CONFIG } from '../../initializers/config'
import { PLUGIN_GLOBAL_CSS_PATH } from '../../initializers/constants'
import { PluginModel } from '../../models/server/plugin'
import { PluginLibrary, RegisterServerAuthExternalOptions, RegisterServerAuthPassOptions, RegisterServerOptions } from '../../types/plugins'
import { ClientHtml } from '../client-html'
import { RegisterHelpersStore } from './register-helpers-store'
import { installNpmPlugin, installNpmPluginFromDisk, removeNpmPlugin } from './yarn'

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
  registerHelpersStore?: RegisterHelpersStore
  unregister?: Function
}

export interface HookInformationValue {
  npmName: string
  pluginName: string
  handler: Function
  priority: number
}

type PluginLocalesTranslations = {
  [locale: string]: PluginTranslation
}

export class PluginManager implements ServerHook {

  private static instance: PluginManager

  private registeredPlugins: { [name: string]: RegisteredPlugin } = {}

  private hooks: { [name: string]: HookInformationValue[] } = {}
  private translations: PluginLocalesTranslations = {}

  private constructor () {
  }

  // ###################### Getters ######################

  isRegistered (npmName: string) {
    return !!this.getRegisteredPluginOrTheme(npmName)
  }

  getRegisteredPluginOrTheme (npmName: string) {
    return this.registeredPlugins[npmName]
  }

  getRegisteredPluginByShortName (name: string) {
    const npmName = PluginModel.buildNpmName(name, PluginType.PLUGIN)
    const registered = this.getRegisteredPluginOrTheme(npmName)

    if (!registered || registered.type !== PluginType.PLUGIN) return undefined

    return registered
  }

  getRegisteredThemeByShortName (name: string) {
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

  getIdAndPassAuths () {
    return this.getRegisteredPlugins()
      .map(p => ({
        npmName: p.npmName,
        name: p.name,
        version: p.version,
        idAndPassAuths: p.registerHelpersStore.getIdAndPassAuths()
      }))
      .filter(v => v.idAndPassAuths.length !== 0)
  }

  getExternalAuths () {
    return this.getRegisteredPlugins()
      .map(p => ({
        npmName: p.npmName,
        name: p.name,
        version: p.version,
        externalAuths: p.registerHelpersStore.getExternalAuths()
      }))
      .filter(v => v.externalAuths.length !== 0)
  }

  getRegisteredSettings (npmName: string) {
    const result = this.getRegisteredPluginOrTheme(npmName)
    if (!result || result.type !== PluginType.PLUGIN) return []

    return result.registerHelpersStore.getSettings()
  }

  getRouter (npmName: string) {
    const result = this.getRegisteredPluginOrTheme(npmName)
    if (!result || result.type !== PluginType.PLUGIN) return null

    return result.registerHelpersStore.getRouter()
  }

  getTranslations (locale: string) {
    return this.translations[locale] || {}
  }

  async isTokenValid (token: MOAuthTokenUser, type: 'access' | 'refresh') {
    const auth = this.getAuth(token.User.pluginAuth, token.authName)
    if (!auth) return true

    if (auth.hookTokenValidity) {
      try {
        const { valid } = await auth.hookTokenValidity({ token, type })

        if (valid === false) {
          logger.info('Rejecting %s token validity from auth %s of plugin %s', type, token.authName, token.User.pluginAuth)
        }

        return valid
      } catch (err) {
        logger.warn('Cannot run check token validity from auth %s of plugin %s.', token.authName, token.User.pluginAuth, { err })
        return true
      }
    }

    return true
  }

  // ###################### External events ######################

  onLogout (npmName: string, authName: string, user: MUser) {
    const auth = this.getAuth(npmName, authName)

    if (auth?.onLogout) {
      logger.info('Running onLogout function from auth %s of plugin %s', authName, npmName)

      try {
        auth.onLogout(user)
      } catch (err) {
        logger.warn('Cannot run onLogout function from auth %s of plugin %s.', authName, npmName, { err })
      }
    }
  }

  onSettingsChanged (name: string, settings: any) {
    const registered = this.getRegisteredPluginByShortName(name)
    if (!registered) {
      logger.error('Cannot find plugin %s to call on settings changed.', name)
    }

    for (const cb of registered.registerHelpersStore.getOnSettingsChangedCallbacks()) {
      try {
        cb(settings)
      } catch (err) {
        logger.error('Cannot run on settings changed callback for %s.', registered.npmName, { err })
      }
    }
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

    this.deleteTranslations(plugin.npmName)

    if (plugin.type === PluginType.PLUGIN) {
      await plugin.unregister()

      // Remove hooks of this plugin
      for (const key of Object.keys(this.hooks)) {
        this.hooks[key] = this.hooks[key].filter(h => h.npmName !== npmName)
      }

      const store = plugin.registerHelpersStore
      store.reinitVideoConstants(plugin.npmName)

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
    let registerHelpersStore: RegisterHelpersStore
    if (plugin.type === PluginType.PLUGIN) {
      const result = await this.registerPlugin(plugin, pluginPath, packageJSON)
      library = result.library
      registerHelpersStore = result.registerStore
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
      registerHelpersStore: registerHelpersStore || undefined,
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

    const { registerOptions, registerStore } = this.getRegisterHelpers(npmName, plugin)
    library.register(registerOptions)
           .catch(err => logger.error('Cannot register plugin %s.', npmName, { err }))

    logger.info('Add plugin %s CSS to global file.', npmName)

    await this.addCSSToGlobalFile(pluginPath, packageJSON.css)

    return { library, registerStore }
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

  private getAuth (npmName: string, authName: string) {
    const plugin = this.getRegisteredPluginOrTheme(npmName)
    if (!plugin || plugin.type !== PluginType.PLUGIN) return null

    let auths: (RegisterServerAuthPassOptions | RegisterServerAuthExternalOptions)[] = plugin.registerHelpersStore.getIdAndPassAuths()
    auths = auths.concat(plugin.registerHelpersStore.getExternalAuths())

    return auths.find(a => a.authName === authName)
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

  private getRegisterHelpers (
    npmName: string,
    plugin: PluginModel
  ): { registerStore: RegisterHelpersStore, registerOptions: RegisterServerOptions } {
    const onHookAdded = (options: RegisterServerHookOptions) => {
      if (!this.hooks[options.target]) this.hooks[options.target] = []

      this.hooks[options.target].push({
        npmName: npmName,
        pluginName: plugin.name,
        handler: options.handler,
        priority: options.priority || 0
      })
    }

    const registerHelpersStore = new RegisterHelpersStore(npmName, plugin, onHookAdded.bind(this))

    return {
      registerStore: registerHelpersStore,
      registerOptions: registerHelpersStore.buildRegisterHelpers()
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
