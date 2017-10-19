export interface VideoFile {
  magnetUri: string
  resolution: number
  resolutionLabel: string
  size: number // Bytes
  torrentUrl: string
  fileUrl: string
}

export interface Video {
  id: number
  uuid: string
  author: string
  createdAt: Date | string
  updatedAt: Date | string
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
  embedPath: string
  views: number
  likes: number
  dislikes: number
  nsfw: boolean
  files: VideoFile[]
}
