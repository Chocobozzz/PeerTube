import { PlayerSettingModel } from '@server/models/video/player-setting.js'

export type MPlayerSetting = Omit<PlayerSettingModel, 'Video' | 'VideoChannel'>
