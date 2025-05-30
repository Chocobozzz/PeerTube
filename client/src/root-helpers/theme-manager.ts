import { sortBy } from '@peertube/peertube-core-utils'
import { getLuminance, parse, toHSLA } from 'color-bits'
import { ServerConfigTheme } from '@peertube/peertube-models'
import { logger } from './logger'
import debug from 'debug'

const debugLogger = debug('peertube:theme')

export class ThemeManager {
  private oldInjectedProperties: string[] = []

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
          link.onload = () => this.injectColorPalette()
        } else {
          link.onload = undefined
        }
      }
    }

    document.body.dataset.ptTheme = name
  }

  injectCoreColorPalette (iteration = 0) {
    if (iteration > 100) {
      logger.error('Too many iteration when checking color palette injection. The theme may be missing the --is-dark CSS variable')

      this.injectColorPalette()
      return
    }

    if (!this.canInjectCoreColorPalette()) {
      return setTimeout(() => this.injectCoreColorPalette(iteration + 1), Math.floor(iteration / 10))
    }

    return this.injectColorPalette()
  }

  removeThemeLink (linkEl: HTMLLinkElement) {
    this.getHeadElement().removeChild(linkEl)
  }

  private canInjectCoreColorPalette () {
    const computedStyle = getComputedStyle(document.body)
    const isDark = computedStyle.getPropertyValue('--is-dark')

    return isDark === '0' || isDark === '1'
  }

  private injectColorPalette () {
    console.log(`Injecting color palette`)

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
        console.error(`Cannot create palette of nonexistent "--${prefix}" CSS body variable`)
        continue
      }

      // Use trim for some web browsers: https://github.com/Chocobozzz/PeerTube/issues/6952
      const mainColorHSL = toHSLA(parse(mainColor.trim()))
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

  private getHeadElement () {
    return document.getElementsByTagName('head')[0]
  }
}
