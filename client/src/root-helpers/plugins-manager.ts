/* eslint-disable @typescript-eslint/no-implied-eval */
import * as debug from 'debug'
import { firstValueFrom, ReplaySubject } from 'rxjs'
import { first, shareReplay } from 'rxjs/operators'
import { RegisterClientHelpers } from 'src/types/register-client-option.model'
import { getExternalAuthHref, getHookType, internalRunHook } from '@peertube/peertube-core-utils'
import {
  ClientHookName,
  clientHookObject,
  ClientScriptJSON,
  HTMLServerConfig,
  PluginClientScope,
  PluginType,
  PluginType_Type,
  RegisterClientFormFieldOptions,
  RegisterClientHookOptions,
  RegisterClientRouteOptions,
  RegisterClientSettingsScriptOptions,
  RegisterClientVideoFieldOptions,
  ServerConfigPlugin
} from '@peertube/peertube-models'
import { environment } from '../environments/environment'
import { ClientScript } from '../types'
import { logger } from './logger'

interface HookStructValue extends RegisterClientHookOptions {
  plugin: ServerConfigPlugin
  clientScript: ClientScriptJSON
}

type Hooks = { [ name: string ]: HookStructValue[] }

type PluginInfo = {
  plugin: ServerConfigPlugin
  clientScript: ClientScriptJSON
  pluginType: PluginType_Type
  isTheme: boolean
}

type PeertubeHelpersFactory = (pluginInfo: PluginInfo) => RegisterClientHelpers

type OnFormFields = (
  pluginInfo: PluginInfo,
  options: RegisterClientFormFieldOptions,
  videoFormOptions: RegisterClientVideoFieldOptions
) => void

type OnSettingsScripts = (pluginInfo: PluginInfo, options: RegisterClientSettingsScriptOptions) => void

type OnClientRoute = (options: RegisterClientRouteOptions) => void

const debugLogger = debug('peertube:plugins')

class PluginsManager {
  private hooks: Hooks = {}

  private scopes: { [ scopeName: string ]: PluginInfo[] } = {}

  private loadedScripts: { [ script: string ]: boolean } = {}
  private loadedScopes: PluginClientScope[] = []
  private loadingScopes: { [id in PluginClientScope]?: boolean } = {}

  private pluginsLoaded: { [ scope in PluginClientScope ]: ReplaySubject<boolean> } = {
    'common': new ReplaySubject<boolean>(1),
    'admin-plugin': new ReplaySubject<boolean>(1),
    'search': new ReplaySubject<boolean>(1),
    'video-watch': new ReplaySubject<boolean>(1),
    'signup': new ReplaySubject<boolean>(1),
    'login': new ReplaySubject<boolean>(1),
    'video-edit': new ReplaySubject<boolean>(1),
    'embed': new ReplaySubject<boolean>(1),
    'my-library': new ReplaySubject<boolean>(1),
    'video-channel': new ReplaySubject<boolean>(1),
    'my-account': new ReplaySubject<boolean>(1)
  }

  private readonly peertubeHelpersFactory: PeertubeHelpersFactory
  private readonly onFormFields: OnFormFields
  private readonly onSettingsScripts: OnSettingsScripts
  private readonly onClientRoute: OnClientRoute

  constructor (options: {
    peertubeHelpersFactory: PeertubeHelpersFactory
    onFormFields?: OnFormFields
    onSettingsScripts?: OnSettingsScripts
    onClientRoute?: OnClientRoute
  }) {
    this.peertubeHelpersFactory = options.peertubeHelpersFactory
    this.onFormFields = options.onFormFields
    this.onSettingsScripts = options.onSettingsScripts
    this.onClientRoute = options.onClientRoute
  }

  static getPluginPathPrefix (isTheme: boolean) {
    return isTheme ? '/themes' : '/plugins'
  }

  static getDefaultLoginHref (apiUrl: string, serverConfig: HTMLServerConfig) {
    if (!serverConfig || serverConfig.client.menu.login.redirectOnSingleExternalAuth !== true) return undefined

    const externalAuths = serverConfig.plugin.registeredExternalAuths
    if (externalAuths.length !== 1) return undefined

    return getExternalAuthHref(apiUrl, externalAuths[0])
  }

  loadPluginsList (config: HTMLServerConfig) {
    for (const plugin of config.plugin.registered) {
      this.addPlugin(plugin)
    }
  }

