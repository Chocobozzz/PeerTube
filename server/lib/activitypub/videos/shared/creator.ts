
import { logger, loggerTagsFactory, LoggerTagsFn } from '@server/helpers/logger'
import { sequelizeTypescript } from '@server/initializers/database'
import { Hooks } from '@server/lib/plugins/hooks'
import { autoBlacklistVideoIfNeeded } from '@server/lib/video-blacklist'
import { VideoModel } from '@server/models/video/video'
import { MVideoFullLight, MVideoThumbnail } from '@server/types/models'
import { VideoObject } from '@shared/models'
import { APVideoAbstractBuilder } from './abstract-builder'
import { getVideoAttributesFromObject } from './object-to-model-attributes'

export class APVideoCreator extends APVideoAbstractBuilder {
  protected lTags: LoggerTagsFn

  constructor (protected readonly videoObject: VideoObject) {
    super()

    this.lTags = loggerTagsFactory('ap', 'video', 'create', this.videoObject.uuid, this.videoObject.id)
  }

  async create (waitThumbnail = false) {
    logger.debug('Adding remote video %s.', this.videoObject.id, this.lTags())

    const channelActor = await this.getOrCreateVideoChannelFromVideoObject()
    const channel = channelActor.VideoChannel

    const videoData = getVideoAttributesFromObject(channel, this.videoObject, this.videoObject.to)
    const video = VideoModel.build({ ...videoData, likes: 0, dislikes: 0 }) as MVideoThumbnail

    const { autoBlacklisted, videoCreated } = await sequelizeTypescript.transaction(async t => {
      const videoCreated = await video.save({ transaction: t }) as MVideoFullLight
      videoCreated.VideoChannel = channel

      await this.setThumbnail(videoCreated, t)
      await this.setPreview(videoCreated, t)
      await this.setWebTorrentFiles(videoCreated, t)
      await this.setStreamingPlaylists(videoCreated, t)
      await this.setTags(videoCreated, t)
      await this.setTrackers(videoCreated, t)
      await this.insertOrReplaceCaptions(videoCreated, t)
      await this.insertOrReplaceLive(videoCreated, t)
      await this.insertOrReplaceStoryboard(videoCreated, t)

      // We added a video in this channel, set it as updated
      await channel.setAsUpdated(t)

      const autoBlacklisted = await autoBlacklistVideoIfNeeded({
        video: videoCreated,
        user: undefined,
        isRemote: true,
        isNew: true,
        transaction: t
      })

      logger.info('Remote video with uuid %s inserted.', this.videoObject.uuid, this.lTags())

      Hooks.runAction('action:activity-pub.remote-video.created', { video: videoCreated, videoAPObject: this.videoObject })

      return { autoBlacklisted, videoCreated }
    })

    return { autoBlacklisted, videoCreated }
  }
}
