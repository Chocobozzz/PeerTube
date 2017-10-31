import { Video } from './video.model'
import { AuthUser } from '../../core'
import {
  VideoDetails as VideoDetailsServerModel,
  VideoFile,
  VideoChannel,
  VideoResolution,
  UserRight,
  VideoPrivacy
} from '../../../../../shared'

export class VideoDetails extends Video implements VideoDetailsServerModel {
  author: string
  by: string
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
  durationLabel: string
  id: number
  uuid: string
  isLocal: boolean
  name: string
  podHost: string
  tags: string[]
  thumbnailPath: string
  thumbnailUrl: string
  previewPath: string
  previewUrl: string
  embedPath: string
  embedUrl: string
  views: number
  likes: number
  dislikes: number
  nsfw: boolean
  descriptionPath: string
  files: VideoFile[]
  channel: VideoChannel
  privacy: VideoPrivacy
  privacyLabel: string

  constructor (hash: VideoDetailsServerModel) {
    super(hash)

    this.privacy = hash.privacy
    this.privacyLabel = hash.privacyLabel
    this.descriptionPath = hash.descriptionPath
    this.files = hash.files
    this.channel = hash.channel
  }

  getAppropriateMagnetUri (actualDownloadSpeed = 0) {
    if (this.files === undefined || this.files.length === 0) return ''
    if (this.files.length === 1) return this.files[0].magnetUri

    // Find first video that is good for our download speed (remember they are sorted)
    let betterResolutionFile = this.files.find(f => actualDownloadSpeed > (f.size / this.duration))

    // If the download speed is too bad, return the lowest resolution we have
    if (betterResolutionFile === undefined) {
      betterResolutionFile = this.files.find(f => f.resolution === VideoResolution.H_240P)
    }

    return betterResolutionFile.magnetUri
  }

  isRemovableBy (user: AuthUser) {
    return user && this.isLocal === true && (this.author === user.username || user.hasRight(UserRight.REMOVE_ANY_VIDEO))
  }

  isBlackistableBy (user: AuthUser) {
    return user && user.hasRight(UserRight.MANAGE_VIDEO_BLACKLIST) === true && this.isLocal === false
  }

  isUpdatableBy (user: AuthUser) {
    return user && this.isLocal === true && user.username === this.author
  }
}
