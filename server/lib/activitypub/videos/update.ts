import { Transaction } from 'sequelize/types'
import { deleteNonExistingModels, resetSequelizeInstance } from '@server/helpers/database-utils'
import { logger } from '@server/helpers/logger'
import { sequelizeTypescript } from '@server/initializers/database'
import { Notifier } from '@server/lib/notifier'
import { PeerTubeSocket } from '@server/lib/peertube-socket'
import { createPlaceholderThumbnail, createVideoMiniatureFromUrl } from '@server/lib/thumbnail'
import { setVideoTags } from '@server/lib/video'
import { autoBlacklistVideoIfNeeded } from '@server/lib/video-blacklist'
import { VideoCaptionModel } from '@server/models/video/video-caption'
import { VideoFileModel } from '@server/models/video/video-file'
import { VideoLiveModel } from '@server/models/video/video-live'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist'
import {
  MChannelAccountLight,
  MChannelDefault,
  MStreamingPlaylistFilesVideo,
  MThumbnail,
  MVideoAccountLightBlacklistAllFiles,
  MVideoCaption,
  MVideoFile,
  MVideoFullLight
} from '@server/types/models'
import { ThumbnailType, VideoObject, VideoPrivacy } from '@shared/models'
import {
  getPreviewFromIcons,
  getTagsFromObject,
  getThumbnailFromIcons,
  getTrackerUrls,
  setVideoTrackers,
  streamingPlaylistActivityUrlToDBAttributes,
  videoActivityObjectToDBAttributes,
  videoFileActivityUrlToDBAttributes
} from './shared'

export class APVideoUpdater {
  private readonly video: MVideoAccountLightBlacklistAllFiles
  private readonly videoObject: VideoObject
  private readonly channel: MChannelDefault
  private readonly overrideTo: string[]

  private readonly wasPrivateVideo: boolean
  private readonly wasUnlistedVideo: boolean

  private readonly videoFieldsSave: any

  private readonly oldVideoChannel: MChannelAccountLight

  constructor (options: {
    video: MVideoAccountLightBlacklistAllFiles
    videoObject: VideoObject
    channel: MChannelDefault
    overrideTo?: string[]
  }) {
    this.video = options.video
    this.videoObject = options.videoObject
    this.channel = options.channel
    this.overrideTo = options.overrideTo

    this.wasPrivateVideo = this.video.privacy === VideoPrivacy.PRIVATE
    this.wasUnlistedVideo = this.video.privacy === VideoPrivacy.UNLISTED

    this.oldVideoChannel = this.video.VideoChannel

    this.videoFieldsSave = this.video.toJSON()
  }

  async update () {
    logger.debug('Updating remote video "%s".', this.videoObject.uuid, { videoObject: this.videoObject, channel: this.channel })

    try {
      const thumbnailModel = await this.tryToGenerateThumbnail()

      const videoUpdated = await sequelizeTypescript.transaction(async t => {
        this.checkChannelUpdateOrThrow()

        const videoUpdated = await this.updateVideo(t)

        await this.processIcons(videoUpdated, thumbnailModel, t)
        await this.processWebTorrentFiles(videoUpdated, t)
        await this.processStreamingPlaylists(videoUpdated, t)
        await this.processTags(videoUpdated, t)
        await this.processTrackers(videoUpdated, t)
        await this.processCaptions(videoUpdated, t)
        await this.processLive(videoUpdated, t)

        return videoUpdated
      })

      await autoBlacklistVideoIfNeeded({
        video: videoUpdated,
        user: undefined,
        isRemote: true,
        isNew: false,
        transaction: undefined
      })

      // Notify our users?
      if (this.wasPrivateVideo || this.wasUnlistedVideo) {
        Notifier.Instance.notifyOnNewVideoIfNeeded(videoUpdated)
      }

      if (videoUpdated.isLive) {
        PeerTubeSocket.Instance.sendVideoLiveNewState(videoUpdated)
        PeerTubeSocket.Instance.sendVideoViewsUpdate(videoUpdated)
      }

      logger.info('Remote video with uuid %s updated', this.videoObject.uuid)

      return videoUpdated
    } catch (err) {
      this.catchUpdateError(err)
    }
  }

