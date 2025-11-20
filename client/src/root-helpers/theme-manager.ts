import { sortBy } from '@peertube/peertube-core-utils'
import { getLuminance, parse, toHSLA } from 'color-bits'
import { HTMLServerConfig, ServerConfig, ServerConfigTheme } from '@peertube/peertube-models'
import { logger } from './logger'
import debug from 'debug'

const debugLogger = debug('peertube:theme')

type ConfigCSSVariableMap = Record<keyof ServerConfig['theme']['customization'], string>

export type ThemeCustomizationKey = keyof ConfigCSSVariableMap
export type ColorPaletteThemeConfig = Pick<HTMLServerConfig['theme'], 'default' | 'customization'>

export class ThemeManager {
  private configVariablesStyle: HTMLStyleElement
  private colorPaletteStyle: HTMLStyleElement
  private configuredCSSVariables = new Set<string>()

  private readonly configCSSVariableMap: ConfigCSSVariableMap = {
    primaryColor: '--primary',
    foregroundColor: '--fg',
    backgroundColor: '--bg',
    backgroundSecondaryColor: '--bg-secondary',
    menuForegroundColor: '--menu-fg',
    menuBackgroundColor: '--menu-bg',
    menuBorderRadius: '--menu-border-radius',
    headerForegroundColor: '--header-fg',
    headerBackgroundColor: '--header-bg',
    inputBorderRadius: '--input-border-radius'
  }

  private defaultConfigValue: Record<keyof ConfigCSSVariableMap, string>

  getCSSConfigValue (configKey: ThemeCustomizationKey) {
    const cssVariable = this.configCSSVariableMap[configKey]

    return getComputedStyle(document.documentElement).getPropertyValue(cssVariable)
  }

  injectConfigVariables (options: {
    currentTheme: string
    config: ColorPaletteThemeConfig
  }) {
    const { currentTheme, config } = options

    if (!this.configVariablesStyle) {
      this.configVariablesStyle = document.createElement('style')
      this.configVariablesStyle.setAttribute('type', 'text/css')
      this.configVariablesStyle.dataset.ptStyleId = 'config-variables'
      document.head.appendChild(this.configVariablesStyle)
    }

    this.configuredCSSVariables.clear()
    this.configVariablesStyle.textContent = ''

    // Only inject config variables for the default theme
    if (currentTheme !== config.default) return

    const computedStyle = getComputedStyle(document.documentElement)

    let configStyleContent = ''

    this.defaultConfigValue = {} as any

    for (const [ configKey, configValue ] of Object.entries(config.customization) as ([keyof ConfigCSSVariableMap, string][])) {
      const cssVariable = this.configCSSVariableMap[configKey]

      this.defaultConfigValue[configKey] = computedStyle.getPropertyValue(cssVariable)

      if (!configValue) continue

      if (!cssVariable) {
        logger.error(`Unknown UI config variable "${configKey}" with value "${configValue}"`)
        continue
      }

      configStyleContent += `  ${cssVariable}: ${configValue};\n`
      this.configuredCSSVariables.add(cssVariable)
    }

    if (configStyleContent) {
      this.configVariablesStyle.textContent = `:root[data-pt-theme=${currentTheme}] {\n${configStyleContent} }`
    }
  }

  injectTheme (theme: ServerConfigTheme, apiUrl: string) {
    const head = this.getHeadElement()

    const result: HTMLLinkElement[] = []

    for (const css of theme.css) {
      const link = document.createElement('link')

      const href = apiUrl + `/themes/${theme.name}/${theme.version}/css/${css}`
      link.setAttribute('href', href)
      link.setAttribute('rel', 'alternate stylesheet')
      link.setAttribute('type', 'text/css')
      link.setAttribute('title', theme.name)
      link.setAttribute('disabled', '')

      head.appendChild(link)

      result.push(link)
    }

    return result
  }

  loadThemeStyle (name: string) {
    const links = document.getElementsByTagName('link')

    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < links.length; i++) {
      const link = links[i]
      if (link.getAttribute('rel').includes('style') && link.getAttribute('title')) {
        link.disabled = link.getAttribute('title') !== name

        if (!link.disabled) {
          link.onload = () => this._injectColorPalette()
        } else {
          link.onload = undefined
        }
      }
    }

