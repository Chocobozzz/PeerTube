import { VideoObject, VideoPrivacy } from '@peertube/peertube-models'
import { resetSequelizeInstance, runInReadCommittedTransaction } from '@server/helpers/database-utils.js'
import { createLogger } from '@server/helpers/logger.js'
import { createVideoAutomaticTagsJob } from '@server/lib/automatic-tags/automatic-tags.js'
import { Notifier } from '@server/lib/notifier/index.js'
import { PeerTubeSocket } from '@server/lib/peertube-socket.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { autoBlacklistVideoIfNeeded } from '@server/lib/video-blacklist.js'
import { VideoLiveModel } from '@server/models/video/video-live.js'
import {
  MActorHost,
  MChannelAccountLight,
  MChannelId,
  MVideoAccountLightBlacklistAllFiles,
  MVideoFull
} from '@server/types/models/index.js'
import { Transaction } from 'sequelize'
import { haveActorsSameRemoteHost } from '../actors/check-actor.js'
import { checkUrlsSameHost } from '../url.js'
import { APVideoAbstractBuilder, getVideoAttributesFromObject, updateVideoRates } from './shared/index.js'

const logger = createLogger('ap', 'video', 'update')

export class APVideoUpdater extends APVideoAbstractBuilder {
  private readonly wasPrivateVideo: boolean
  private readonly wasUnlistedVideo: boolean

  private readonly oldVideoChannel: MChannelAccountLight

  constructor (
    protected readonly videoObject: VideoObject,
    private readonly video: MVideoAccountLightBlacklistAllFiles,
    private readonly contextUrl: string
  ) {
    super()

    this.wasPrivateVideo = this.video.privacy === VideoPrivacy.PRIVATE
    this.wasUnlistedVideo = this.video.privacy === VideoPrivacy.UNLISTED

    this.oldVideoChannel = this.video.VideoChannel
  }

  async update (options: {
    overrideTo?: string[]
    isLatestStateFromOrigin?: boolean
  } = {}) {
    return logger.withContext([ this.video.uuid, this.video.url ], () => this.runUpdate(options))
  }

  private async runUpdate (options: {
    overrideTo?: string[]
    isLatestStateFromOrigin?: boolean
  }) {
    const { overrideTo, isLatestStateFromOrigin = false } = options

    logger.debug(
      'Updating remote video "%s".',
      this.videoObject.uuid,
      { videoObject: this.videoObject }
    )

    if (!checkUrlsSameHost(this.contextUrl, this.videoObject.id)) {
      logger.warn('Video sent by update is not from the same host as the context URL.', {
        videoObject: this.videoObject,
        contextUrl: this.contextUrl
      })
      return undefined
    }

    // Use `<` date comparison because origin may send multiple activities with the same updated attribute
    // PeerTube doesn't update the `updatedAt` video attribute on some updates (e.g., likes count)
    if (!isLatestStateFromOrigin && this.video.remoteUpdatedAt && new Date(this.videoObject.updated) < this.video.remoteUpdatedAt) {
      logger.info(
        'Skip update of remote video %s with an object older than the stored one.',
        this.videoObject.id,
        { updated: this.videoObject.updated, remoteUpdatedAt: this.video.remoteUpdatedAt }
      )

      return undefined
    }

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
        runInReadCommittedTransaction(t => this.setThumbnails(videoUpdated, t)),
        this.setOrDeleteLive(videoUpdated)
      ])

      const rebuildAutomaticTags = this.automaticTagsNeedRebuild({ video: videoUpdated, oldVideo })

      await runInReadCommittedTransaction(t => this.setCaptions(videoUpdated, t))

      await this.updateChapters(videoUpdated)
      await this.upsertPlayerSettings(videoUpdated)

      await autoBlacklistVideoIfNeeded({
        video: videoUpdated,
        // Already published: don't hold it while its automatic tags are rebuilt
        holdIfAutoTagPolicy: false,
        user: undefined,
        isRemote: true,
        isNew: false,
        isNewFile: oldInputFileUpdatedAt !== videoUpdated.inputFileUpdatedAt,
        transaction: undefined
      })

      if (rebuildAutomaticTags) {
        createVideoAutomaticTagsJob({ video: videoUpdated, moderation: 'apply' })
      }

      await updateVideoRates(videoUpdated, this.videoObject)

      // Notify our users?
      if (videoUpdated.isLive && oldState !== videoUpdated.state) {
        PeerTubeSocket.Instance.sendVideoLiveNewState(videoUpdated)
        Notifier.Instance.notifyOnNewVideoOrLiveIfNeeded(videoUpdated)
      } else if (this.wasPrivateVideo || this.wasUnlistedVideo) {
        Notifier.Instance.notifyOnNewVideoOrLiveIfNeeded(videoUpdated)
      }

      Hooks.runAction('action:activity-pub.remote-video.updated', { video: videoUpdated, videoAPObject: this.videoObject })

      logger.info('Remote video with uuid %s updated', this.videoObject.uuid)

      return videoUpdated
    } catch (err) {
      await this.catchUpdateError(err)
    }
  }

  // Check we can update the channel: we trust the remote server
  private checkChannelUpdateOrThrow (newChannelActor: MActorHost) {
    if (haveActorsSameRemoteHost(this.oldVideoChannel.Actor, newChannelActor) !== true) {
      throw new Error(`Actor ${this.oldVideoChannel.Actor.url} is not on the same host as ${newChannelActor.url}`)
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
    this.video.nsfwSummary = videoData.nsfwSummary
    this.video.nsfwFlags = videoData.nsfwFlags
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
    this.video.downloads = videoData.downloads
    this.video.isLive = videoData.isLive
    this.video.aspectRatio = videoData.aspectRatio
    this.video.embedPrivacyPolicy = videoData.embedPrivacyPolicy
    this.video.remoteUpdatedAt = videoData.remoteUpdatedAt

    // Ensures we update the updatedAt attribute, even if main attributes did not change
    this.video.changed('updatedAt', true)

    return this.video.save({ transaction }) as Promise<MVideoFull>
  }

  private async setCaptions (videoUpdated: MVideoFull, t: Transaction) {
    await this.insertOrReplaceCaptions(videoUpdated, t)
  }

  private async setStoryboard (videoUpdated: MVideoFull, t: Transaction) {
    await this.insertOrReplaceStoryboard(videoUpdated, t)
  }

  private async setOrDeleteLive (videoUpdated: MVideoFull, transaction?: Transaction) {
    if (this.video.isLive) {
      return this.insertOrReplaceLive(videoUpdated, transaction)
    }

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
    logger.debug('Cannot update the remote video.', { err })
    throw err
  }
}
