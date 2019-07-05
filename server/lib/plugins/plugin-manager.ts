import { PluginModel } from '../../models/server/plugin'
import { logger } from '../../helpers/logger'
import { RegisterHookOptions } from '../../../shared/models/plugins/register.model'
import { basename, join } from 'path'
import { CONFIG } from '../../initializers/config'
import { isLibraryCodeValid, isPackageJSONValid } from '../../helpers/custom-validators/plugins'
import { PluginPackageJson } from '../../../shared/models/plugins/plugin-package-json.model'
import { PluginLibrary } from '../../../shared/models/plugins/plugin-library.model'
import { createReadStream, createWriteStream } from 'fs'
import { PLUGIN_GLOBAL_CSS_PATH } from '../../initializers/constants'
import { PluginType } from '../../../shared/models/plugins/plugin.type'
import { installNpmPlugin, installNpmPluginFromDisk, removeNpmPlugin } from './yarn'

export interface RegisteredPlugin {
  name: string
  version: string
  description: string
  peertubeEngine: string

  type: PluginType

  path: string

  staticDirs: { [name: string]: string }

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
  private hooks: { [ name: string ]: HookInformationValue[] } = {}

  private constructor () {
  }

  async registerPlugins () {
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

  getRegisteredPlugin (name: string) {
    return this.registeredPlugins[ name ]
  }

  getRegisteredTheme (name: string) {
    const registered = this.getRegisteredPlugin(name)

    if (!registered || registered.type !== PluginType.THEME) return undefined

    return registered
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
  }

  async install (toInstall: string, version: string, fromDisk = false) {
    let plugin: PluginModel
    let name: string

    logger.info('Installing plugin %s.', toInstall)

    try {
      fromDisk
        ? await installNpmPluginFromDisk(toInstall)
        : await installNpmPlugin(toInstall, version)

      name = fromDisk ? basename(toInstall) : toInstall
      const pluginType = name.startsWith('peertube-theme-') ? PluginType.THEME : PluginType.PLUGIN
      const pluginName = this.normalizePluginName(name)

      const packageJSON = this.getPackageJSON(pluginName, pluginType)
      if (!isPackageJSONValid(packageJSON, pluginType)) {
        throw new Error('PackageJSON is invalid.')
      }

      [ plugin ] = await PluginModel.upsert({
        name: pluginName,
        description: packageJSON.description,
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

  async uninstall (packageName: string) {
    await PluginModel.uninstall(this.normalizePluginName(packageName))

    await removeNpmPlugin(packageName)
  }

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

    this.registeredPlugins[ plugin.name ] = {
      name: plugin.name,
      type: plugin.type,
      version: plugin.version,
      description: plugin.description,
      peertubeEngine: plugin.peertubeEngine,
      path: pluginPath,
      staticDirs: packageJSON.staticDirs,
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

    const library: PluginLibrary = require(join(pluginPath, packageJSON.library))

    if (!isLibraryCodeValid(library)) {
      throw new Error('Library code is not valid (miss register or unregister function)')
    }

    library.register({ registerHook })

    logger.info('Add plugin %s CSS to global file.', plugin.name)

    await this.addCSSToGlobalFile(pluginPath, packageJSON.css)

    return library
  }

  private sortHooksByPriority () {
    for (const hookName of Object.keys(this.hooks)) {
      this.hooks[hookName].sort((a, b) => {
        return b.priority - a.priority
      })
    }
  }

  private async addCSSToGlobalFile (pluginPath: string, cssRelativePaths: string[]) {
    for (const cssPath of cssRelativePaths) {
      await this.concatFiles(join(pluginPath, cssPath), PLUGIN_GLOBAL_CSS_PATH)
    }
  }

  private concatFiles (input: string, output: string) {
    return new Promise<void>((res, rej) => {
      const outputStream = createWriteStream(input)
      const inputStream = createReadStream(output)

      inputStream.pipe(outputStream)

      inputStream.on('end', () => res())
      inputStream.on('error', err => rej(err))
    })
  }

  private getPackageJSON (pluginName: string, pluginType: PluginType) {
    const pluginPath = join(this.getPluginPath(pluginName, pluginType), 'package.json')

    return require(pluginPath) as PluginPackageJson
  }

  private getPluginPath (pluginName: string, pluginType: PluginType) {
    const prefix = pluginType === PluginType.PLUGIN ? 'peertube-plugin-' : 'peertube-theme-'

    return join(CONFIG.STORAGE.PLUGINS_DIR, 'node_modules', prefix + pluginName)
  }

  private normalizePluginName (name: string) {
    return name.replace(/^peertube-((theme)|(plugin))-/, '')
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