  private tryToGenerateThumbnail (): Promise<MThumbnail> {
    return createVideoMiniatureFromUrl({
      downloadUrl: getThumbnailFromIcons(this.videoObject).url,
      video: this.video,
      type: ThumbnailType.MINIATURE
    }).catch(err => {
      logger.warn('Cannot generate thumbnail of %s.', this.videoObject.id, { err })

      return undefined
    })
  }

  // Check we can update the channel: we trust the remote server
  private checkChannelUpdateOrThrow () {
    if (!this.oldVideoChannel.Actor.serverId || !this.channel.Actor.serverId) {
      throw new Error('Cannot check old channel/new channel validity because `serverId` is null')
    }

    if (this.oldVideoChannel.Actor.serverId !== this.channel.Actor.serverId) {
      throw new Error(`New channel ${this.channel.Actor.url} is not on the same server than new channel ${this.oldVideoChannel.Actor.url}`)
    }
  }

  private updateVideo (transaction: Transaction) {
    const to = this.overrideTo || this.videoObject.to
    const videoData = videoActivityObjectToDBAttributes(this.channel, this.videoObject, to)
    this.video.name = videoData.name
    this.video.uuid = videoData.uuid
    this.video.url = videoData.url
    this.video.category = videoData.category
    this.video.licence = videoData.licence
    this.video.language = videoData.language
    this.video.description = videoData.description
    this.video.support = videoData.support
    this.video.nsfw = videoData.nsfw
    this.video.commentsEnabled = videoData.commentsEnabled
    this.video.downloadEnabled = videoData.downloadEnabled
    this.video.waitTranscoding = videoData.waitTranscoding
    this.video.state = videoData.state
    this.video.duration = videoData.duration
    this.video.createdAt = videoData.createdAt
    this.video.publishedAt = videoData.publishedAt
    this.video.originallyPublishedAt = videoData.originallyPublishedAt
    this.video.privacy = videoData.privacy
    this.video.channelId = videoData.channelId
    this.video.views = videoData.views
    this.video.isLive = videoData.isLive

    // Ensures we update the updated video attribute
    this.video.changed('updatedAt', true)

    return this.video.save({ transaction }) as Promise<MVideoFullLight>
  }

  private async processIcons (videoUpdated: MVideoFullLight, thumbnailModel: MThumbnail, t: Transaction) {
    if (thumbnailModel) await videoUpdated.addAndSaveThumbnail(thumbnailModel, t)

    // Don't fetch the preview that could be big, create a placeholder instead
    const previewIcon = getPreviewFromIcons(this.videoObject)
    if (videoUpdated.getPreview() && previewIcon) {
      const previewModel = createPlaceholderThumbnail({
        fileUrl: previewIcon.url,
        video: videoUpdated,
        type: ThumbnailType.PREVIEW,
        size: previewIcon
      })
      await videoUpdated.addAndSaveThumbnail(previewModel, t)
    }
  }

  private async processWebTorrentFiles (videoUpdated: MVideoFullLight, t: Transaction) {
    const videoFileAttributes = videoFileActivityUrlToDBAttributes(videoUpdated, this.videoObject.url)
    const newVideoFiles = videoFileAttributes.map(a => new VideoFileModel(a))

    // Remove video files that do not exist anymore
    const destroyTasks = deleteNonExistingModels(videoUpdated.VideoFiles, newVideoFiles, t)
    await Promise.all(destroyTasks)

    // Update or add other one
    const upsertTasks = newVideoFiles.map(f => VideoFileModel.customUpsert(f, 'video', t))
    videoUpdated.VideoFiles = await Promise.all(upsertTasks)
  }

