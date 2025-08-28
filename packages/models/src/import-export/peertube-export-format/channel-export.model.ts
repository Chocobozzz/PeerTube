import { PlayerThemeChannelSetting } from '../../player/player-theme.type.js'
import { UserActorImageJSON } from './actor-export.model.js'

export interface ChannelExportJSON {
  channels: {
    url: string

    name: string
    displayName: string
    description: string
    support: string

    updatedAt: string
    createdAt: string

    avatars: UserActorImageJSON[]
    banners: UserActorImageJSON[]

    playerSettings?: {
      theme: PlayerThemeChannelSetting
    }

    archiveFiles: {
      avatar: string | null
      banner: string | null
    }
  }[]
}
