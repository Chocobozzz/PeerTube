import { UserRight, VideoChannel, VideoDetails as VideoDetailsServerModel, VideoFile } from '../../../../../shared'
import { Account } from '../../../../../shared/models/actors'
import { AuthUser } from '../../core'
import { Video } from '../../shared/video/video.model'

export class VideoDetails extends Video implements VideoDetailsServerModel {
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

    this.descriptionPath = hash.descriptionPath
    this.files = hash.files
    this.channel = hash.channel
    this.account = hash.account
    this.tags = hash.tags
    this.support = hash.support
    this.commentsEnabled = hash.commentsEnabled

    this.buildLikeAndDislikePercents()
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
