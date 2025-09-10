import { HTMLServerConfig, ServerConfig } from '@peertube/peertube-models'
import { logger, ThemeManager } from '../../../root-helpers'
import { PeerTubePlugin } from './peertube-plugin'
import { getBackendUrl } from './url'

export class PeerTubeTheme {
  private themeManager = new ThemeManager()

  constructor (private readonly pluginPlugin: PeerTubePlugin) {
  }

  loadThemeStyle (config: HTMLServerConfig) {
    for (const theme of config.theme.registered) {
      this.themeManager.injectTheme(theme, getBackendUrl())
    }

    const themeName = this.getCurrentThemeName(config)
    logger.info(`Enabling ${themeName} theme style.`)

    this.themeManager.loadThemeStyle(themeName)

    this.themeManager.injectColorPalette({ config: config.theme, currentTheme: themeName })
  }

  loadThemePlugins (config: HTMLServerConfig) {
    const themeName = this.getCurrentThemeName(config)
    logger.info(`Loading ${themeName} theme plugins.`)

    const theme = config.theme.registered.find(t => t.name === themeName)
    const isInternalTheme = config.theme.builtIn.map(t => t.name as string).includes(themeName)

    if (isInternalTheme) {
      logger.info(`Enabling internal theme ${themeName}`)
    } else if (theme) {
      logger.info(`Adding scripts of theme ${themeName}`)

      const pluginManager = this.pluginPlugin.getPluginsManager()
      pluginManager.addPlugin(theme, true)
      pluginManager.reloadLoadedScopes()
    }
  }

  private getCurrentThemeName (config: HTMLServerConfig) {
    const instanceTheme = config.theme.default
    if (instanceTheme !== 'default') return instanceTheme

    // Default to dark theme if available and wanted by the user
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'peertube-core-dark-brown' satisfies ServerConfig['theme']['builtIn'][0]['name']
    }

    return instanceTheme
  }
}
