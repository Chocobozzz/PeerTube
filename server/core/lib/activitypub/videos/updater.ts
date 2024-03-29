import { Transaction } from 'sequelize'
import { VideoObject, VideoPrivacy } from '@peertube/peertube-models'
import { resetSequelizeInstance, runInReadCommittedTransaction } from '@server/helpers/database-utils.js'
import { logger, loggerTagsFactory, LoggerTagsFn } from '@server/helpers/logger.js'
import { Notifier } from '@server/lib/notifier/index.js'
import { PeerTubeSocket } from '@server/lib/peertube-socket.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { autoBlacklistVideoIfNeeded } from '@server/lib/video-blacklist.js'
import { VideoLiveModel } from '@server/models/video/video-live.js'
import {
  MActor,
  MChannelAccountLight,
  MChannelId,
  MVideoAccountLightBlacklistAllFiles,
  MVideoFullLight
} from '@server/types/models/index.js'
import { APVideoAbstractBuilder, getVideoAttributesFromObject, updateVideoRates } from './shared/index.js'

export class APVideoUpdater extends APVideoAbstractBuilder {
  private readonly wasPrivateVideo: boolean
  private readonly wasUnlistedVideo: boolean

  private readonly oldVideoChannel: MChannelAccountLight

  protected lTags: LoggerTagsFn

  constructor (
    protected readonly videoObject: VideoObject,
    private readonly video: MVideoAccountLightBlacklistAllFiles
  ) {
    super()

    this.wasPrivateVideo = this.video.privacy === VideoPrivacy.PRIVATE
    this.wasUnlistedVideo = this.video.privacy === VideoPrivacy.UNLISTED

    this.oldVideoChannel = this.video.VideoChannel

    this.lTags = loggerTagsFactory('ap', 'video', 'update', video.uuid, video.url)
  }

  async update (overrideTo?: string[]) {
    logger.debug(
      'Updating remote video "%s".', this.videoObject.uuid,
      { videoObject: this.videoObject, ...this.lTags() }
    )

    const oldInputFileUpdatedAt = this.video.inputFileUpdatedAt

    try {
      const channelActor = await this.getOrCreateVideoChannelFromVideoObject()

      this.checkChannelUpdateOrThrow(channelActor)

      const oldState = this.video.state
      const oldVideo = { name: this.video.name, description: this.video.description }

      const videoUpdated = await this.updateVideo(channelActor.VideoChannel, undefined, overrideTo)

      await runInReadCommittedTransaction(async t => {
        await this.setWebVideoFiles(videoUpdated, t)
        await this.setStreamingPlaylists(videoUpdated, t)
      })

      await Promise.all([
        runInReadCommittedTransaction(t => this.setTags(videoUpdated, t)),
        runInReadCommittedTransaction(t => this.setTrackers(videoUpdated, t)),
        runInReadCommittedTransaction(t => this.setStoryboard(videoUpdated, t)),
        runInReadCommittedTransaction(t => this.setAutomaticTags({ video: videoUpdated, transaction: t, oldVideo })),
        runInReadCommittedTransaction(t => {
          return Promise.all([
            this.setPreview(videoUpdated, t),
            this.setThumbnail(videoUpdated, t)
          ])
        }),
        this.setOrDeleteLive(videoUpdated)
      ])

      await runInReadCommittedTransaction(t => this.setCaptions(videoUpdated, t))

      await this.updateChaptersOutsideTransaction(videoUpdated)

      await autoBlacklistVideoIfNeeded({
        video: videoUpdated,
        user: undefined,
        isRemote: true,
        isNew: false,
        isNewFile: oldInputFileUpdatedAt !== videoUpdated.inputFileUpdatedAt,
        transaction: undefined
      })

      await updateVideoRates(videoUpdated, this.videoObject)

      // Notify our users?
      if (this.wasPrivateVideo || this.wasUnlistedVideo) {
        Notifier.Instance.notifyOnNewVideoOrLiveIfNeeded(videoUpdated)
      }

      if (videoUpdated.isLive && oldState !== videoUpdated.state) {
        PeerTubeSocket.Instance.sendVideoLiveNewState(videoUpdated)
        Notifier.Instance.notifyOnNewVideoOrLiveIfNeeded(videoUpdated)
      }

      Hooks.runAction('action:activity-pub.remote-video.updated', { video: videoUpdated, videoAPObject: this.videoObject })

      logger.info('Remote video with uuid %s updated', this.videoObject.uuid, this.lTags())

      return videoUpdated
    } catch (err) {
      await this.catchUpdateError(err)
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

  private updateVideo (channel: MChannelId, transaction?: Transaction, overrideTo?: string[]) {
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
    this.video.commentsPolicy = videoData.commentsPolicy
    this.video.downloadEnabled = videoData.downloadEnabled
    this.video.waitTranscoding = videoData.waitTranscoding
    this.video.state = videoData.state
    this.video.duration = videoData.duration
    this.video.createdAt = videoData.createdAt
    this.video.publishedAt = videoData.publishedAt
    this.video.originallyPublishedAt = videoData.originallyPublishedAt
    this.video.inputFileUpdatedAt = videoData.inputFileUpdatedAt
    this.video.privacy = videoData.privacy
    this.video.channelId = videoData.channelId
    this.video.views = videoData.views
    this.video.isLive = videoData.isLive
    this.video.aspectRatio = videoData.aspectRatio

    // Ensures we update the updatedAt attribute, even if main attributes did not change
    this.video.changed('updatedAt', true)

    return this.video.save({ transaction }) as Promise<MVideoFullLight>
  }

  private async setCaptions (videoUpdated: MVideoFullLight, t: Transaction) {
    await this.insertOrReplaceCaptions(videoUpdated, t)
  }

  private async setStoryboard (videoUpdated: MVideoFullLight, t: Transaction) {
    await this.insertOrReplaceStoryboard(videoUpdated, t)
  }

  private async setOrDeleteLive (videoUpdated: MVideoFullLight, transaction?: Transaction) {
    if (!this.video.isLive) return

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

  private async catchUpdateError (err: Error) {
    if (this.video !== undefined) {
      await resetSequelizeInstance(this.video)
    }

    // This is just a debug because we will retry the insert
    logger.debug('Cannot update the remote video.', { err, ...this.lTags() })
    throw err
  }
}
