
import { logger, loggerTagsFactory, LoggerTagsFn } from '@server/helpers/logger'
import { sequelizeTypescript } from '@server/initializers/database'
import { autoBlacklistVideoIfNeeded } from '@server/lib/video-blacklist'
import { VideoModel } from '@server/models/video/video'
import { MThumbnail, MVideoFullLight, MVideoThumbnail } from '@server/types/models'
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
    const video = VideoModel.build(videoData) as MVideoThumbnail

    const promiseThumbnail = this.tryToGenerateThumbnail(video)

    let thumbnailModel: MThumbnail
    if (waitThumbnail === true) {
      thumbnailModel = await promiseThumbnail
    }

    const { autoBlacklisted, videoCreated } = await sequelizeTypescript.transaction(async t => {
      try {
        const videoCreated = await video.save({ transaction: t }) as MVideoFullLight
        videoCreated.VideoChannel = channel

        if (thumbnailModel) await videoCreated.addAndSaveThumbnail(thumbnailModel, t)

        await this.setPreview(videoCreated, t)
        await this.setWebTorrentFiles(videoCreated, t)
        await this.setStreamingPlaylists(videoCreated, t)
        await this.setTags(videoCreated, t)
        await this.setTrackers(videoCreated, t)
        await this.insertOrReplaceCaptions(videoCreated, t)
        await this.insertOrReplaceLive(videoCreated, t)

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

        return { autoBlacklisted, videoCreated }
      } catch (err) {
        // FIXME: Use rollback hook when https://github.com/sequelize/sequelize/pull/13038 is released
        // Remove thumbnail
        if (thumbnailModel) await thumbnailModel.removeThumbnail()

        throw err
      }
    })

    if (waitThumbnail === false) {
      // Error is already caught above
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      promiseThumbnail.then(thumbnailModel => {
        if (!thumbnailModel) return

        thumbnailModel = videoCreated.id

        return thumbnailModel.save()
      })
    }

    return { autoBlacklisted, videoCreated }
  }
}
