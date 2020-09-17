import { Observable, of, ReplaySubject } from 'rxjs'
import { catchError, first, map, shareReplay } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Inject, Injectable, LOCALE_ID, NgZone } from '@angular/core'
import { VideoEditType } from '@app/+videos/+video-edit/shared/video-edit.type'
import { AuthService } from '@app/core/auth'
import { Notifier } from '@app/core/notification'
import { MarkdownService } from '@app/core/renderer'
import { RestExtractor } from '@app/core/rest'
import { ServerService } from '@app/core/server/server.service'
import { getDevLocale, isOnDevLocale } from '@app/helpers'
import { CustomModalComponent } from '@app/modal/custom-modal.component'
import { FormFields, Hooks, loadPlugin, PluginInfo, runHook } from '@root-helpers/plugins'
import { getCompleteLocale, isDefaultLocale, peertubeTranslate } from '@shared/core-utils/i18n'
import {
  ClientHook,
  ClientHookName,
  PluginClientScope,
  PluginTranslation,
  PluginType,
  PublicServerSetting,
  ServerConfigPlugin
} from '@shared/models'
import { environment } from '../../../environments/environment'
import { RegisterClientHelpers } from '../../../types/register-client-option.model'

@Injectable()
export class PluginService implements ClientHook {
  private static BASE_PLUGIN_API_URL = environment.apiUrl + '/api/v1/plugins'
  private static BASE_PLUGIN_URL = environment.apiUrl + '/plugins'

  pluginsBuilt = new ReplaySubject<boolean>(1)

  pluginsLoaded: { [ scope in PluginClientScope ]: ReplaySubject<boolean> } = {
    common: new ReplaySubject<boolean>(1),
    search: new ReplaySubject<boolean>(1),
    'video-watch': new ReplaySubject<boolean>(1),
    signup: new ReplaySubject<boolean>(1),
    login: new ReplaySubject<boolean>(1),
    'video-edit': new ReplaySubject<boolean>(1),
    embed: new ReplaySubject<boolean>(1)
  }

  translationsObservable: Observable<PluginTranslation>

  customModal: CustomModalComponent

  private plugins: ServerConfigPlugin[] = []
  private scopes: { [ scopeName: string ]: PluginInfo[] } = {}
  private loadedScripts: { [ script: string ]: boolean } = {}
  private loadedScopes: PluginClientScope[] = []
  private loadingScopes: { [id in PluginClientScope]?: boolean } = {}

  private hooks: Hooks = {}
  private formFields: FormFields = {
    video: []
  }

  constructor (
    private authService: AuthService,
    private notifier: Notifier,
    private markdownRenderer: MarkdownService,
    private server: ServerService,
    private zone: NgZone,
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    @Inject(LOCALE_ID) private localeId: string
  ) {
    this.loadTranslations()
  }

  initializePlugins () {
    this.server.getConfig()
      .subscribe(config => {
        this.plugins = config.plugin.registered

        this.buildScopeStruct()

        this.pluginsBuilt.next(true)
      })
  }

  initializeCustomModal (customModal: CustomModalComponent) {
    this.customModal = customModal
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

  runHook <T> (hookName: ClientHookName, result?: T, params?: any): Promise<T> {
    return this.zone.runOutsideAngular(() => {
      return runHook(this.hooks, hookName, result, params)
    })
  }

  nameToNpmName (name: string, type: PluginType) {
    const prefix = type === PluginType.PLUGIN
      ? 'peertube-plugin-'
      : 'peertube-theme-'

    return prefix + name
  }

  pluginTypeFromNpmName (npmName: string) {
    return npmName.startsWith('peertube-plugin-')
      ? PluginType.PLUGIN
      : PluginType.THEME
  }

  getRegisteredVideoFormFields (type: VideoEditType) {
    return this.formFields.video.filter(f => f.videoFormOptions.type === type)
  }

  private loadPlugin (pluginInfo: PluginInfo) {
    return this.zone.runOutsideAngular(() => {
      return loadPlugin({
        hooks: this.hooks,
        formFields: this.formFields,
        pluginInfo,
        peertubeHelpersFactory: pluginInfo => this.buildPeerTubeHelpers(pluginInfo)
      })
    })
  }

  private buildScopeStruct () {
    for (const plugin of this.plugins) {
      this.addPlugin(plugin)
    }
  }

  private buildPeerTubeHelpers (pluginInfo: PluginInfo): RegisterClientHelpers {
    const { plugin } = pluginInfo
    const npmName = this.nameToNpmName(pluginInfo.plugin.name, pluginInfo.pluginType)

    return {
      getBaseStaticRoute: () => {
        const pathPrefix = this.getPluginPathPrefix(pluginInfo.isTheme)
        return environment.apiUrl + `${pathPrefix}/${plugin.name}/${plugin.version}/static`
      },

      getSettings: () => {
        const path = PluginService.BASE_PLUGIN_API_URL + '/' + npmName + '/public-settings'

        return this.authHttp.get<PublicServerSetting>(path)
                   .pipe(
                     map(p => p.publicSettings),
                     catchError(res => this.restExtractor.handleError(res))
                   )
                   .toPromise()
      },

      isLoggedIn: () => {
        return this.authService.isLoggedIn()
      },

      notifier: {
        info: (text: string, title?: string, timeout?: number) => this.notifier.info(text, title, timeout),
        error: (text: string, title?: string, timeout?: number) => this.notifier.error(text, title, timeout),
        success: (text: string, title?: string, timeout?: number) => this.notifier.success(text, title, timeout)
      },

      showModal: (input: {
        title: string,
        content: string,
        close?: boolean,
        cancel?: { value: string, action?: () => void },
        confirm?: { value: string, action?: () => void }
      }) => {
        this.customModal.show(input)
      },

      markdownRenderer: {
        textMarkdownToHTML: (textMarkdown: string) => {
          return this.markdownRenderer.textMarkdownToHTML(textMarkdown)
        },

        enhancedMarkdownToHTML: (enhancedMarkdown: string) => {
          return this.markdownRenderer.enhancedMarkdownToHTML(enhancedMarkdown)
        }
      },

      translate: (value: string) => {
        return this.translationsObservable
            .pipe(map(allTranslations => allTranslations[npmName]))
            .pipe(map(translations => peertubeTranslate(value, translations)))
            .toPromise()
      }
    }
  }

  private loadTranslations () {
    const completeLocale = isOnDevLocale() ? getDevLocale() : getCompleteLocale(this.localeId)

    // Default locale, nothing to translate
    if (isDefaultLocale(completeLocale)) this.translationsObservable = of({}).pipe(shareReplay())

    this.translationsObservable = this.authHttp
        .get<PluginTranslation>(PluginService.BASE_PLUGIN_URL + '/translations/' + completeLocale + '.json')
        .pipe(shareReplay())
  }

  private getPluginPathPrefix (isTheme: boolean) {
    return isTheme ? '/themes' : '/plugins'
  }
}