    document.documentElement.dataset.ptTheme = name
  }

  injectColorPalette (options: {
    config: ColorPaletteThemeConfig
    currentTheme: string
  }, iteration = 0) {
    if (iteration > 100) {
      logger.error('Too many iteration when checking color palette injection. The theme may be missing the --is-dark CSS variable')
    } else if (!this.canInjectCoreColorPalette()) {
      return setTimeout(() => this.injectColorPalette(options, iteration + 1), Math.floor(iteration / 10))
    }

    debugLogger(`Update color palette`, options.config)

    this.injectConfigVariables(options)

    return this._injectColorPalette()
  }

  removeThemeLink (linkEl: HTMLLinkElement) {
    this.getHeadElement().removeChild(linkEl)
  }

  private canInjectCoreColorPalette () {
    const computedStyle = getComputedStyle(document.documentElement)
    const isDark = computedStyle.getPropertyValue('--is-dark')

    return isDark === '0' || isDark === '1'
  }

  private _injectColorPalette () {
    try {
      if (!this.colorPaletteStyle) {
        this.colorPaletteStyle = document.createElement('style')
        this.colorPaletteStyle.setAttribute('type', 'text/css')
        this.colorPaletteStyle.dataset.ptStyleId = 'color-palette'
        document.head.appendChild(this.colorPaletteStyle)
      }

      let paletteStyleContent = ''

      const computedStyle = getComputedStyle(document.documentElement)
      this.colorPaletteStyle.textContent = ''

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

        { prefix: 'input-bg', invertIfDark: true, step: 5, darkTheme: isGlobalDarkTheme },

        { prefix: 'menu-fg', invertIfDark: true, step: 5, darkTheme: isMenuDarkTheme },
        { prefix: 'menu-bg', invertIfDark: true, step: 5, darkTheme: isMenuDarkTheme }
      ] as { prefix: string, invertIfDark: boolean, step: number, darkTheme: () => boolean, fallbacks?: Record<string, string> }[]

      for (const { prefix, invertIfDark, step, darkTheme, fallbacks = {} } of toProcess) {
        const mainColor = computedStyle.getPropertyValue('--' + prefix)

        const darkInverter = invertIfDark && darkTheme()
          ? -1
          : 1

        if (!mainColor) {
          console.error(`Cannot create palette of nonexistent "--${prefix}" CSS documentElement variable`)
          continue
        }

        // Use trim for some web browsers: https://github.com/Chocobozzz/PeerTube/issues/6952
        const mainColorHSL = toHSLA(parse(mainColor.trim()))
        debugLogger(`Theme main variable --${prefix}: ${mainColor} -> ${this.toHSLStr(mainColorHSL)}`)

        // Inject in alphabetical order for easy debug
        const toInject: { id: number, key: string, value: string }[] = [
          { id: 500, key: `--${prefix}-500`, value: this.toHSLStr(mainColorHSL) }
        ]

        for (const j of [ -1, 1 ]) {
          let lastColorHSL = { ...mainColorHSL }

          for (let i = 1; i <= 9; i++) {
            const suffix = 500 + (50 * i * j)
            const key = `--${prefix}-${suffix}`

            // Override all our variables if the CSS variable has been configured by the admin
            const existingValue = this.configuredCSSVariables.has(`--${prefix}`)
              ? '0'
              : computedStyle.getPropertyValue(key)

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
          paletteStyleContent += `  ${key}: ${value};\n`
        }

        if (paletteStyleContent) {
          // To override default variables
          document.documentElement.classList.add('color-palette')

          this.colorPaletteStyle.textContent = `:root.color-palette {\n${paletteStyleContent} }`
        }
      }

      document.documentElement.dataset.bsTheme = isGlobalDarkTheme()
        ? 'dark'
        : ''
    } catch (err) {
      logger.error('Cannot inject color palette', err)
    }
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

  private getHeadElement () {
    return document.getElementsByTagName('head')[0]
  }
}
