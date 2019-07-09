import { DEFAULT_THEME } from '../../initializers/constants'
import { PluginManager } from './plugin-manager'
import { CONFIG } from '../../initializers/config'

function getThemeOrDefault (name: string) {
  if (isThemeRegistered(name)) return name

  // Fallback to admin default theme
  if (name !== CONFIG.THEME.DEFAULT) return getThemeOrDefault(CONFIG.THEME.DEFAULT)

  return DEFAULT_THEME
}

function isThemeRegistered (name: string) {
  if (name === DEFAULT_THEME) return true

  return !!PluginManager.Instance.getRegisteredThemes()
                        .find(r => r.name === name)
}

export {
  getThemeOrDefault,
  isThemeRegistered
}
