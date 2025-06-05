import { Injectable, inject } from '@angular/core'
import { HTMLServerConfig, ServerConfig, ServerConfigTheme } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { capitalizeFirstLetter } from '@root-helpers/string'
import { ColorPaletteThemeConfig, ThemeCustomizationKey, ThemeManager } from '@root-helpers/theme-manager'
import { UserLocalStorageKeys } from '@root-helpers/users'
import { environment } from '../../../environments/environment'
import { AuthService } from '../auth'
import { PluginService } from '../plugins/plugin.service'
import { ServerService } from '../server'
import { UserService } from '../users/user.service'
import { LocalStorageService } from '../wrappers/storage.service'
import { formatHEX, parse } from 'color-bits'

@Injectable()
export class ThemeService {
  private auth = inject(AuthService)
  private userService = inject(UserService)
  private pluginService = inject(PluginService)
  private server = inject(ServerService)
  private localStorageService = inject(LocalStorageService)

  private oldThemeName: string

  private internalThemes: string[] = []
  private themes: ServerConfigTheme[] = []

  private themeFromLocalStorage: Pick<ServerConfigTheme, 'name' | 'version'>
  private themeDOMLinksFromLocalStorage: HTMLLinkElement[] = []

  private serverConfig: HTMLServerConfig

  private themeManager = new ThemeManager()

  initialize () {
    this.serverConfig = this.server.getHTMLConfig()
    this.internalThemes = this.serverConfig.theme.builtIn.map(t => t.name)

    // Try to load from local storage first, so we don't have to wait network requests
    this.loadAndSetFromLocalStorage()

    const themes = this.serverConfig.theme.registered

    this.removeThemeFromLocalStorageIfNeeded(themes)
    this.injectThemes(themes)

    this.listenUserTheme()
  }

  getDefaultThemeItem () {
    return {
      label: $localize`Light (Beige) or Dark (Brown)`,
      id: 'default',
      description: $localize`PeerTube selects the appropriate theme depending on web browser preferences`
    }
  }

  buildAvailableThemes () {
    return [
      ...this.serverConfig.theme.builtIn.map(t => {
        if (t.name === 'peertube-core-dark-brown') {
          return { id: t.name, label: $localize`Dark (Brown)` }
        }

        if (t.name === 'peertube-core-light-beige') {
          return { id: t.name, label: $localize`Light (Beige)` }
        }

        return { id: t.name, label: capitalizeFirstLetter(t.name) }
      }),

      ...this.serverConfig.theme.registered.map(t => ({ id: t.name, label: capitalizeFirstLetter(t.name) }))
    ]
  }

  updateColorPalette (config: ColorPaletteThemeConfig = this.serverConfig.theme) {
    this.themeManager.injectColorPalette({ currentTheme: this.getCurrentThemeName(), config })
  }

  getCSSConfigValue (configKey: ThemeCustomizationKey) {
    return this.themeManager.getCSSConfigValue(configKey)
  }

  private injectThemes (themes: ServerConfigTheme[], fromLocalStorage = false) {
    this.themes = themes

    logger.info(`Injecting ${this.themes.length} themes.`)

    for (const theme of this.themes) {
      // Already added this theme?
      if (fromLocalStorage === false && this.themeFromLocalStorage && this.themeFromLocalStorage.name === theme.name) continue

      const links = this.themeManager.injectTheme(theme, environment.apiUrl)

      if (fromLocalStorage === true) {
        this.themeDOMLinksFromLocalStorage = [ ...this.themeDOMLinksFromLocalStorage, ...links ]
      }
    }
  }

  getCurrentThemeName () {
    if (this.themeFromLocalStorage) return this.themeFromLocalStorage.name

    const theme = this.auth.isLoggedIn()
      ? this.auth.getUser().theme
      : this.userService.getAnonymousUser().theme

    if (theme !== 'instance-default') return theme

    const instanceTheme = this.serverConfig.theme.default
    if (instanceTheme !== 'default') return instanceTheme

    // Default to dark theme if available and wanted by the user
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'peertube-core-dark-brown' satisfies ServerConfig['theme']['builtIn'][0]['name']
    }

