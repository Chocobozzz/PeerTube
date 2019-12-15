import { VideoConstant, VideoDetails as VideoDetailsServerModel, VideoFile, VideoState } from '../../../../../shared'
import { Video } from '../../shared/video/video.model'
import { Account } from '@app/shared/account/account.model'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { VideoStreamingPlaylist } from '../../../../../shared/models/videos/video-streaming-playlist.model'
import { VideoStreamingPlaylistType } from '../../../../../shared/models/videos/video-streaming-playlist.type'

export class VideoDetails extends Video implements VideoDetailsServerModel {
  descriptionPath: string
  support: string
  channel: VideoChannel
  tags: string[]
  files: VideoFile[]
  account: Account
  commentsEnabled: boolean
  downloadEnabled: boolean

  waitTranscoding: boolean
  state: VideoConstant<VideoState>

  likesPercent: number
  dislikesPercent: number

  trackerUrls: string[]

  streamingPlaylists: VideoStreamingPlaylist[]

  constructor (hash: VideoDetailsServerModel, translations = {}) {
    super(hash, translations)

    this.descriptionPath = hash.descriptionPath
    this.files = hash.files
    this.channel = new VideoChannel(hash.channel)
    this.account = new Account(hash.account)
    this.tags = hash.tags
    this.support = hash.support
    this.commentsEnabled = hash.commentsEnabled
    this.downloadEnabled = hash.downloadEnabled

    this.trackerUrls = hash.trackerUrls
    this.streamingPlaylists = hash.streamingPlaylists

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
    if (this.files.length === 0) return this.getHlsPlaylist().files

    return this.files
  }
}
