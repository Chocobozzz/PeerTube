import { PlayerThemeChannelSetting, PlayerThemeVideoSetting } from '../player/player-theme.type.js'

export interface PlayerVideoSettingsUpdate {
  theme: PlayerThemeVideoSetting
}

export interface PlayerChannelSettingsUpdate {
  theme: PlayerThemeChannelSetting
}
