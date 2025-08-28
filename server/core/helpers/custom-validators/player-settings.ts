import { PlayerTheme, PlayerThemeVideoSetting } from '@peertube/peertube-models'
import { DEFAULT_CHANNEL_PLAYER_SETTING_VALUE, DEFAULT_INSTANCE_PLAYER_SETTING_VALUE } from '@server/initializers/constants.js'

export function isPlayerVideoThemeSettingValid (name: PlayerThemeVideoSetting) {
  return isPlayerChannelThemeSettingValid(name) || name === DEFAULT_CHANNEL_PLAYER_SETTING_VALUE
}

export function isPlayerChannelThemeSettingValid (name: PlayerThemeVideoSetting) {
  return name === DEFAULT_INSTANCE_PLAYER_SETTING_VALUE || isPlayerThemeValid(name as PlayerTheme)
}

const availableThemes = new Set<PlayerTheme>([ 'galaxy', 'lucide' ])

export function isPlayerThemeValid (name: PlayerTheme) {
  return availableThemes.has(name)
}
