import { Account } from '@app/shared/shared-main/account/account.model'
import { VideoChannel } from '@app/shared/shared-main/video-channel/video-channel.model'
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
  descriptionPath: string
  support: string
  channel: VideoChannel
  tags: string[]
  account: Account
  downloadEnabled: boolean

  waitTranscoding: boolean
  state: VideoConstant<VideoStateType>

  commentsEnabled: never
  commentsPolicy: VideoConstant<VideoCommentPolicyType>

  likesPercent: number
  dislikesPercent: number

  trackerUrls: string[]

  inputFileUpdatedAt: Date | string

  files: VideoFile[]
  streamingPlaylists: VideoStreamingPlaylist[]

  constructor (hash: VideoDetailsServerModel, translations = {}) {
    super(hash, translations)

    this.descriptionPath = hash.descriptionPath
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

  getFiles () {
    if (this.files.length !== 0) return this.files

    const hls = this.getHlsPlaylist()
    if (hls) return hls.files

    return []
  }
}
