import { PlayerThemeChannelSetting, PlayerThemeVideoSetting } from '../../player/player-theme.type.js'

export interface PlayerSettingsObject {
  type: 'PlayerSettings'
  id: string
  object: string
  theme: PlayerThemeVideoSetting | PlayerThemeChannelSetting
}
