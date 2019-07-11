import { PluginModel } from '../../models/server/plugin'
import { logger } from '../../helpers/logger'
import { basename, join } from 'path'
import { CONFIG } from '../../initializers/config'
import { isLibraryCodeValid, isPackageJSONValid } from '../../helpers/custom-validators/plugins'
import { ClientScript, PluginPackageJson } from '../../../shared/models/plugins/plugin-package-json.model'
import { PluginLibrary } from '../../../shared/models/plugins/plugin-library.model'
import { createReadStream, createWriteStream } from 'fs'
import { PLUGIN_GLOBAL_CSS_PATH } from '../../initializers/constants'
import { PluginType } from '../../../shared/models/plugins/plugin.type'
import { installNpmPlugin, installNpmPluginFromDisk, removeNpmPlugin } from './yarn'
import { outputFile } from 'fs-extra'
import { RegisterSettingOptions } from '../../../shared/models/plugins/register-setting.model'
import { RegisterHookOptions } from '../../../shared/models/plugins/register-hook.model'
import { PluginSettingsManager } from '../../../shared/models/plugins/plugin-settings-manager.model'

export interface RegisteredPlugin {
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
  pluginName: string
  handler: Function
  priority: number
}

export class PluginManager {

  private static instance: PluginManager

  private registeredPlugins: { [ name: string ]: RegisteredPlugin } = {}
  private settings: { [ name: string ]: RegisterSettingOptions[] } = {}
  private hooks: { [ name: string ]: HookInformationValue[] } = {}

  private constructor () {
  }

  // ###################### Getters ######################

  getRegisteredPluginOrTheme (name: string) {
    return this.registeredPlugins[name]
  }

  getRegisteredPlugin (name: string) {
    const registered = this.getRegisteredPluginOrTheme(name)

    if (!registered || registered.type !== PluginType.PLUGIN) return undefined

    return registered
  }

  getRegisteredTheme (name: string) {
    const registered = this.getRegisteredPluginOrTheme(name)

    if (!registered || registered.type !== PluginType.THEME) return undefined

    return registered
  }

  getRegisteredPlugins () {
    return this.getRegisteredPluginsOrThemes(PluginType.PLUGIN)
  }

  getRegisteredThemes () {
    return this.getRegisteredPluginsOrThemes(PluginType.THEME)
  }

  getSettings (name: string) {
    return this.settings[name] || []
  }

  // ###################### Hooks ######################

  async runHook (hookName: string, param?: any) {
    let result = param

    if (!this.hooks[hookName]) return result

    const wait = hookName.startsWith('static:')

    for (const hook of this.hooks[hookName]) {
      try {
        if (wait) {
          result = await hook.handler(param)
        } else {
          result = hook.handler()
        }
      } catch (err) {
        logger.error('Cannot run hook %s of plugin %s.', hookName, hook.pluginName, { err })
      }
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
        logger.error('Cannot register plugin %s, skipping.', plugin.name, { err })
      }
    }

