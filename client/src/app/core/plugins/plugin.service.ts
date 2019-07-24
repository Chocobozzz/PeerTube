import { Injectable } from '@angular/core'
import { Router } from '@angular/router'
import { ServerConfigPlugin } from '@shared/models'
import { ServerService } from '@app/core/server/server.service'
import { ClientScript } from '@shared/models/plugins/plugin-package-json.model'
import { environment } from '../../../environments/environment'
import { ReplaySubject } from 'rxjs'
import { first, shareReplay } from 'rxjs/operators'
import { getHookType, internalRunHook } from '@shared/core-utils/plugins/hooks'
import { ClientHook, ClientHookName, clientHookObject } from '@shared/models/plugins/client-hook.model'
import { PluginClientScope } from '@shared/models/plugins/plugin-client-scope.type'
import { RegisterClientHookOptions } from '@shared/models/plugins/register-client-hook.model'

interface HookStructValue extends RegisterClientHookOptions {
  plugin: ServerConfigPlugin
  clientScript: ClientScript
}

type PluginInfo = {
  plugin: ServerConfigPlugin
  clientScript: ClientScript
  isTheme: boolean
}

@Injectable()
export class PluginService implements ClientHook {
  pluginsBuilt = new ReplaySubject<boolean>(1)

  pluginsLoaded: { [ scope in PluginClientScope ]: ReplaySubject<boolean> } = {
    common: new ReplaySubject<boolean>(1),
    search: new ReplaySubject<boolean>(1),
    'video-watch': new ReplaySubject<boolean>(1)
  }

  private plugins: ServerConfigPlugin[] = []
  private scopes: { [ scopeName: string ]: PluginInfo[] } = {}
  private loadedScripts: { [ script: string ]: boolean } = {}
  private loadedScopes: PluginClientScope[] = []
  private loadingScopes: { [id in PluginClientScope]?: boolean } = {}

  private hooks: { [ name: string ]: HookStructValue[] } = {}

  constructor (
    private router: Router,
    private server: ServerService
  ) {
  }

  initializePlugins () {
    this.server.configLoaded
      .subscribe(() => {
        this.plugins = this.server.getConfig().plugin.registered

        this.buildScopeStruct()

        this.pluginsBuilt.next(true)
      })
  }

  ensurePluginsAreBuilt () {
    return this.pluginsBuilt.asObservable()
               .pipe(first(), shareReplay())
               .toPromise()
  }

  ensurePluginsAreLoaded (scope: PluginClientScope) {
    this.loadPluginsByScope(scope)

    return this.pluginsLoaded[scope].asObservable()
               .pipe(first(), shareReplay())
               .toPromise()
  }

  addPlugin (plugin: ServerConfigPlugin, isTheme = false) {
    const pathPrefix = this.getPluginPathPrefix(isTheme)

    for (const key of Object.keys(plugin.clientScripts)) {
      const clientScript = plugin.clientScripts[key]

      for (const scope of clientScript.scopes) {
        if (!this.scopes[scope]) this.scopes[scope] = []

        this.scopes[scope].push({
          plugin,
          clientScript: {
            script: environment.apiUrl + `${pathPrefix}/${plugin.name}/${plugin.version}/client-scripts/${clientScript.script}`,
            scopes: clientScript.scopes
          },
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

  async reloadLoadedScopes () {
    for (const scope of this.loadedScopes) {
      await this.loadPluginsByScope(scope, true)
    }
  }

  async loadPluginsByScope (scope: PluginClientScope, isReload = false) {
    if (this.loadingScopes[scope]) return
    if (!isReload && this.loadedScopes.includes(scope)) return

    this.loadingScopes[scope] = true

    try {
      await this.ensurePluginsAreBuilt()

      if (!isReload) this.loadedScopes.push(scope)

      const toLoad = this.scopes[ scope ]
      if (!Array.isArray(toLoad)) {
        this.loadingScopes[scope] = false
        this.pluginsLoaded[scope].next(true)

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
    } catch (err) {
      console.error('Cannot load plugins by scope %s.', scope, err)
    }
  }

  async runHook <T> (hookName: ClientHookName, result?: T, params?: any): Promise<T> {
    if (!this.hooks[hookName]) return Promise.resolve(result)

    const hookType = getHookType(hookName)

    for (const hook of this.hooks[hookName]) {
      console.log('Running hook %s of plugin %s.', hookName, hook.plugin.name)

      result = await internalRunHook(hook.handler, hookType, result, params, err => {
        console.error('Cannot run hook %s of script %s of plugin %s.', hookName, hook.clientScript.script, hook.plugin.name, err)
      })
    }

    return result
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

    const peertubeHelpers = this.buildPeerTubeHelpers(pluginInfo)

    console.log('Loading script %s of plugin %s.', clientScript.script, plugin.name)

    return import(/* webpackIgnore: true */ clientScript.script)
      .then(script => script.register({ registerHook, peertubeHelpers }))
      .then(() => this.sortHooksByPriority())
  }

  private buildScopeStruct () {
    for (const plugin of this.plugins) {
      this.addPlugin(plugin)
    }
  }

  private sortHooksByPriority () {
    for (const hookName of Object.keys(this.hooks)) {
      this.hooks[hookName].sort((a, b) => {
        return b.priority - a.priority
      })
    }
  }

  private buildPeerTubeHelpers (pluginInfo: PluginInfo) {
    const { plugin } = pluginInfo

    return {
      getBaseStaticRoute: () => {
        const pathPrefix = this.getPluginPathPrefix(pluginInfo.isTheme)
        return environment.apiUrl + `${pathPrefix}/${plugin.name}/${plugin.version}/static`
      }
    }
  }

  private getPluginPathPrefix (isTheme: boolean) {
    return isTheme ? '/themes' : '/plugins'
  }
}
