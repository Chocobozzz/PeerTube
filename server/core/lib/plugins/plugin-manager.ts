import express from 'express'
import { createReadStream, createWriteStream } from 'fs'
import { ensureDir, outputFile, readJSON } from 'fs-extra/esm'
import { Server } from 'http'
import { createRequire } from 'module'
import { basename, join } from 'path'
import { getCompleteLocale, getHookType, internalRunHook } from '@peertube/peertube-core-utils'
import {
  ClientScriptJSON,
  PluginPackageJSON,
  PluginTranslation,
  PluginTranslationPathsJSON,
  PluginType,
  PluginType_Type,
  RegisterServerHookOptions,
  ServerHook,
  ServerHookName
} from '@peertube/peertube-models'
import { decachePlugin } from '@server/helpers/decache.js'
import { ApplicationModel } from '@server/models/application/application.js'
import { MOAuthTokenUser, MUser } from '@server/types/models/index.js'
import { isLibraryCodeValid, isPackageJSONValid } from '../../helpers/custom-validators/plugins.js'
import { logger } from '../../helpers/logger.js'
import { CONFIG } from '../../initializers/config.js'
import { PLUGIN_GLOBAL_CSS_PATH } from '../../initializers/constants.js'
import { PluginModel } from '../../models/server/plugin.js'
import {
  PluginLibrary,
  RegisterServerAuthExternalOptions,
  RegisterServerAuthPassOptions,
  RegisterServerOptions
} from '../../types/plugins/index.js'
import { ClientHtml } from '../html/client-html.js'
import { RegisterHelpers } from './register-helpers.js'
import { installNpmPlugin, installNpmPluginFromDisk, rebuildNativePlugins, removeNpmPlugin } from './yarn.js'

const require = createRequire(import.meta.url)

export interface RegisteredPlugin {
  npmName: string
  name: string
  version: string
  description: string
  peertubeEngine: string

  type: PluginType_Type

  path: string

  staticDirs: { [name: string]: string }
  clientScripts: { [name: string]: ClientScriptJSON }

  css: string[]

  // Only if this is a plugin
  registerHelpers?: RegisterHelpers
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

  private server: Server

  private constructor () {
  }

  init (server: Server) {
    this.server = server
  }

