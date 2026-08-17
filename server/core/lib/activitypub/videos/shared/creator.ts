import { VideoObject } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { autoBlacklistVideoIfNeeded } from '@server/lib/video-blacklist.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideoFull, MVideoThumbnails } from '@server/types/models/index.js'
import { APVideoAbstractBuilder } from './abstract-builder.js'
import { getVideoAttributesFromObject } from './object-to-model-attributes.js'

const logger = createLogger('ap', 'video', 'create')

export class APVideoCreator extends APVideoAbstractBuilder {
  constructor (protected readonly videoObject: VideoObject) {
    super()
  }

  create () {
    return logger.withContext([ this.videoObject.uuid, this.videoObject.id ], () => this.runCreate())
  }

  private async runCreate () {
    logger.debug('Adding remote video %s.', this.videoObject.id, { ...this.videoObject })

    const channelActor = await this.getOrCreateVideoChannelFromVideoObject()
    const channel = channelActor.VideoChannel
    channel.Actor = channelActor

    const videoData = getVideoAttributesFromObject(channel, this.videoObject, this.videoObject.to)
    const video = VideoModel.build({ ...videoData, likes: 0, dislikes: 0 }) as MVideoThumbnails

    const { autoBlacklisted, videoCreated } = await sequelizeTypescript.transaction(async t => {
      const videoCreated = await video.save({ transaction: t }) as MVideoFull
      videoCreated.VideoChannel = channel

      await this.setThumbnails(videoCreated, t)
      await this.setWebVideoFiles(videoCreated, t)
      await this.setStreamingPlaylists(videoCreated, t)
      await this.setTags(videoCreated, t)
      await this.setTrackers(videoCreated, t)
      await this.insertOrReplaceCaptions(videoCreated, t)
      await this.insertOrReplaceLive(videoCreated, t)
      await this.insertOrReplaceStoryboard(videoCreated, t)

      const automaticTagsByAccount = await this.setAutomaticTags({ video: videoCreated, transaction: t })

      // We added a video in this channel, set it as updated
      await channel.setAsUpdated(t)

      const autoBlacklisted = await autoBlacklistVideoIfNeeded({
        video: videoCreated,
        automaticTagsByAccount,
        user: undefined,
        isRemote: true,
        isNew: true,
        isNewFile: true,
        transaction: t
      })

      logger.info('Remote video with uuid %s inserted.', this.videoObject.uuid)

      Hooks.runAction('action:activity-pub.remote-video.created', { video: videoCreated, videoAPObject: this.videoObject })

      return { autoBlacklisted, videoCreated }
    })

    await this.updateChapters(videoCreated)
    await this.upsertPlayerSettings(videoCreated)

    return { autoBlacklisted, videoCreated }
  }
}