  private async processStreamingPlaylists (videoUpdated: MVideoFullLight, t: Transaction) {
    const streamingPlaylistAttributes = streamingPlaylistActivityUrlToDBAttributes(videoUpdated, this.videoObject, videoUpdated.VideoFiles)
    const newStreamingPlaylists = streamingPlaylistAttributes.map(a => new VideoStreamingPlaylistModel(a))

    // Remove video playlists that do not exist anymore
    const destroyTasks = deleteNonExistingModels(videoUpdated.VideoStreamingPlaylists, newStreamingPlaylists, t)
    await Promise.all(destroyTasks)

    let oldStreamingPlaylistFiles: MVideoFile[] = []
    for (const videoStreamingPlaylist of videoUpdated.VideoStreamingPlaylists) {
      oldStreamingPlaylistFiles = oldStreamingPlaylistFiles.concat(videoStreamingPlaylist.VideoFiles)
    }

    videoUpdated.VideoStreamingPlaylists = []

    for (const playlistAttributes of streamingPlaylistAttributes) {
      const streamingPlaylistModel = await VideoStreamingPlaylistModel.upsert(playlistAttributes, { returning: true, transaction: t })
                                 .then(([ streamingPlaylist ]) => streamingPlaylist as MStreamingPlaylistFilesVideo)
      streamingPlaylistModel.Video = videoUpdated

      const newVideoFiles: MVideoFile[] = videoFileActivityUrlToDBAttributes(streamingPlaylistModel, playlistAttributes.tagAPObject)
        .map(a => new VideoFileModel(a))
      const destroyTasks = deleteNonExistingModels(oldStreamingPlaylistFiles, newVideoFiles, t)
      await Promise.all(destroyTasks)

      // Update or add other one
      const upsertTasks = newVideoFiles.map(f => VideoFileModel.customUpsert(f, 'streaming-playlist', t))
      streamingPlaylistModel.VideoFiles = await Promise.all(upsertTasks)

      videoUpdated.VideoStreamingPlaylists.push(streamingPlaylistModel)
    }
  }

  private async processTags (videoUpdated: MVideoFullLight, t: Transaction) {
    const tags = getTagsFromObject(this.videoObject)
    await setVideoTags({ video: videoUpdated, tags, transaction: t })
  }

  private async processTrackers (videoUpdated: MVideoFullLight, t: Transaction) {
    const trackers = getTrackerUrls(this.videoObject, videoUpdated)
    await setVideoTrackers({ video: videoUpdated, trackers, transaction: t })
  }

  private async processCaptions (videoUpdated: MVideoFullLight, t: Transaction) {
    // Update captions
    await VideoCaptionModel.deleteAllCaptionsOfRemoteVideo(videoUpdated.id, t)

    const videoCaptionsPromises = this.videoObject.subtitleLanguage.map(c => {
      const caption = new VideoCaptionModel({
        videoId: videoUpdated.id,
        filename: VideoCaptionModel.generateCaptionName(c.identifier),
        language: c.identifier,
        fileUrl: c.url
      }) as MVideoCaption

      return VideoCaptionModel.insertOrReplaceLanguage(caption, t)
    })

    await Promise.all(videoCaptionsPromises)
  }

  private async processLive (videoUpdated: MVideoFullLight, t: Transaction) {
    // Create or update existing live
    if (this.video.isLive) {
      const [ videoLive ] = await VideoLiveModel.upsert({
        saveReplay: this.videoObject.liveSaveReplay,
        permanentLive: this.videoObject.permanentLive,
        videoId: this.video.id
      }, { transaction: t, returning: true })

      videoUpdated.VideoLive = videoLive
      return
    }

    // Delete existing live if it exists
    await VideoLiveModel.destroy({
      where: {
        videoId: this.video.id
      },
      transaction: t
    })

    videoUpdated.VideoLive = null
  }

  private catchUpdateError (err: Error) {
    if (this.video !== undefined && this.videoFieldsSave !== undefined) {
      resetSequelizeInstance(this.video, this.videoFieldsSave)
    }

    // This is just a debug because we will retry the insert
    logger.debug('Cannot update the remote video.', { err })
    throw err
  }
}
