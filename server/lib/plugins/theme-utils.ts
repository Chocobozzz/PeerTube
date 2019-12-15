import { DEFAULT_THEME_NAME, DEFAULT_USER_THEME_NAME } from '../../initializers/constants'
import { PluginManager } from './plugin-manager'
import { CONFIG } from '../../initializers/config'

function getThemeOrDefault (name: string, defaultTheme: string) {
  if (isThemeRegistered(name)) return name

  // Fallback to admin default theme
  if (name !== CONFIG.THEME.DEFAULT) return getThemeOrDefault(CONFIG.THEME.DEFAULT, DEFAULT_THEME_NAME)

  return defaultTheme
}

function isThemeRegistered (name: string) {
  if (name === DEFAULT_THEME_NAME || name === DEFAULT_USER_THEME_NAME) return true

  return !!PluginManager.Instance.getRegisteredThemes()
                        .find(r => r.name === name)
}

export {
  getThemeOrDefault,
  isThemeRegistered
}
