import { Transaction } from 'sequelize/types'
import { resetSequelizeInstance } from '@server/helpers/database-utils'
import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { sequelizeTypescript } from '@server/initializers/database'
import { Notifier } from '@server/lib/notifier'
import { PeerTubeSocket } from '@server/lib/peertube-socket'
import { autoBlacklistVideoIfNeeded } from '@server/lib/video-blacklist'
import { VideoCaptionModel } from '@server/models/video/video-caption'
import { VideoLiveModel } from '@server/models/video/video-live'
import { MActor, MChannelAccountLight, MChannelId, MVideoAccountLightBlacklistAllFiles, MVideoFullLight } from '@server/types/models'
import { VideoObject, VideoPrivacy } from '@shared/models'
import { APVideoAbstractBuilder, getVideoAttributesFromObject } from './shared'

export class APVideoUpdater extends APVideoAbstractBuilder {
  private readonly wasPrivateVideo: boolean
  private readonly wasUnlistedVideo: boolean

  private readonly videoFieldsSave: any

  private readonly oldVideoChannel: MChannelAccountLight

  protected lTags = loggerTagsFactory('ap', 'video', 'update')

  constructor (
    protected readonly videoObject: VideoObject,
    private readonly video: MVideoAccountLightBlacklistAllFiles
  ) {
    super()

    this.wasPrivateVideo = this.video.privacy === VideoPrivacy.PRIVATE
    this.wasUnlistedVideo = this.video.privacy === VideoPrivacy.UNLISTED

    this.oldVideoChannel = this.video.VideoChannel

    this.videoFieldsSave = this.video.toJSON()
  }

  async update (overrideTo?: string[]) {
    logger.debug(
      'Updating remote video "%s".', this.videoObject.uuid,
      { videoObject: this.videoObject, ...this.lTags(this.videoObject.uuid) }
    )

    try {
      const channelActor = await this.getOrCreateVideoChannelFromVideoObject()

      const thumbnailModel = await this.tryToGenerateThumbnail(this.video)

      const videoUpdated = await sequelizeTypescript.transaction(async t => {
        this.checkChannelUpdateOrThrow(channelActor)

        const videoUpdated = await this.updateVideo(channelActor.VideoChannel, t, overrideTo)

        if (thumbnailModel) await videoUpdated.addAndSaveThumbnail(thumbnailModel, t)

        await this.setPreview(videoUpdated, t)
        await this.setWebTorrentFiles(videoUpdated, t)
        await this.setStreamingPlaylists(videoUpdated, t)
        await this.setTags(videoUpdated, t)
        await this.setTrackers(videoUpdated, t)
        await this.setCaptions(videoUpdated, t)
        await this.setOrDeleteLive(videoUpdated, t)

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

      logger.info('Remote video with uuid %s updated', this.videoObject.uuid, this.lTags(this.videoObject.uuid))

      return videoUpdated
    } catch (err) {
      this.catchUpdateError(err)
    }
  }

  // Check we can update the channel: we trust the remote server
  private checkChannelUpdateOrThrow (newChannelActor: MActor) {
    if (!this.oldVideoChannel.Actor.serverId || !newChannelActor.serverId) {
      throw new Error('Cannot check old channel/new channel validity because `serverId` is null')
    }

    if (this.oldVideoChannel.Actor.serverId !== newChannelActor.serverId) {
      throw new Error(`New channel ${newChannelActor.url} is not on the same server than new channel ${this.oldVideoChannel.Actor.url}`)
    }
  }

  private updateVideo (channel: MChannelId, transaction: Transaction, overrideTo?: string[]) {
    const to = overrideTo || this.videoObject.to
    const videoData = getVideoAttributesFromObject(channel, this.videoObject, to)
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

    // Ensures we update the updatedAt attribute, even if main attributes did not change
    this.video.changed('updatedAt', true)

    return this.video.save({ transaction }) as Promise<MVideoFullLight>
  }

  private async setCaptions (videoUpdated: MVideoFullLight, t: Transaction) {
    await VideoCaptionModel.deleteAllCaptionsOfRemoteVideo(videoUpdated.id, t)

    await this.insertOrReplaceCaptions(videoUpdated, t)
  }

  private async setOrDeleteLive (videoUpdated: MVideoFullLight, transaction: Transaction) {
    if (this.video.isLive) return this.insertOrReplaceLive(videoUpdated, transaction)

    // Delete existing live if it exists
    await VideoLiveModel.destroy({
      where: {
        videoId: this.video.id
      },
      transaction
    })

    videoUpdated.VideoLive = null
  }

  private catchUpdateError (err: Error) {
    if (this.video !== undefined && this.videoFieldsSave !== undefined) {
      resetSequelizeInstance(this.video, this.videoFieldsSave)
    }

    // This is just a debug because we will retry the insert
    logger.debug('Cannot update the remote video.', { err, ...this.lTags(this.videoObject.uuid) })
    throw err
  }
}
