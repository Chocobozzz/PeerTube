import { PlayerSettingsObject } from '@peertube/peertube-models'
import { isPlayerChannelThemeSettingValid, isPlayerVideoThemeSettingValid } from '../player-settings.js'
import { isActivityPubUrlValid } from './misc.js'

export function sanitizeAndCheckPlayerSettingsObject (settings: PlayerSettingsObject, target: 'video' | 'channel') {
  if (!settings) return false

  if (settings.type !== 'PlayerSettings') return false
  if (target === 'video' && !isPlayerVideoThemeSettingValid(settings.theme)) return false
  if (target === 'channel' && !isPlayerChannelThemeSettingValid(settings.theme)) return false

  return isActivityPubUrlValid(settings.id)
}
