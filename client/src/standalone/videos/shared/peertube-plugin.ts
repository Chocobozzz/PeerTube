import { peertubeTranslate } from '@peertube/peertube-core-utils'
import { HTMLServerConfig, PublicServerSetting } from '@peertube/peertube-models'
import { PluginInfo, PluginsManager } from '../../../root-helpers'
import { RegisterClientHelpers } from '../../../types'
import { AuthHTTP } from './auth-http'
import { Translations } from './translations'
import { getBackendUrl } from './url'

export class PeerTubePlugin {

  private pluginsManager: PluginsManager

  constructor (private readonly http: AuthHTTP) {

  }

  loadPlugins (config: HTMLServerConfig, translations?: Translations) {
    this.pluginsManager = new PluginsManager({
      peertubeHelpersFactory: pluginInfo => this.buildPeerTubeHelpers({
        pluginInfo,
        translations
      }),
      backendUrl: getBackendUrl()
    })

    this.pluginsManager.loadPluginsList(config)

    return this.pluginsManager.ensurePluginsAreLoaded('embed')
  }

  getPluginsManager () {
    return this.pluginsManager
  }

  private buildPeerTubeHelpers (options: {
    pluginInfo: PluginInfo
    translations?: Translations
  }): RegisterClientHelpers {
    const { pluginInfo, translations } = options

    const unimplemented = () => {
      throw new Error('This helper is not implemented in embed.')
    }

    return {
      getBaseStaticRoute: unimplemented,
      getBaseRouterRoute: unimplemented,
      getBaseWebSocketRoute: unimplemented,
      getBasePluginClientPath: unimplemented,

      getSettings: () => {
        const url = this.getPluginUrl() + '/' + pluginInfo.plugin.npmName + '/public-settings'

        return this.http.fetch(url, { optionalAuth: true })
          .then(res => res.json())
          .then((obj: PublicServerSetting) => obj.publicSettings)
      },

      getUser: unimplemented,

      isLoggedIn: () => this.http.isLoggedIn(),
      getAuthHeader: () => {
        if (!this.http.isLoggedIn()) return undefined

        return { Authorization: this.http.getHeaderTokenValue() }
      },

      notifier: {
        info: unimplemented,
        error: unimplemented,
        success: unimplemented
      },

      showModal: unimplemented,

      getServerConfig: unimplemented,

      markdownRenderer: {
        textMarkdownToHTML: unimplemented,
        enhancedMarkdownToHTML: unimplemented
      },

      translate: (value: string) => Promise.resolve(peertubeTranslate(value, translations))
    }
  }

  private getPluginUrl () {
    return getBackendUrl() + '/api/v1/plugins'
  }
}