    this.sortHooksByPriority()
  }

  async unregister (name: string) {
    const plugin = this.getRegisteredPlugin(name)

    if (!plugin) {
      throw new Error(`Unknown plugin ${name} to unregister`)
    }

    if (plugin.type === PluginType.THEME) {
      throw new Error(`Cannot unregister ${name}: this is a theme`)
    }

    await plugin.unregister()

    // Remove hooks of this plugin
    for (const key of Object.keys(this.hooks)) {
      this.hooks[key] = this.hooks[key].filter(h => h.pluginName !== name)
    }

    delete this.registeredPlugins[plugin.name]

    logger.info('Regenerating registered plugin CSS to global file.')
    await this.regeneratePluginGlobalCSS()
  }

  // ###################### Installation ######################

  async install (toInstall: string, version?: string, fromDisk = false) {
    let plugin: PluginModel
    let name: string

    logger.info('Installing plugin %s.', toInstall)

    try {
      fromDisk
        ? await installNpmPluginFromDisk(toInstall)
        : await installNpmPlugin(toInstall, version)

      name = fromDisk ? basename(toInstall) : toInstall
      const pluginType = PluginModel.getTypeFromNpmName(name)
      const pluginName = PluginModel.normalizePluginName(name)

      const packageJSON = this.getPackageJSON(pluginName, pluginType)
      if (!isPackageJSONValid(packageJSON, pluginType)) {
        throw new Error('PackageJSON is invalid.')
      }

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
        await removeNpmPlugin(name)
      } catch (err) {
        logger.error('Cannot remove plugin %s after failed installation.', toInstall, { err })
      }

      throw err
    }

    logger.info('Successful installation of plugin %s.', toInstall)

    await this.registerPluginOrTheme(plugin)
  }

  async uninstall (npmName: string) {
    logger.info('Uninstalling plugin %s.', npmName)

    const pluginName = PluginModel.normalizePluginName(npmName)

    try {
      await this.unregister(pluginName)
    } catch (err) {
      logger.warn('Cannot unregister plugin %s.', pluginName, { err })
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
    logger.info('Registering plugin or theme %s.', plugin.name)

    const packageJSON = this.getPackageJSON(plugin.name, plugin.type)
    const pluginPath = this.getPluginPath(plugin.name, plugin.type)

    if (!isPackageJSONValid(packageJSON, plugin.type)) {
      throw new Error('Package.JSON is invalid.')
    }

    let library: PluginLibrary
    if (plugin.type === PluginType.PLUGIN) {
      library = await this.registerPlugin(plugin, pluginPath, packageJSON)
    }

    const clientScripts: { [id: string]: ClientScript } = {}
    for (const c of packageJSON.clientScripts) {
      clientScripts[c.script] = c
    }

    this.registeredPlugins[ plugin.name ] = {
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
  }

  private async registerPlugin (plugin: PluginModel, pluginPath: string, packageJSON: PluginPackageJson) {
    const registerHook = (options: RegisterHookOptions) => {
      if (!this.hooks[options.target]) this.hooks[options.target] = []

      this.hooks[options.target].push({
        pluginName: plugin.name,
        handler: options.handler,
        priority: options.priority || 0
      })
    }

    const registerSetting = (options: RegisterSettingOptions) => {
      if (!this.settings[plugin.name]) this.settings[plugin.name] = []

      this.settings[plugin.name].push(options)
    }

    const settingsManager: PluginSettingsManager = {
      getSetting: (name: string) => PluginModel.getSetting(plugin.name, name),

      setSetting: (name: string, value: string) => PluginModel.setSetting(plugin.name, name, value)
    }

    const library: PluginLibrary = require(join(pluginPath, packageJSON.library))

    if (!isLibraryCodeValid(library)) {
      throw new Error('Library code is not valid (miss register or unregister function)')
    }

    library.register({ registerHook, registerSetting, settingsManager })

    logger.info('Add plugin %s CSS to global file.', plugin.name)

    await this.addCSSToGlobalFile(pluginPath, packageJSON.css)

    return library
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

    for (const key of Object.keys(this.registeredPlugins)) {
      const plugin = this.registeredPlugins[key]

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

    return require(pluginPath) as PluginPackageJson
  }

  private getPluginPath (pluginName: string, pluginType: PluginType) {
    const prefix = pluginType === PluginType.PLUGIN ? 'peertube-plugin-' : 'peertube-theme-'

    return join(CONFIG.STORAGE.PLUGINS_DIR, 'node_modules', prefix + pluginName)
  }

  // ###################### Private getters ######################

  private getRegisteredPluginsOrThemes (type: PluginType) {
    const plugins: RegisteredPlugin[] = []

    for (const pluginName of Object.keys(this.registeredPlugins)) {
      const plugin = this.registeredPlugins[ pluginName ]
      if (plugin.type !== type) continue

      plugins.push(plugin)
    }

    return plugins
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