  async runHook<T> (hookName: ClientHookName, resultArg?: T | Promise<T>, params?: any) {
    if (!this.hooks[hookName]) {
      // eslint-disable-next-line no-return-await
      return await resultArg
    }

    const hookType = getHookType(hookName)

    let result = await resultArg

    for (const hook of this.hooks[hookName]) {
      logger.info(`Running hook ${hookName} of plugin ${hook.plugin.name}`)

      result = await internalRunHook({
        handler: hook.handler,
        hookType,
        result,
        params,
        onError: err => {
          logger.error(`Cannot run hook ${hookName} of script ${hook.clientScript.script} of plugin ${hook.plugin.name}`, err)
        }
      })
    }

    return result
  }

  ensurePluginsAreLoaded (scope: PluginClientScope) {
    this.loadPluginsByScope(scope)

    const obs = this.pluginsLoaded[scope].asObservable()
               .pipe(first(), shareReplay())

    return firstValueFrom(obs)
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

    debugLogger('Loading scope %s', scope)

    try {
      if (!isReload) this.loadedScopes.push(scope)

      const toLoad = this.scopes[scope]
      if (!Array.isArray(toLoad)) {
        this.loadingScopes[scope] = false
        this.pluginsLoaded[scope].next(true)

        debugLogger('Nothing to load for scope %s', scope)
        return
      }

      const promises: Promise<any>[] = []
      for (const pluginInfo of toLoad) {
        const clientScript = pluginInfo.clientScript

        if (this.loadedScripts[clientScript.script]) continue

        promises.push(this.loadPlugin(pluginInfo))

        this.loadedScripts[clientScript.script] = true
      }

      await Promise.all(promises)

      this.pluginsLoaded[scope].next(true)
      this.loadingScopes[scope] = false

      debugLogger('Scope %s loaded', scope)
    } catch (err) {
      logger.error(`Cannot load plugins by scope ${scope}`, err)
    }
  }

  private loadPlugin (pluginInfo: PluginInfo) {
    const { plugin, clientScript } = pluginInfo

    const registerHook = (options: RegisterClientHookOptions) => {
      if (clientHookObject[options.target] !== true) {
        logger.error(`Unknown hook ${options.target} of plugin ${plugin.name}. Skipping.`)
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

      return this.onFormFields(pluginInfo, commonOptions, videoFormOptions)
    }

    const registerSettingsScript = (options: RegisterClientSettingsScriptOptions) => {
      if (!this.onSettingsScripts) {
        throw new Error('Registering settings script is not supported')
      }

      return this.onSettingsScripts(pluginInfo, options)
    }

    const registerClientRoute = (options: RegisterClientRouteOptions) => {
      if (!this.onClientRoute) {
        throw new Error('Registering client route is not supported')
      }

      return this.onClientRoute(options)
    }

    const peertubeHelpers = this.peertubeHelpersFactory(pluginInfo)

    logger.info(`Loading script ${clientScript.script} of plugin ${plugin.name}`)

    const absURL = (environment.apiUrl || window.location.origin) + clientScript.script
    return dynamicImport(absURL)
      .then((script: ClientScript) => {
        return script.register({
          registerHook,
          registerVideoField,
          registerSettingsScript,
          registerClientRoute,
          peertubeHelpers
        })
      })
      .then(() => this.sortHooksByPriority())
      .catch(err => logger.error(`Cannot import or register plugin ${pluginInfo.plugin.name}`, err))
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

// ---------------------------------------------------------------------------

async function dynamicImport (url: string) {
  try {
    // eslint-disable-next-line no-new-func
    return new Function(`return import('${url}')`)()
  } catch {
    logger.info('Fallback to import polyfill')

    return new Promise((resolve, reject) => {
      const vector = '$importModule$' + Math.random().toString(32).slice(2)
      const script = document.createElement('script')

      const destructor = () => {
        delete window[vector as any]
        script.onerror = null
        script.onload = null
        script.remove()
        URL.revokeObjectURL(script.src)
        script.src = ''
      }

      script.defer = true
      script.type = 'module'

      script.onerror = () => {
        reject(new Error(`Failed to import: ${url}`))
        destructor()
      }
      script.onload = () => {
        resolve(window[vector as any])
        destructor()
      }
      const loader = `import * as m from "${url}"; window.${vector} = m;` // export Module
      const blob = new Blob([ loader ], { type: 'text/javascript' })
      script.src = URL.createObjectURL(blob)

      document.head.appendChild(script)
    })
  }
}
