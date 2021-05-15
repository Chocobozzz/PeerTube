import * as debug from 'debug'
import { ReplaySubject } from 'rxjs'
import { first, shareReplay } from 'rxjs/operators'
import { RegisterClientHelpers } from 'src/types/register-client-option.model'
import { getHookType, internalRunHook } from '@shared/core-utils/plugins/hooks'
import {
  ClientHookName,
  clientHookObject,
  ClientScript,
  HTMLServerConfig,
  PluginClientScope,
  PluginType,
  RegisterClientFormFieldOptions,
  RegisterClientHookOptions,
  RegisterClientSettingsScript,
  RegisterClientVideoFieldOptions,
  ServerConfigPlugin
} from '../../../shared/models'
import { environment } from '../environments/environment'
import { ClientScript as ClientScriptModule } from '../types/client-script.model'

interface HookStructValue extends RegisterClientHookOptions {
  plugin: ServerConfigPlugin
  clientScript: ClientScript
}

type Hooks = { [ name: string ]: HookStructValue[] }

type PluginInfo = {
  plugin: ServerConfigPlugin
  clientScript: ClientScript
  pluginType: PluginType
  isTheme: boolean
}

type PeertubeHelpersFactory = (pluginInfo: PluginInfo) => RegisterClientHelpers
type OnFormFields = (options: RegisterClientFormFieldOptions, videoFormOptions: RegisterClientVideoFieldOptions) => void
type OnSettingsScripts = (pluginInfo: PluginInfo, options: RegisterClientSettingsScript) => void

const logger = debug('peertube:plugins')

class PluginsManager {
  private hooks: Hooks = {}

  private scopes: { [ scopeName: string ]: PluginInfo[] } = {}

  private loadedScripts: { [ script: string ]: boolean } = {}
  private loadedScopes: PluginClientScope[] = []
  private loadingScopes: { [id in PluginClientScope]?: boolean } = {}

  private pluginsLoaded: { [ scope in PluginClientScope ]: ReplaySubject<boolean> } = {
    common: new ReplaySubject<boolean>(1),
    'admin-plugin': new ReplaySubject<boolean>(1),
    search: new ReplaySubject<boolean>(1),
    'video-watch': new ReplaySubject<boolean>(1),
    signup: new ReplaySubject<boolean>(1),
    login: new ReplaySubject<boolean>(1),
    'video-edit': new ReplaySubject<boolean>(1),
    embed: new ReplaySubject<boolean>(1)
  }

  private readonly peertubeHelpersFactory: PeertubeHelpersFactory
  private readonly onFormFields: OnFormFields
  private readonly onSettingsScripts: OnSettingsScripts

  constructor (options: {
    peertubeHelpersFactory: PeertubeHelpersFactory
    onFormFields?: OnFormFields
    onSettingsScripts?: OnSettingsScripts
  }) {
    this.peertubeHelpersFactory = options.peertubeHelpersFactory
    this.onFormFields = options.onFormFields
    this.onSettingsScripts = options.onSettingsScripts
  }

  static getPluginPathPrefix (isTheme: boolean) {
    return isTheme ? '/themes' : '/plugins'
  }

  loadPluginsList (config: HTMLServerConfig) {
    for (const plugin of config.plugin.registered) {
      this.addPlugin(plugin)
    }
  }

  async runHook<T> (hookName: ClientHookName, result?: T, params?: any) {
    if (!this.hooks[hookName]) return result

    const hookType = getHookType(hookName)

    for (const hook of this.hooks[hookName]) {
      console.log('Running hook %s of plugin %s.', hookName, hook.plugin.name)

      result = await internalRunHook(hook.handler, hookType, result, params, err => {
        console.error('Cannot run hook %s of script %s of plugin %s.', hookName, hook.clientScript.script, hook.plugin.name, err)
      })
    }

    return result
  }

  ensurePluginsAreLoaded (scope: PluginClientScope) {
    this.loadPluginsByScope(scope)

    return this.pluginsLoaded[scope].asObservable()
               .pipe(first(), shareReplay())
               .toPromise()
  }

  async reloadLoadedScopes () {
    for (const scope of this.loadedScopes) {
      await this.loadPluginsByScope(scope, true)
    }
  }