  registerWebSocketRouter () {
    this.server.on('upgrade', (request, socket, head) => {
      // Check if it's a plugin websocket connection
      // No need to destroy the stream when we abort the request
      // Other handlers in PeerTube will catch this upgrade event too (socket.io, tracker etc)

      const url = request.url

      const matched = url.match(`/plugins/([^/]+)/([^/]+/)?ws(/.*)`)
      if (!matched) return

      const npmName = PluginModel.buildNpmName(matched[1], PluginType.PLUGIN)
      const subRoute = matched[3]

      const result = this.getRegisteredPluginOrTheme(npmName)
      if (!result) return

      const routes = result.registerHelpers.getWebSocketRoutes()

      const wss = routes.find(r => r.route.startsWith(subRoute))
      if (!wss) return

      try {
        wss.handler(request, socket, head)
      } catch (err) {
        logger.error('Exception in plugin handler ' + npmName, { err })
      }
    })
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
        idAndPassAuths: p.registerHelpers.getIdAndPassAuths()
      }))
      .filter(v => v.idAndPassAuths.length !== 0)
  }

  getExternalAuths () {
    return this.getRegisteredPlugins()
      .map(p => ({
        npmName: p.npmName,
        name: p.name,
        version: p.version,
        externalAuths: p.registerHelpers.getExternalAuths()
      }))
      .filter(v => v.externalAuths.length !== 0)
  }

  getRegisteredSettings (npmName: string) {
    const result = this.getRegisteredPluginOrTheme(npmName)
    if (!result || result.type !== PluginType.PLUGIN) return []

    return result.registerHelpers.getSettings()
  }

  getRouter (npmName: string) {
    const result = this.getRegisteredPluginOrTheme(npmName)
    if (!result || result.type !== PluginType.PLUGIN) return null

    return result.registerHelpers.getRouter()
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

  async onLogout (npmName: string, authName: string, user: MUser, req: express.Request) {
    const auth = this.getAuth(npmName, authName)

    if (auth?.onLogout) {
      logger.info('Running onLogout function from auth %s of plugin %s', authName, npmName)

      try {
        // Force await, in case or onLogout returns a promise
        const result = await auth.onLogout(user, req)

        return typeof result === 'string'
          ? result
          : undefined
      } catch (err) {
        logger.warn('Cannot run onLogout function from auth %s of plugin %s.', authName, npmName, { err })
      }
    }

    return undefined
  }

  async onSettingsChanged (name: string, settings: any) {
    const registered = this.getRegisteredPluginByShortName(name)
    if (!registered) {
      logger.error('Cannot find plugin %s to call on settings changed.', name)
    }

    for (const cb of registered.registerHelpers.getOnSettingsChangedCallbacks()) {
      try {
        await cb(settings)
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

      result = await internalRunHook({
        handler: hook.handler,
        hookType,
        result,
        params,
        onError: err => { logger.error('Cannot run hook %s of plugin %s.', hookName, hook.pluginName, { err }) }
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

      const store = plugin.registerHelpers
      store.reinitVideoConstants(plugin.npmName)
      store.reinitTranscodingProfilesAndEncoders(plugin.npmName)

      logger.info('Regenerating registered plugin CSS to global file.')
      await this.regeneratePluginGlobalCSS()
    }

    ClientHtml.invalidateCache()
  }

  // ###################### Installation ######################

  async install (options: {
    toInstall: string
    version?: string
    fromDisk?: boolean // default false
    register?: boolean // default true
  }) {
    const { toInstall, version, fromDisk = false, register = true } = options

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

      logger.info('Successful installation of plugin %s.', toInstall)

      if (register) {
        await this.registerPluginOrTheme(plugin)
      }
    } catch (rootErr) {
      logger.error('Cannot install plugin %s, removing it...', toInstall, { err: rootErr })

      if (npmName) {
        try {
          await this.uninstall({ npmName })
        } catch (err) {
          logger.error('Cannot uninstall plugin %s after failed installation.', toInstall, { err })

          try {
            await removeNpmPlugin(npmName)
          } catch (err) {
            logger.error('Cannot remove plugin %s after failed installation.', toInstall, { err })
          }
        }
      }

      throw rootErr
    }

    return plugin
  }

  async update (toUpdate: string, fromDisk = false) {
    const npmName = fromDisk ? basename(toUpdate) : toUpdate

    logger.info('Updating plugin %s.', npmName)

    // Use the latest version from DB, to not upgrade to a version that does not support our PeerTube version
    let version: string
    if (!fromDisk) {
      const plugin = await PluginModel.loadByNpmName(toUpdate)
      version = plugin.latestVersion
    }

    // Unregister old hooks
    await this.unregister(npmName)

    return this.install({ toInstall: toUpdate, version, fromDisk })
  }

  async uninstall (options: {
    npmName: string
    unregister?: boolean // default true
  }) {
    const { npmName, unregister = true } = options

    logger.info('Uninstalling plugin %s.', npmName)

    if (unregister) {
      try {
        await this.unregister(npmName)
      } catch (err) {
        logger.warn('Cannot unregister plugin %s.', npmName, { err })
      }
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

  async rebuildNativePluginsIfNeeded () {
    if (!await ApplicationModel.nodeABIChanged()) return

    return rebuildNativePlugins()
  }

  // ###################### Private register ######################

  private async registerPluginOrTheme (plugin: PluginModel) {
    const npmName = PluginModel.buildNpmName(plugin.name, plugin.type)

    logger.info('Registering plugin or theme %s.', npmName)

    const packageJSON = await this.getPackageJSON(plugin.name, plugin.type)
    const pluginPath = this.getPluginPath(plugin.name, plugin.type)

    this.sanitizeAndCheckPackageJSONOrThrow(packageJSON, plugin.type)

    let library: PluginLibrary
    let registerHelpers: RegisterHelpers
    if (plugin.type === PluginType.PLUGIN) {
      const result = await this.registerPlugin(plugin, pluginPath, packageJSON)
      library = result.library
      registerHelpers = result.registerStore
    }

    const clientScripts: { [id: string]: ClientScriptJSON } = {}
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
      registerHelpers: registerHelpers || undefined,
      unregister: library ? library.unregister : undefined
    }

    await this.addTranslations(plugin, npmName, packageJSON.translations)

    ClientHtml.invalidateCache()
  }

  private async registerPlugin (plugin: PluginModel, pluginPath: string, packageJSON: PluginPackageJSON) {
    const npmName = PluginModel.buildNpmName(plugin.name, plugin.type)

    // Delete cache if needed
    const modulePath = join(pluginPath, packageJSON.library)
    decachePlugin(require, modulePath)
    const library: PluginLibrary = require(modulePath)

    if (!isLibraryCodeValid(library)) {
      throw new Error('Library code is not valid (miss register or unregister function)')
    }

    const { registerOptions, registerStore } = this.getRegisterHelpers(npmName, plugin)

    await ensureDir(registerOptions.peertubeHelpers.plugin.getDataDirectoryPath())

    await library.register(registerOptions)

    logger.info('Add plugin %s CSS to global file.', npmName)

    await this.addCSSToGlobalFile(pluginPath, packageJSON.css)

    return { library, registerStore }
  }

  // ###################### Translations ######################

  private async addTranslations (plugin: PluginModel, npmName: string, translationPaths: PluginTranslationPathsJSON) {
    for (const locale of Object.keys(translationPaths)) {
      const path = translationPaths[locale]
      const json = await readJSON(join(this.getPluginPath(plugin.name, plugin.type), path))

      const completeLocale = getCompleteLocale(locale)

      if (!this.translations[completeLocale]) this.translations[completeLocale] = {}
      this.translations[completeLocale][npmName] = json

      logger.info('Added locale %s of plugin %s.', completeLocale, npmName)
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
    return outputFile(PLUGIN_GLOBAL_CSS_PATH, '')
  }

  private async addCSSToGlobalFile (pluginPath: string, cssRelativePaths: string[]) {
    for (const cssPath of cssRelativePaths) {
      await this.concatFiles(join(pluginPath, cssPath), PLUGIN_GLOBAL_CSS_PATH)
    }
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

  private getPackageJSON (pluginName: string, pluginType: PluginType_Type) {
    const pluginPath = join(this.getPluginPath(pluginName, pluginType), 'package.json')

    return readJSON(pluginPath) as Promise<PluginPackageJSON>
  }

  private getPluginPath (pluginName: string, pluginType: PluginType_Type) {
    const npmName = PluginModel.buildNpmName(pluginName, pluginType)

    return join(CONFIG.STORAGE.PLUGINS_DIR, 'node_modules', npmName)
  }

  private getAuth (npmName: string, authName: string) {
    const plugin = this.getRegisteredPluginOrTheme(npmName)
    if (!plugin || plugin.type !== PluginType.PLUGIN) return null

    let auths: (RegisterServerAuthPassOptions | RegisterServerAuthExternalOptions)[] = plugin.registerHelpers.getIdAndPassAuths()
    auths = auths.concat(plugin.registerHelpers.getExternalAuths())

    return auths.find(a => a.authName === authName)
  }

  // ###################### Private getters ######################

  private getRegisteredPluginsOrThemes (type: PluginType_Type) {
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
  ): { registerStore: RegisterHelpers, registerOptions: RegisterServerOptions } {
    const onHookAdded = (options: RegisterServerHookOptions) => {
      if (!this.hooks[options.target]) this.hooks[options.target] = []

      this.hooks[options.target].push({
        npmName,
        pluginName: plugin.name,
        handler: options.handler,
        priority: options.priority || 0
      })
    }

    const registerHelpers = new RegisterHelpers(npmName, plugin, this.server, onHookAdded.bind(this))

    return {
      registerStore: registerHelpers,
      registerOptions: registerHelpers.buildRegisterHelpers()
    }
  }

  private sanitizeAndCheckPackageJSONOrThrow (packageJSON: PluginPackageJSON, pluginType: PluginType_Type) {
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
