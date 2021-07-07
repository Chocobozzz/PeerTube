import { Observable, of } from 'rxjs'
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
import { PluginInfo, PluginsManager } from '@root-helpers/plugins-manager'
import { getCompleteLocale, isDefaultLocale, peertubeTranslate } from '@shared/core-utils/i18n'
import {
  ClientHook,
  ClientHookName,
  PluginClientScope,
  PluginTranslation,
  PluginType,
  PublicServerSetting,
  RegisterClientFormFieldOptions,
  RegisterClientSettingsScript,
  RegisterClientVideoFieldOptions,
  ServerConfigPlugin
} from '@shared/models'
import { environment } from '../../../environments/environment'
import { RegisterClientHelpers } from '../../../types/register-client-option.model'

type FormFields = {
  video: {
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

  private helpers: { [ npmName: string ]: RegisterClientHelpers } = {}

  private formFields: FormFields = {
    video: []
  }
  private settingsScripts: { [ npmName: string ]: RegisterClientSettingsScript } = {}

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
      onSettingsScripts: this.onSettingsScripts.bind(this)
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

  nameToNpmName (name: string, type: PluginType) {
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

  translateBy (npmName: string, toTranslate: string) {
    const helpers = this.helpers[npmName]
    if (!helpers) {
      console.error('Unknown helpers to translate %s from %s.', toTranslate, npmName)
      return toTranslate
    }

    return helpers.translate(toTranslate)
  }

  private onFormFields (commonOptions: RegisterClientFormFieldOptions, videoFormOptions: RegisterClientVideoFieldOptions) {
    this.formFields.video.push({
      commonOptions,
      videoFormOptions
    })
  }

  private onSettingsScripts (pluginInfo: PluginInfo, options: RegisterClientSettingsScript) {
    const npmName = this.nameToNpmName(pluginInfo.plugin.name, pluginInfo.pluginType)

    this.settingsScripts[npmName] = options
  }

  private buildPeerTubeHelpers (pluginInfo: PluginInfo): RegisterClientHelpers {
    const { plugin } = pluginInfo
    const npmName = this.nameToNpmName(pluginInfo.plugin.name, pluginInfo.pluginType)

    return {
      getBaseStaticRoute: () => {
        const pathPrefix = PluginsManager.getPluginPathPrefix(pluginInfo.isTheme)
        return environment.apiUrl + `${pathPrefix}/${plugin.name}/${plugin.version}/static`
      },

      getBaseRouterRoute: () => {
        const pathPrefix = PluginsManager.getPluginPathPrefix(pluginInfo.isTheme)
        return environment.apiUrl + `${pathPrefix}/${plugin.name}/${plugin.version}/router`
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

      getServerConfig: () => {
        return this.server.getConfig()
          .pipe(catchError(res => this.restExtractor.handleError(res)))
          .toPromise()
      },

      isLoggedIn: () => {
        return this.authService.isLoggedIn()
      },

      getAuthHeader: () => {
        if (!this.authService.isLoggedIn()) return undefined

        const value = this.authService.getRequestHeaderValue()
        return { 'Authorization': value }
      },

      notifier: {
        info: (text: string, title?: string, timeout?: number) => this.zone.run(() => this.notifier.info(text, title, timeout)),
        error: (text: string, title?: string, timeout?: number) => this.zone.run(() => this.notifier.error(text, title, timeout)),
        success: (text: string, title?: string, timeout?: number) => this.zone.run(() => this.notifier.success(text, title, timeout))
      },

      showModal: (input: {
        title: string,
        content: string,
        close?: boolean,
        cancel?: { value: string, action?: () => void },
        confirm?: { value: string, action?: () => void }
      }) => {
        this.zone.run(() => this.customModal.show(input))
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
}
