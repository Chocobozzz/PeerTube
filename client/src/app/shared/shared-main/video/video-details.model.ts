import { Account } from '@app/shared/shared-main/account/account.model'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import {
  ConstantLabel,
  VideoCommentPolicyType,
  VideoDetails as VideoDetailsServerModel,
  VideoEmbedPrivacyPolicy,
  VideoEmbedPrivacyPolicyType,
  VideoFile,
  VideoStateType,
  VideoStreamingPlaylist,
  VideoStreamingPlaylistType
} from '@peertube/peertube-models'
import { Video } from './video.model'
import { sortBy } from '@peertube/peertube-core-utils'

export class VideoDetails extends Video implements VideoDetailsServerModel {
  declare channel: VideoChannel
  declare account: Account

  support: string
  tags: string[]
  downloadEnabled: boolean

  commentsPolicy: ConstantLabel<VideoCommentPolicyType>

  likesPercent: number
  dislikesPercent: number

  trackerUrls: string[]

  inputFileUpdatedAt: Date | string

  embedPrivacyPolicy: ConstantLabel<VideoEmbedPrivacyPolicyType>

  // These fields are not optional
  declare files: VideoFile[]
  declare streamingPlaylists: VideoStreamingPlaylist[]
  declare waitTranscoding: boolean
  declare state: ConstantLabel<VideoStateType>

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

    this.embedPrivacyPolicy = hash.embedPrivacyPolicy

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

  hasEmbedRestrictions () {
    return this.embedPrivacyPolicy.id !== VideoEmbedPrivacyPolicy.ALL_ALLOWED
  }

  // Try to find the best video file to download
  // It builds an array and prioritizes web videos that play on more third-party players.
  getFilesForDownload () {
    const store = this.files

    for (const file of (this.getHlsPlaylist()?.files || [])) {
      if (!store.some(f => f.resolution.id === file.resolution.id && f.fps === file.fps)) {
        store.push(file)
      }
    }

    return sortBy(store, 'resolution', 'id').reverse()
  }
}