    return instanceTheme
  }

  private updateCurrentTheme () {
    const currentThemeName = this.getCurrentThemeName()
    if (this.oldThemeName === currentThemeName) return

    if (this.oldThemeName) this.removeThemePlugins(this.oldThemeName)

    logger.info(`Enabling ${currentThemeName} theme.`)

    this.themeManager.loadThemeStyle(currentThemeName)

    const theme = this.getTheme(currentThemeName)

    if (this.internalThemes.includes(currentThemeName)) {
      logger.info(`Enabling internal theme ${currentThemeName}`)

      this.localStorageService.setItem(UserLocalStorageKeys.LAST_ACTIVE_THEME, JSON.stringify({ name: currentThemeName }), false)
    } else if (theme) {
      logger.info(`Adding scripts of theme ${currentThemeName}`)

      this.pluginService.addPlugin(theme, true)

      this.pluginService.reloadLoadedScopes()

      this.localStorageService.setItem(UserLocalStorageKeys.LAST_ACTIVE_THEME, JSON.stringify(theme), false)
    } else {
      this.localStorageService.removeItem(UserLocalStorageKeys.LAST_ACTIVE_THEME, false)
    }

    this.themeManager.injectColorPalette({ currentTheme: currentThemeName, config: this.serverConfig.theme })

    this.oldThemeName = currentThemeName
  }

  private listenUserTheme () {
    // We don't need them anymore
    this.themeFromLocalStorage = undefined
    this.themeDOMLinksFromLocalStorage = []

    if (!this.auth.isLoggedIn()) {
      this.updateCurrentTheme()

      this.localStorageService.watch([ UserLocalStorageKeys.THEME ]).subscribe(
        () => this.updateCurrentTheme()
      )
    }

    this.auth.userInformationLoaded
      .subscribe(() => this.updateCurrentTheme())
  }

  private loadAndSetFromLocalStorage () {
    const lastActiveThemeString = this.localStorageService.getItem(UserLocalStorageKeys.LAST_ACTIVE_THEME)
    if (!lastActiveThemeString) return

    try {
      const lastActiveTheme = JSON.parse(lastActiveThemeString)
      this.themeFromLocalStorage = lastActiveTheme

      if (!this.internalThemes.includes(this.themeFromLocalStorage.name)) {
        this.injectThemes([ lastActiveTheme ], true)
      }

      this.updateCurrentTheme()
    } catch (err) {
      logger.error('Cannot parse last active theme.', err)
      return
    }
  }

  private removeThemePlugins (themeName: string) {
    const oldTheme = this.getTheme(themeName)
    if (oldTheme) {
      logger.info(`Removing scripts of old theme ${themeName}.`)
      this.pluginService.removePlugin(oldTheme)
    }
  }

  private removeThemeFromLocalStorageIfNeeded (themes: ServerConfigTheme[]) {
    if (!this.themeFromLocalStorage) return
    if (this.internalThemes.includes(this.themeFromLocalStorage.name)) return

    const loadedTheme = themes.find(t => t.name === this.themeFromLocalStorage.name)
    if (!loadedTheme || loadedTheme.version !== this.themeFromLocalStorage.version) {
      // Need to remove this theme: we loaded an old version or a theme that does not exist anymore
      this.removeThemePlugins(this.themeFromLocalStorage.name)
      this.oldThemeName = undefined

      for (const htmlLinkElement of this.themeDOMLinksFromLocalStorage) {
        this.themeManager.removeThemeLink(htmlLinkElement)
      }

      this.themeFromLocalStorage = undefined
      this.themeDOMLinksFromLocalStorage = []
    }
  }

  private getTheme (name: string) {
    return this.themes.find(t => t.name === name)
  }

  // ---------------------------------------------------------------------------
  // Utils
  // ---------------------------------------------------------------------------

  formatColorForForm (value: string) {
    if (!value) return null

    try {
      return formatHEX(parse(value))
    } catch (err) {
      logger.warn(`Error parsing color value "${value}"`, err)

      return null
    }
  }

  formatPixelsForForm (value: string) {
    if (typeof value === 'number') return value + ''
    if (typeof value !== 'string') return null

    const result = parseInt(value.replace(/px$/, ''))

    if (isNaN(result)) return null

    return result + ''
  }
}
