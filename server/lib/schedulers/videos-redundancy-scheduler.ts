import { AbstractScheduler } from './abstract-scheduler'
import { CONFIG, JOB_TTL, REDUNDANCY, SCHEDULER_INTERVALS_MS } from '../../initializers'
import { logger } from '../../helpers/logger'
import { VideoRedundancyStrategy, VideosRedundancy } from '../../../shared/models/redundancy'
import { VideoRedundancyModel } from '../../models/redundancy/video-redundancy'
import { VideoFileModel } from '../../models/video/video-file'
import { downloadWebTorrentVideo } from '../../helpers/webtorrent'
import { join } from 'path'
import { rename } from 'fs-extra'
import { getServerActor } from '../../helpers/utils'
import { sendCreateCacheFile, sendUpdateCacheFile } from '../activitypub/send'
import { VideoModel } from '../../models/video/video'
import { getVideoCacheFileActivityPubUrl } from '../activitypub/url'
import { isTestInstance } from '../../helpers/core-utils'

export class VideosRedundancyScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler
  private executing = false

  protected schedulerIntervalMs = CONFIG.REDUNDANCY.VIDEOS.CHECK_INTERVAL

  private constructor () {
    super()
  }

  async execute () {
    if (this.executing) return

    this.executing = true

    for (const obj of CONFIG.REDUNDANCY.VIDEOS.STRATEGIES) {
      if (!isTestInstance()) logger.info('Running redundancy scheduler for strategy %s.', obj.strategy)

      try {
        const videoToDuplicate = await this.findVideoToDuplicate(obj)
        if (!videoToDuplicate) continue

        const videoFiles = videoToDuplicate.VideoFiles
        videoFiles.forEach(f => f.Video = videoToDuplicate)

        if (await this.isTooHeavy(obj.strategy, videoFiles, obj.size)) {
          if (!isTestInstance()) logger.info('Video %s is too big for our cache, skipping.', videoToDuplicate.url)
          continue
        }

        logger.info('Will duplicate video %s in redundancy scheduler "%s".', videoToDuplicate.url, obj.strategy)

        await this.createVideoRedundancy(obj.strategy, videoFiles)
      } catch (err) {
        logger.error('Cannot run videos redundancy %s.', obj.strategy, { err })
      }
    }

    await this.removeExpired()

    this.executing = false
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }

  private async removeExpired () {
    const expired = await VideoRedundancyModel.listAllExpired()

    for (const m of expired) {
      logger.info('Removing expired video %s from our redundancy system.', this.buildEntryLogId(m))

      try {
        await m.destroy()
      } catch (err) {
        logger.error('Cannot remove %s video from our redundancy system.', this.buildEntryLogId(m))
      }
    }
  }

  private findVideoToDuplicate (cache: VideosRedundancy) {
    if (cache.strategy === 'most-views') {
      return VideoRedundancyModel.findMostViewToDuplicate(REDUNDANCY.VIDEOS.RANDOMIZED_FACTOR)
    }

    if (cache.strategy === 'trending') {
      return VideoRedundancyModel.findTrendingToDuplicate(REDUNDANCY.VIDEOS.RANDOMIZED_FACTOR)
    }

    if (cache.strategy === 'recently-added') {
      const minViews = cache.minViews
      return VideoRedundancyModel.findRecentlyAddedToDuplicate(REDUNDANCY.VIDEOS.RANDOMIZED_FACTOR, minViews)
    }
  }

  private async createVideoRedundancy (strategy: VideoRedundancyStrategy, filesToDuplicate: VideoFileModel[]) {
    const serverActor = await getServerActor()

    for (const file of filesToDuplicate) {
      const existing = await VideoRedundancyModel.loadByFileId(file.id)
      if (existing) {
        logger.info('Duplicating %s - %d in videos redundancy with "%s" strategy.', file.Video.url, file.resolution, strategy)

        existing.expiresOn = this.buildNewExpiration()
        await existing.save()

        await sendUpdateCacheFile(serverActor, existing)
        continue
      }

      // We need more attributes and check if the video still exists
      const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(file.Video.id)
      if (!video) continue

      logger.info('Duplicating %s - %d in videos redundancy with "%s" strategy.', video.url, file.resolution, strategy)

      const { baseUrlHttp, baseUrlWs } = video.getBaseUrls()
      const magnetUri = video.generateMagnetUri(file, baseUrlHttp, baseUrlWs)

      const tmpPath = await downloadWebTorrentVideo({ magnetUri }, JOB_TTL['video-import'])

      const destPath = join(CONFIG.STORAGE.VIDEOS_DIR, video.getVideoFilename(file))
      await rename(tmpPath, destPath)

      const createdModel = await VideoRedundancyModel.create({
        expiresOn: new Date(Date.now() + REDUNDANCY.VIDEOS.EXPIRES_AFTER_MS),
        url: getVideoCacheFileActivityPubUrl(file),
        fileUrl: video.getVideoFileUrl(file, CONFIG.WEBSERVER.URL),
        strategy,
        videoFileId: file.id,
        actorId: serverActor.id
      })
      createdModel.VideoFile = file

      await sendCreateCacheFile(serverActor, createdModel)
    }
  }

  private async isTooHeavy (strategy: VideoRedundancyStrategy, filesToDuplicate: VideoFileModel[], maxSizeArg: number) {
    const maxSize = maxSizeArg - this.getTotalFileSizes(filesToDuplicate)

    const totalDuplicated = await VideoRedundancyModel.getTotalDuplicated(strategy)

    return totalDuplicated > maxSize
  }

  private buildNewExpiration () {
    return new Date(Date.now() + REDUNDANCY.VIDEOS.EXPIRES_AFTER_MS)
  }

  private buildEntryLogId (object: VideoRedundancyModel) {
    return `${object.VideoFile.Video.url}-${object.VideoFile.resolution}`
  }

  private getTotalFileSizes (files: VideoFileModel[]) {
    const fileReducer = (previous: number, current: VideoFileModel) => previous + current.size

    return files.reduce(fileReducer, 0)
  }
}
