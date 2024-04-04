import { firstValueFrom, Observable, of } from 'rxjs'
import { catchError, map, shareReplay } from 'rxjs/operators'
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
import { getCompleteLocale, getKeys, isDefaultLocale, peertubeTranslate } from '@peertube/peertube-core-utils'
import {
  ClientHook,
  ClientHookName,
  PluginClientScope,
  PluginTranslation,
  PluginType,
  PluginType_Type,
  PublicServerSetting,
  RegisterClientFormFieldOptions,
  RegisterClientRouteOptions,
  RegisterClientSettingsScriptOptions,
  RegisterClientVideoFieldOptions,
  ServerConfigPlugin
} from '@peertube/peertube-models'
import { PluginInfo, PluginsManager } from '@root-helpers/plugins-manager'
import { environment } from '../../../environments/environment'
import { RegisterClientHelpers } from '../../../types/register-client-option.model'

type FormFields = {
  video: {
    pluginInfo: PluginInfo
    commonOptions: RegisterClientFormFieldOptions
    videoFormOptions: RegisterClientVideoFieldOptions
  }[]
}

@Injectable()
export class PluginService implements ClientHook {
  private static BASE_PLUGIN_API_URL = environment.apiUrl + '/api/v1/plugins'
  private static BASE_PLUGIN_URL = environment.apiUrl + '/plugins'

  translationsObservable: Observable<PluginTranslation>

  customModal: CustomModalComponent

  private formFields: FormFields = {
    video: []
  }
  private settingsScripts: { [ npmName: string ]: RegisterClientSettingsScriptOptions } = {}
  private clientRoutes: {
    [ parentRoute in RegisterClientRouteOptions['parentRoute'] ]?: {
      [ route: string ]: RegisterClientRouteOptions
    }
  } = {}

  private pluginsManager: PluginsManager

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

