import { VideoObject } from '@peertube/peertube-models'
import { logger, loggerTagsFactory, LoggerTagsFn } from '@server/helpers/logger.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { autoBlacklistVideoIfNeeded } from '@server/lib/video-blacklist.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideoFullLight, MVideoThumbnail } from '@server/types/models/index.js'
import { APVideoAbstractBuilder } from './abstract-builder.js'
import { getVideoAttributesFromObject } from './object-to-model-attributes.js'

export class APVideoCreator extends APVideoAbstractBuilder {
  protected lTags: LoggerTagsFn

  constructor (protected readonly videoObject: VideoObject) {
    super()

    this.lTags = loggerTagsFactory('ap', 'video', 'create', this.videoObject.uuid, this.videoObject.id)
  }

  async create () {
    logger.debug('Adding remote video %s.', this.videoObject.id, this.lTags())

    const channelActor = await this.getOrCreateVideoChannelFromVideoObject()
    const channel = channelActor.VideoChannel
    channel.Actor = channelActor

    const videoData = getVideoAttributesFromObject(channel, this.videoObject, this.videoObject.to)
    const video = VideoModel.build({ ...videoData, likes: 0, dislikes: 0 }) as MVideoThumbnail

    const { autoBlacklisted, videoCreated } = await sequelizeTypescript.transaction(async t => {
      const videoCreated = await video.save({ transaction: t }) as MVideoFullLight
      videoCreated.VideoChannel = channel

      await this.setThumbnail(videoCreated, t)
      await this.setPreview(videoCreated, t)
      await this.setWebVideoFiles(videoCreated, t)
      await this.setStreamingPlaylists(videoCreated, t)
      await this.setTags(videoCreated, t)
      await this.setTrackers(videoCreated, t)
      await this.insertOrReplaceCaptions(videoCreated, t)
      await this.insertOrReplaceLive(videoCreated, t)
      await this.insertOrReplaceStoryboard(videoCreated, t)

      await this.setAutomaticTags({ video: videoCreated, transaction: t })

      // We added a video in this channel, set it as updated
      await channel.setAsUpdated(t)

      const autoBlacklisted = await autoBlacklistVideoIfNeeded({
        video: videoCreated,
        user: undefined,
        isRemote: true,
        isNew: true,
        isNewFile: true,
        transaction: t
      })

      logger.info('Remote video with uuid %s inserted.', this.videoObject.uuid, this.lTags())

      Hooks.runAction('action:activity-pub.remote-video.created', { video: videoCreated, videoAPObject: this.videoObject })

      return { autoBlacklisted, videoCreated }
    })

    await this.updateChaptersOutsideTransaction(videoCreated)

    return { autoBlacklisted, videoCreated }
  }
}
