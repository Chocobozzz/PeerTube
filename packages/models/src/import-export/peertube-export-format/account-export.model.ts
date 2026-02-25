import { ImageExportJSON } from './image-export.model.js'

export interface AccountExportJSON {
  url: string

  name: string
  displayName: string
  description: string

  updatedAt: string
  createdAt: string

  avatars: ImageExportJSON[]

  archiveFiles: {
    avatar: string | null
  }
}