    this.pluginsManager = new PluginsManager({
      peertubeHelpersFactory: this.buildPeerTubeHelpers.bind(this),
      onFormFields: this.onFormFields.bind(this),
      onSettingsScripts: this.onSettingsScripts.bind(this),
      onClientRoute: this.onClientRoute.bind(this)
    })
  }

  initializePlugins () {
    this.pluginsManager.loadPluginsList(this.server.getHTMLConfig())

    this.pluginsManager.ensurePluginsAreLoaded('common')
  }

  initializeCustomModal (customModal: CustomModalComponent) {
    this.customModal = customModal
  }

  runHook <T> (hookName: ClientHookName, result?: T, params?: any): Promise<T> {
    return this.zone.runOutsideAngular(() => {
      return this.pluginsManager.runHook(hookName, result, params)
    })
  }

  ensurePluginsAreLoaded (scope: PluginClientScope) {
    return this.pluginsManager.ensurePluginsAreLoaded(scope)
  }

  reloadLoadedScopes () {
    return this.pluginsManager.reloadLoadedScopes()
  }

  getPluginsManager () {
    return this.pluginsManager
  }

  addPlugin (plugin: ServerConfigPlugin, isTheme = false) {
    return this.pluginsManager.addPlugin(plugin, isTheme)
  }

  removePlugin (plugin: ServerConfigPlugin) {
    return this.pluginsManager.removePlugin(plugin)
  }

  nameToNpmName (name: string, type: PluginType_Type) {
    const prefix = type === PluginType.PLUGIN
      ? 'peertube-plugin-'
      : 'peertube-theme-'

    return prefix + name
  }

  getRegisteredVideoFormFields (type: VideoEditType) {
    return this.formFields.video.filter(f => f.videoFormOptions.type === type)
  }

  getRegisteredSettingsScript (npmName: string) {
    return this.settingsScripts[npmName]
  }

  getRegisteredClientRoute (route: string, parentRoute: RegisterClientRouteOptions['parentRoute']) {
    if (!this.clientRoutes[parentRoute]) {
      return undefined
    }

    return this.clientRoutes[parentRoute][route]
  }

  getAllRegisteredClientRoutesForParent (parentRoute: RegisterClientRouteOptions['parentRoute']) {
    return this.clientRoutes[parentRoute]
  }

  getAllRegisteredClientRoutes () {
    return Object.keys(this.clientRoutes)
      .map((parentRoute: RegisterClientRouteOptions['parentRoute']) => {
        return Object.keys(this.clientRoutes[parentRoute])
          .map(route => {
            if (parentRoute === '/') return route

            return parentRoute + route
          })
      })
      .flat()
  }

  async translateSetting (npmName: string, setting: RegisterClientFormFieldOptions) {
    for (const key of getKeys(setting, [ 'label', 'html', 'descriptionHTML' ])) {
      if (setting[key]) setting[key] = await this.translateBy(npmName, setting[key])
    }

    if (Array.isArray(setting.options)) {
      const newOptions = []

      for (const o of setting.options) {
        newOptions.push({
          value: o.value,
          label: await this.translateBy(npmName, o.label)
        })
      }

      setting.options = newOptions
    }
  }

  translateBy (npmName: string, toTranslate: string) {
    const obs = this.translationsObservable
        .pipe(
          map(allTranslations => allTranslations[npmName]),
          map(translations => peertubeTranslate(toTranslate, translations))
        )

    return firstValueFrom(obs)
  }

  private onFormFields (
    pluginInfo: PluginInfo,
    commonOptions: RegisterClientFormFieldOptions,
    videoFormOptions: RegisterClientVideoFieldOptions
  ) {
    this.formFields.video.push({
      pluginInfo,
      commonOptions,
      videoFormOptions
    })
  }

  private onSettingsScripts (pluginInfo: PluginInfo, options: RegisterClientSettingsScriptOptions) {
    this.settingsScripts[pluginInfo.plugin.npmName] = options
  }

  private onClientRoute (options: RegisterClientRouteOptions) {
    const parentRoute = options.parentRoute || '/'

    const route = options.route.startsWith('/')
      ? options.route
      : `/${options.route}`

    if (!this.clientRoutes[parentRoute]) {
      this.clientRoutes[parentRoute] = {}
    }

    this.clientRoutes[parentRoute][route] = options
  }

  private buildPeerTubeHelpers (pluginInfo: PluginInfo): RegisterClientHelpers {
    const { plugin } = pluginInfo
    const npmName = pluginInfo.plugin.npmName

    return {
      getBaseStaticRoute: () => {
        const pathPrefix = PluginsManager.getPluginPathPrefix(pluginInfo.isTheme)
        return environment.apiUrl + `${pathPrefix}/${plugin.name}/${plugin.version}/static`
      },

      getBaseRouterRoute: () => {
        const pathPrefix = PluginsManager.getPluginPathPrefix(pluginInfo.isTheme)
        return environment.apiUrl + `${pathPrefix}/${plugin.name}/${plugin.version}/router`
      },

      getBaseWebSocketRoute: () => {
        const pathPrefix = PluginsManager.getPluginPathPrefix(pluginInfo.isTheme)
        return environment.apiUrl + `${pathPrefix}/${plugin.name}/${plugin.version}/ws`
      },

      getBasePluginClientPath: () => {
        return '/p'
      },

      getSettings: () => {
        const path = PluginService.BASE_PLUGIN_API_URL + '/' + npmName + '/public-settings'

        const obs = this.authHttp.get<PublicServerSetting>(path)
                   .pipe(
                     map(p => p.publicSettings),
                     catchError(res => this.restExtractor.handleError(res))
                   )

        return firstValueFrom(obs)
      },

      getServerConfig: () => {
        const obs = this.server.getConfig()
          .pipe(catchError(res => this.restExtractor.handleError(res)))

        return firstValueFrom(obs)
      },

      isLoggedIn: () => {
        return this.authService.isLoggedIn()
      },

      getAuthHeader: () => {
        if (!this.authService.isLoggedIn()) return undefined

        const value = this.authService.getRequestHeaderValue()
        return { Authorization: value }
      },

      notifier: {
        info: (text: string, title?: string, timeout?: number) => this.zone.run(() => this.notifier.info(text, title, timeout)),
        error: (text: string, title?: string, timeout?: number) => this.zone.run(() => this.notifier.error(text, title, timeout)),
        success: (text: string, title?: string, timeout?: number) => this.zone.run(() => this.notifier.success(text, title, timeout))
      },

      showModal: (input: {
        title: string
        content: string
        close?: boolean
        cancel?: { value: string, action?: () => void }
        confirm?: { value: string, action?: () => void }
      }) => {
        this.zone.run(() => this.customModal.show(input))
      },

      markdownRenderer: {
        textMarkdownToHTML: (textMarkdown: string) => {
          return this.markdownRenderer.textMarkdownToHTML({ markdown: textMarkdown })
        },

        enhancedMarkdownToHTML: (enhancedMarkdown: string) => {
          return this.markdownRenderer.enhancedMarkdownToHTML({ markdown: enhancedMarkdown })
        }
      },

      translate: (value: string) => {
        return this.translateBy(npmName, value)
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
}
