export interface Video {
  id: number
  uuid: string
  author: string
  createdAt: Date
  categoryLabel: string
  category: number
  licenceLabel: string
  licence: number
  languageLabel: string
  language: number
  description: string
  duration: number
  isLocal: boolean
  magnetUri: string
  name: string
  podHost: string
  tags: string[]
  thumbnailPath: string
  previewPath: string
  views: number
  likes: number
  dislikes: number
  nsfw: boolean
}
