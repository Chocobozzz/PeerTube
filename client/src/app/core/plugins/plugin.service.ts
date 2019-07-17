import { Injectable } from '@angular/core'
import { Router } from '@angular/router'
import { ServerConfigPlugin } from '@shared/models'
import { ServerService } from '@app/core/server/server.service'
import { ClientScript } from '@shared/models/plugins/plugin-package-json.model'
import { PluginScope } from '@shared/models/plugins/plugin-scope.type'
import { environment } from '../../../environments/environment'
import { RegisterHookOptions } from '@shared/models/plugins/register-hook.model'
import { ReplaySubject } from 'rxjs'
import { first, shareReplay } from 'rxjs/operators'

interface HookStructValue extends RegisterHookOptions {
  plugin: ServerConfigPlugin
  clientScript: ClientScript
}

type PluginInfo = {
  plugin: ServerConfigPlugin
  clientScript: ClientScript
  isTheme: boolean
}

@Injectable()
export class PluginService {
  pluginsLoaded = new ReplaySubject<boolean>(1)

  private plugins: ServerConfigPlugin[] = []
  private scopes: { [ scopeName: string ]: PluginInfo[] } = {}
  private loadedPlugins: { [ name: string ]: boolean } = {}
  private loadedScripts: { [ script: string ]: boolean } = {}
  private loadedScopes: PluginScope[] = []

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

        this.pluginsLoaded.next(true)
      })
  }

  ensurePluginsAreLoaded () {
    return this.pluginsLoaded.asObservable()
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

  async loadPluginsByScope (scope: PluginScope, isReload = false) {
    try {
      await this.ensurePluginsAreLoaded()

      if (!isReload) this.loadedScopes.push(scope)

      const toLoad = this.scopes[ scope ]
      if (!Array.isArray(toLoad)) return

      const promises: Promise<any>[] = []
      for (const pluginInfo of toLoad) {
        const clientScript = pluginInfo.clientScript

        if (this.loadedScripts[ clientScript.script ]) continue

        promises.push(this.loadPlugin(pluginInfo))

        this.loadedScripts[ clientScript.script ] = true
      }

      await Promise.all(promises)
    } catch (err) {
      console.error('Cannot load plugins by scope %s.', scope, err)
    }
  }

  async runHook (hookName: string, param?: any) {
    let result = param

    if (!this.hooks[hookName]) return result

    const wait = hookName.startsWith('static:')

    for (const hook of this.hooks[hookName]) {
      try {
        const p = hook.handler(param)

        if (wait) {
          result = await p
        } else if (p.catch) {
          p.catch((err: Error) => {
            console.error('Cannot run hook %s of script %s of plugin %s.', hookName, hook.plugin, hook.clientScript, err)
          })
        }
      } catch (err) {
        console.error('Cannot run hook %s of script %s of plugin %s.', hookName, hook.plugin, hook.clientScript, err)
      }
    }

    return result
  }

  private loadPlugin (pluginInfo: PluginInfo) {
    const { plugin, clientScript } = pluginInfo

    const registerHook = (options: RegisterHookOptions) => {
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
