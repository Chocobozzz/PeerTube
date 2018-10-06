import { UserRight, VideoConstant, VideoDetails as VideoDetailsServerModel, VideoFile, VideoState } from '../../../../../shared'
import { AuthUser } from '../../core'
import { Video } from '../../shared/video/video.model'
import { Account } from '@app/shared/account/account.model'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'

export class VideoDetails extends Video implements VideoDetailsServerModel {
  descriptionPath: string
  support: string
  channel: VideoChannel
  tags: string[]
  files: VideoFile[]
  account: Account
  commentsEnabled: boolean

  waitTranscoding: boolean
  state: VideoConstant<VideoState>

  likesPercent: number
  dislikesPercent: number

  constructor (hash: VideoDetailsServerModel, translations = {}) {
    super(hash, translations)

    this.descriptionPath = hash.descriptionPath
    this.files = hash.files
    this.channel = new VideoChannel(hash.channel)
    this.account = new Account(hash.account)
    this.tags = hash.tags
    this.support = hash.support
    this.commentsEnabled = hash.commentsEnabled

    this.buildLikeAndDislikePercents()
  }

  isRemovableBy (user: AuthUser) {
    return user && this.isLocal === true && (this.account.name === user.username || user.hasRight(UserRight.REMOVE_ANY_VIDEO))
  }

  isBlackistableBy (user: AuthUser) {
    return this.blacklisted !== true && user && user.hasRight(UserRight.MANAGE_VIDEO_BLACKLIST) === true
  }

  isUnblacklistableBy (user: AuthUser) {
    return this.blacklisted === true && user && user.hasRight(UserRight.MANAGE_VIDEO_BLACKLIST) === true
  }

  isUpdatableBy (user: AuthUser) {
    return user && this.isLocal === true && (this.account.name === user.username || user.hasRight(UserRight.UPDATE_ANY_VIDEO))
  }

  buildLikeAndDislikePercents () {
    this.likesPercent = (this.likes / (this.likes + this.dislikes)) * 100
    this.dislikesPercent = (this.dislikes / (this.likes + this.dislikes)) * 100
  }
}
