import { Injectable } from '@angular/core'
import { sortBy } from '@peertube/peertube-core-utils'
import { HTMLServerConfig, ServerConfig, ServerConfigTheme } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { capitalizeFirstLetter } from '@root-helpers/string'
import { UserLocalStorageKeys } from '@root-helpers/users'
import { getLuminance, parse, toHSLA } from 'color-bits'
import debug from 'debug'
import { environment } from '../../../environments/environment'
import { AuthService } from '../auth'
import { PluginService } from '../plugins/plugin.service'
import { ServerService } from '../server'
import { UserService } from '../users/user.service'
import { LocalStorageService } from '../wrappers/storage.service'

const debugLogger = debug('peertube:theme')

@Injectable()
export class ThemeService {
  private oldInjectedProperties: string[] = []
  private oldThemeName: string

  private internalThemes: string[] = []
  private themes: ServerConfigTheme[] = []

  private themeFromLocalStorage: Pick<ServerConfigTheme, 'name' | 'version'>
  private themeDOMLinksFromLocalStorage: HTMLLinkElement[] = []

  private serverConfig: HTMLServerConfig

  constructor (
    private auth: AuthService,
    private userService: UserService,
    private pluginService: PluginService,
    private server: ServerService,
    private localStorageService: LocalStorageService
  ) {}

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

  private injectThemes (themes: ServerConfigTheme[], fromLocalStorage = false) {
    this.themes = themes

    logger.info(`Injecting ${this.themes.length} themes.`)

    const head = this.getHeadElement()

    for (const theme of this.themes) {
      // Already added this theme?
      if (fromLocalStorage === false && this.themeFromLocalStorage && this.themeFromLocalStorage.name === theme.name) continue

      for (const css of theme.css) {
        const link = document.createElement('link')

        const href = environment.apiUrl + `/themes/${theme.name}/${theme.version}/css/${css}`
        link.setAttribute('href', href)
        link.setAttribute('rel', 'alternate stylesheet')
        link.setAttribute('type', 'text/css')
        link.setAttribute('title', theme.name)
        link.setAttribute('disabled', '')

        if (fromLocalStorage === true) this.themeDOMLinksFromLocalStorage.push(link)

        head.appendChild(link)
      }
    }
  }

