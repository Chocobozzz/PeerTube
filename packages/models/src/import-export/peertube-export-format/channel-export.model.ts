import { PlayerThemeChannelSetting } from '../../player/player-theme.type.js'
import { ImageExportJSON } from './image-export.model.js'

export interface ChannelExportJSON {
  channels: {
    url: string

    name: string
    displayName: string
    description: string
    support: string

    updatedAt: string
    createdAt: string

    avatars: ImageExportJSON[]
    banners: ImageExportJSON[]

    playerSettings?: {
      theme: PlayerThemeChannelSetting
    }

    archiveFiles: {
      avatar: string | null
      banner: string | null
    }
  }[]
}
