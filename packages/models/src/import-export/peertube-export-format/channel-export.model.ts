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

    archiveFiles: {
      avatar: string | null
      banner: string | null
    }
  }[]
}