  private getCurrentTheme () {
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

  private loadThemeStyle (name: string) {
    const links = document.getElementsByTagName('link')

    for (let i = 0; i < links.length; i++) {
      const link = links[i]
      if (link.getAttribute('rel').includes('style') && link.getAttribute('title')) {
        link.disabled = link.getAttribute('title') !== name

        if (!link.disabled) {
          link.onload = () => this.injectColorPalette()
        } else {
          link.onload = undefined
        }
      }
    }

    document.body.dataset.ptTheme = name
  }

  private updateCurrentTheme () {
    const currentTheme = this.getCurrentTheme()
    if (this.oldThemeName === currentTheme) return

    if (this.oldThemeName) this.removeThemePlugins(this.oldThemeName)

    logger.info(`Enabling ${currentTheme} theme.`)

    this.loadThemeStyle(currentTheme)

    const theme = this.getTheme(currentTheme)

    if (this.internalThemes.includes(currentTheme)) {
      logger.info(`Enabling internal theme ${currentTheme}`)

      this.localStorageService.setItem(UserLocalStorageKeys.LAST_ACTIVE_THEME, JSON.stringify({ name: currentTheme }), false)
    } else if (theme) {
      logger.info(`Adding scripts of theme ${currentTheme}`)

      this.pluginService.addPlugin(theme, true)

      this.pluginService.reloadLoadedScopes()

      this.localStorageService.setItem(UserLocalStorageKeys.LAST_ACTIVE_THEME, JSON.stringify(theme), false)
    } else {
      this.localStorageService.removeItem(UserLocalStorageKeys.LAST_ACTIVE_THEME, false)
    }

    setTimeout(() => this.injectColorPalette(), 0)

    this.oldThemeName = currentTheme
  }

  private injectColorPalette () {
    const rootStyle = document.body.style
    const computedStyle = getComputedStyle(document.body)

    // FIXME: Remove previously injected properties
    for (const property of this.oldInjectedProperties) {
      rootStyle.removeProperty(property)
    }

    this.oldInjectedProperties = []

    const isGlobalDarkTheme = () => {
      return this.isDarkTheme({
        fg: computedStyle.getPropertyValue('--fg') || computedStyle.getPropertyValue('--mainForegroundColor'),
        bg: computedStyle.getPropertyValue('--bg') || computedStyle.getPropertyValue('--mainBackgroundColor'),
        isDarkVar: computedStyle.getPropertyValue('--is-dark')
      })
    }

    const isMenuDarkTheme = () => {
      return this.isDarkTheme({
        fg: computedStyle.getPropertyValue('--menu-fg'),
        bg: computedStyle.getPropertyValue('--menu-bg'),
        isDarkVar: computedStyle.getPropertyValue('--is-menu-dark')
      })
    }

    const toProcess = [
      { prefix: 'primary', invertIfDark: true, step: 5, darkTheme: isGlobalDarkTheme },
      { prefix: 'on-primary', invertIfDark: true, step: 5, darkTheme: isGlobalDarkTheme },
      { prefix: 'bg-secondary', invertIfDark: true, step: 5, darkTheme: isGlobalDarkTheme },
      { prefix: 'fg', invertIfDark: true, fallbacks: { '--fg-300': '--greyForegroundColor' }, step: 5, darkTheme: isGlobalDarkTheme },

      { prefix: 'menu-fg', invertIfDark: true, step: 5, darkTheme: isMenuDarkTheme },
      { prefix: 'menu-bg', invertIfDark: true, step: 5, darkTheme: isMenuDarkTheme }
    ] as { prefix: string, invertIfDark: boolean, step: number, darkTheme: () => boolean, fallbacks?: Record<string, string> }[]

    for (const { prefix, invertIfDark, step, darkTheme, fallbacks = {} } of toProcess) {
      const mainColor = computedStyle.getPropertyValue('--' + prefix)

      const darkInverter = invertIfDark && darkTheme()
        ? -1
        : 1

      if (!mainColor) {
        console.error(`Cannot create palette of nonexistent "--${prefix}" CSS body variable`)
        continue
      }

      const mainColorHSL = toHSLA(parse(mainColor))
      debugLogger(`Theme main variable ${mainColor} -> ${this.toHSLStr(mainColorHSL)}`)

      // Inject in alphabetical order for easy debug
      const toInject: { id: number, key: string, value: string }[] = [
        { id: 500, key: `--${prefix}-500`, value: this.toHSLStr(mainColorHSL) }
      ]

      for (const j of [ -1, 1 ]) {
        let lastColorHSL = { ...mainColorHSL }

        for (let i = 1; i <= 9; i++) {
          const suffix = 500 + (50 * i * j)
          const key = `--${prefix}-${suffix}`

          const existingValue = computedStyle.getPropertyValue(key)
          if (!existingValue || existingValue === '0') {
            const newLuminance = this.buildNewLuminance(lastColorHSL, j * step, darkInverter)
            const newColorHSL = { ...lastColorHSL, l: newLuminance }

            const newColorStr = this.toHSLStr(newColorHSL)

            const value = fallbacks[key]
              ? `var(${fallbacks[key]}, ${newColorStr})`
              : newColorStr

            toInject.push({ id: suffix, key, value })

            lastColorHSL = newColorHSL

            debugLogger(`Injected theme palette ${key} -> ${value}`)
          } else {
            lastColorHSL = toHSLA(parse(existingValue))
          }
        }
      }

      for (const { key, value } of sortBy(toInject, 'id')) {
        rootStyle.setProperty(key, value)
        this.oldInjectedProperties.push(key)
      }
    }

    document.body.dataset.bsTheme = isGlobalDarkTheme()
      ? 'dark'
      : ''
  }

  private buildNewLuminance (base: { l: number }, factor: number, darkInverter: number) {
    return Math.max(Math.min(100, Math.round(base.l + (factor * -1 * darkInverter))), 0)
  }

  private toHSLStr (c: { h: number, s: number, l: number, a: number }) {
    return `hsl(${Math.round(c.h)} ${Math.round(c.s)}% ${Math.round(c.l)}% / ${Math.round(c.a)})`
  }

  private isDarkTheme (options: {
    fg: string
    bg: string
    isDarkVar: string
  }) {
    const { fg, bg, isDarkVar } = options

    if (isDarkVar === '1') {
      return true
    } else if (fg && bg) {
      try {
        if (getLuminance(parse(bg)) < getLuminance(parse(fg))) {
          return true
        }
      } catch (err) {
        console.error('Cannot parse deprecated CSS variables', err)
      }
    }

    return false
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

      const head = this.getHeadElement()
      for (const htmlLinkElement of this.themeDOMLinksFromLocalStorage) {
        head.removeChild(htmlLinkElement)
      }

      this.themeFromLocalStorage = undefined
      this.themeDOMLinksFromLocalStorage = []
    }
  }

  private getHeadElement () {
    return document.getElementsByTagName('head')[0]
  }

  private getTheme (name: string) {
    return this.themes.find(t => t.name === name)
  }
}
