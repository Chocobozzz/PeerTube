import { UserActorImageJSON } from './actor-export.model.js'

export interface AccountExportJSON {
  url: string

  name: string
  displayName: string
  description: string

  updatedAt: string
  createdAt: string

  avatars: UserActorImageJSON[]

  archiveFiles: {
    avatar: string | null
  }
}
