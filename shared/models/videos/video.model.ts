export interface VideoFile {
  magnetUri: string
  resolution: number
  resolutionLabel: string
  size: number // Bytes
}

export interface Video {
  id: number
  uuid: string
  author: string
  createdAt: Date
  updatedAt: Date
  categoryLabel: string
  category: number
  licenceLabel: string
  licence: number
  languageLabel: string
  language: number
  description: string
  duration: number
  isLocal: boolean
  name: string
  podHost: string
  tags: string[]
  thumbnailPath: string
  previewPath: string
  views: number
  likes: number
  dislikes: number
  nsfw: boolean
  files: VideoFile[]
}
