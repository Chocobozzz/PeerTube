import { Account } from '../actors'
import { VideoChannel } from './video-channel.model'
import { VideoPrivacy } from './video-privacy.enum'

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
  accountName: string
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
  serverHost: string
  thumbnailPath: string
  previewPath: string
  embedPath: string
  views: number
  likes: number
  dislikes: number
  nsfw: boolean
}

export interface VideoDetails extends Video {
  privacy: VideoPrivacy
  privacyLabel: string
  descriptionPath: string
  support: string
  channel: VideoChannel
  tags: string[]
  files: VideoFile[]
  account: Account
  commentsEnabled: boolean
}
