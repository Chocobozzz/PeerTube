import { PluginModel } from '../../models/server/plugin'
import { logger } from '../../helpers/logger'
import { RegisterHookOptions } from '../../../shared/models/plugins/register.model'
import { join } from 'path'
import { CONFIG } from '../../initializers/config'
import { isLibraryCodeValid, isPackageJSONValid } from '../../helpers/custom-validators/plugins'
import { PluginPackageJson } from '../../../shared/models/plugins/plugin-package-json.model'
import { PluginLibrary } from '../../../shared/models/plugins/plugin-library.model'
import { createReadStream, createWriteStream } from 'fs'
import { PLUGIN_GLOBAL_CSS_PATH } from '../../initializers/constants'
import { PluginType } from '../../../shared/models/plugins/plugin.type'

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

  private async registerPluginOrTheme (plugin: PluginModel) {
    logger.info('Registering plugin or theme %s.', plugin.name)

    const pluginPath = join(CONFIG.STORAGE.PLUGINS_DIR, plugin.name, plugin.version)
    const packageJSON: PluginPackageJson = require(join(pluginPath, 'package.json'))

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

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
