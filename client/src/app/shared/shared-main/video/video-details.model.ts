import { Account } from '@app/shared/shared-main/account/account.model'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import {
  VideoCommentPolicyType,
  VideoConstant,
  VideoDetails as VideoDetailsServerModel,
  VideoFile,
  VideoStateType,
  VideoStreamingPlaylist,
  VideoStreamingPlaylistType
} from '@peertube/peertube-models'
import { Video } from './video.model'

export class VideoDetails extends Video implements VideoDetailsServerModel {
  declare channel: VideoChannel
  declare account: Account

  support: string
  tags: string[]
  downloadEnabled: boolean

  commentsEnabled: never
  commentsPolicy: VideoConstant<VideoCommentPolicyType>

  likesPercent: number
  dislikesPercent: number

  trackerUrls: string[]

  inputFileUpdatedAt: Date | string

  // These fields are not optional
  declare files: VideoFile[]
  declare streamingPlaylists: VideoStreamingPlaylist[]
  declare waitTranscoding: boolean
  declare state: VideoConstant<VideoStateType>

  constructor (hash: VideoDetailsServerModel, translations = {}) {
    super(hash, translations)

    this.channel = new VideoChannel(hash.channel)
    this.account = new Account(hash.account)
    this.tags = hash.tags
    this.support = hash.support
    this.commentsPolicy = hash.commentsPolicy
    this.downloadEnabled = hash.downloadEnabled

    this.inputFileUpdatedAt = hash.inputFileUpdatedAt

    this.trackerUrls = hash.trackerUrls

    this.buildLikeAndDislikePercents()
  }

  buildLikeAndDislikePercents () {
    this.likesPercent = (this.likes / (this.likes + this.dislikes)) * 100
    this.dislikesPercent = (this.dislikes / (this.likes + this.dislikes)) * 100
  }

  getHlsPlaylist () {
    return this.streamingPlaylists.find(p => p.type === VideoStreamingPlaylistType.HLS)
  }

  hasHlsPlaylist () {
    return !!this.getHlsPlaylist()
  }
}
