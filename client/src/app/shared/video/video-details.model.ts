import {
  UserRight,
  VideoChannel,
  VideoDetails as VideoDetailsServerModel,
  VideoFile,
  VideoPrivacy,
  VideoResolution
} from '../../../../../shared'
import { Account } from '../../../../../shared/models/actors'
import { VideoConstant } from '../../../../../shared/models/videos/video.model'
import { AuthUser } from '../../core'
import { Video } from '../../shared/video/video.model'

export class VideoDetails extends Video implements VideoDetailsServerModel {
  privacy: VideoConstant<VideoPrivacy>
  descriptionPath: string
  support: string
  channel: VideoChannel
  tags: string[]
  files: VideoFile[]
  account: Account
  commentsEnabled: boolean

  likesPercent: number
  dislikesPercent: number

  constructor (hash: VideoDetailsServerModel) {
    super(hash)

    this.privacy = hash.privacy
    this.descriptionPath = hash.descriptionPath
    this.files = hash.files
    this.channel = hash.channel
    this.account = hash.account
    this.tags = hash.tags
    this.support = hash.support
    this.commentsEnabled = hash.commentsEnabled

    this.buildLikeAndDislikePercents()
  }

  getAppropriateMagnetUri (actualDownloadSpeed = 0) {
    if (this.files === undefined || this.files.length === 0) return ''
    if (this.files.length === 1) return this.files[0].magnetUri

    // Find first video that is good for our download speed (remember they are sorted)
    let betterResolutionFile = this.files.find(f => actualDownloadSpeed > (f.size / this.duration))

    // If the download speed is too bad, return the lowest resolution we have
    if (betterResolutionFile === undefined) {
      betterResolutionFile = this.files.find(f => f.resolution.id === VideoResolution.H_240P)
    }

    return betterResolutionFile.magnetUri
  }

  isRemovableBy (user: AuthUser) {
    return user && this.isLocal === true && (this.account.name === user.username || user.hasRight(UserRight.REMOVE_ANY_VIDEO))
  }

  isBlackistableBy (user: AuthUser) {
    return user && user.hasRight(UserRight.MANAGE_VIDEO_BLACKLIST) === true && this.isLocal === false
  }

  isUpdatableBy (user: AuthUser) {
    return user && this.isLocal === true && (this.account.name === user.username || user.hasRight(UserRight.UPDATE_ANY_VIDEO))
  }

  buildLikeAndDislikePercents () {
    this.likesPercent = (this.likes / (this.likes + this.dislikes)) * 100
    this.dislikesPercent = (this.dislikes / (this.likes + this.dislikes)) * 100
  }
}