  addPlugin (plugin: ServerConfigPlugin, isTheme = false) {
    const pathPrefix = PluginsManager.getPluginPathPrefix(isTheme)

    for (const key of Object.keys(plugin.clientScripts)) {
      const clientScript = plugin.clientScripts[key]

      for (const scope of clientScript.scopes) {
        if (!this.scopes[scope]) this.scopes[scope] = []

        this.scopes[scope].push({
          plugin,
          clientScript: {
            script: `${pathPrefix}/${plugin.name}/${plugin.version}/client-scripts/${clientScript.script}`,
            scopes: clientScript.scopes
          },
          pluginType: isTheme ? PluginType.THEME : PluginType.PLUGIN,
          isTheme
        })

        this.loadedScripts[clientScript.script] = false
      }
    }
  }

  removePlugin (plugin: ServerConfigPlugin) {
    for (const key of Object.keys(this.scopes)) {
      this.scopes[key] = this.scopes[key].filter(o => o.plugin.name !== plugin.name)
    }
  }

  async loadPluginsByScope (scope: PluginClientScope, isReload = false) {
    if (this.loadingScopes[scope]) return
    if (!isReload && this.loadedScopes.includes(scope)) return

    this.loadingScopes[scope] = true

    logger('Loading scope %s', scope)

    try {
      if (!isReload) this.loadedScopes.push(scope)

      const toLoad = this.scopes[ scope ]
      if (!Array.isArray(toLoad)) {
        this.loadingScopes[scope] = false
        this.pluginsLoaded[scope].next(true)

        logger('Nothing to load for scope %s', scope)
        return
      }

      const promises: Promise<any>[] = []
      for (const pluginInfo of toLoad) {
        const clientScript = pluginInfo.clientScript

        if (this.loadedScripts[ clientScript.script ]) continue

        promises.push(this.loadPlugin(pluginInfo))

        this.loadedScripts[ clientScript.script ] = true
      }

      await Promise.all(promises)

      this.pluginsLoaded[scope].next(true)
      this.loadingScopes[scope] = false

      logger('Scope %s loaded', scope)
    } catch (err) {
      console.error('Cannot load plugins by scope %s.', scope, err)
    }
  }

  private loadPlugin (pluginInfo: PluginInfo) {
    const { plugin, clientScript } = pluginInfo

    const registerHook = (options: RegisterClientHookOptions) => {
      if (clientHookObject[options.target] !== true) {
        console.error('Unknown hook %s of plugin %s. Skipping.', options.target, plugin.name)
        return
      }

      if (!this.hooks[options.target]) this.hooks[options.target] = []

      this.hooks[options.target].push({
        plugin,
        clientScript,
        target: options.target,
        handler: options.handler,
        priority: options.priority || 0
      })
    }

    const registerVideoField = (commonOptions: RegisterClientFormFieldOptions, videoFormOptions: RegisterClientVideoFieldOptions) => {
      if (!this.onFormFields) {
        throw new Error('Video field registration is not supported')
      }

      return this.onFormFields(commonOptions, videoFormOptions)
    }

    const registerSettingsScript = (options: RegisterClientSettingsScript) => {
      if (!this.onSettingsScripts) {
        throw new Error('Registering settings script is not supported')
      }

      return this.onSettingsScripts(pluginInfo, options)
    }

    const peertubeHelpers = this.peertubeHelpersFactory(pluginInfo)

    console.log('Loading script %s of plugin %s.', clientScript.script, plugin.name)

    const absURL = (environment.apiUrl || window.location.origin) + clientScript.script
    return import(/* webpackIgnore: true */ absURL)
      .then((script: ClientScriptModule) => script.register({ registerHook, registerVideoField, registerSettingsScript, peertubeHelpers }))
      .then(() => this.sortHooksByPriority())
      .catch(err => console.error('Cannot import or register plugin %s.', pluginInfo.plugin.name, err))
  }

  private sortHooksByPriority () {
    for (const hookName of Object.keys(this.hooks)) {
      this.hooks[hookName].sort((a, b) => {
        return b.priority - a.priority
      })
    }
  }
}

export {
  PluginsManager,

  PluginInfo,
  PeertubeHelpersFactory,
  OnFormFields,
  OnSettingsScripts
}
