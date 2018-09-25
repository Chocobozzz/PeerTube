import { AbstractScheduler } from './abstract-scheduler'
import { CONFIG, JOB_TTL, REDUNDANCY } from '../../initializers'
import { logger } from '../../helpers/logger'
import { VideosRedundancy } from '../../../shared/models/redundancy'
import { VideoRedundancyModel } from '../../models/redundancy/video-redundancy'
import { VideoFileModel } from '../../models/video/video-file'
import { downloadWebTorrentVideo } from '../../helpers/webtorrent'
import { join } from 'path'
import { rename } from 'fs-extra'
import { getServerActor } from '../../helpers/utils'
import { sendCreateCacheFile, sendUpdateCacheFile } from '../activitypub/send'
import { VideoModel } from '../../models/video/video'
import { getVideoCacheFileActivityPubUrl } from '../activitypub/url'
import { removeVideoRedundancy } from '../redundancy'

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
      logger.info('Running redundancy scheduler for strategy %s.', obj.strategy)

      try {
        const videoToDuplicate = await this.findVideoToDuplicate(obj)
        if (!videoToDuplicate) continue

        const videoFiles = videoToDuplicate.VideoFiles
        videoFiles.forEach(f => f.Video = videoToDuplicate)

        await this.purgeCacheIfNeeded(obj, videoFiles)

        if (await this.isTooHeavy(obj, videoFiles)) {
          logger.info('Video %s is too big for our cache, skipping.', videoToDuplicate.url)
          continue
        }

        logger.info('Will duplicate video %s in redundancy scheduler "%s".', videoToDuplicate.url, obj.strategy)

        await this.createVideoRedundancy(obj, videoFiles)
      } catch (err) {
        logger.error('Cannot run videos redundancy %s.', obj.strategy, { err })
      }
    }

    await this.extendsLocalExpiration()

    await this.purgeRemoteExpired()

    this.executing = false
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }

  private async extendsLocalExpiration () {
    const expired = await VideoRedundancyModel.listLocalExpired()

    for (const redundancyModel of expired) {
      try {
        const redundancy = CONFIG.REDUNDANCY.VIDEOS.STRATEGIES.find(s => s.strategy === redundancyModel.strategy)
        await this.extendsExpirationOf(redundancyModel, redundancy.minLifetime)
      } catch (err) {
        logger.error('Cannot extend expiration of %s video from our redundancy system.', this.buildEntryLogId(redundancyModel))
      }
    }
  }

  private async purgeRemoteExpired () {
    const expired = await VideoRedundancyModel.listRemoteExpired()

    for (const redundancyModel of expired) {
      try {
        await removeVideoRedundancy(redundancyModel)
      } catch (err) {
        logger.error('Cannot remove redundancy %s from our redundancy system.', this.buildEntryLogId(redundancyModel))
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

  private async createVideoRedundancy (redundancy: VideosRedundancy, filesToDuplicate: VideoFileModel[]) {
    const serverActor = await getServerActor()

    for (const file of filesToDuplicate) {
      const existing = await VideoRedundancyModel.loadByFileId(file.id)
      if (existing) {
        await this.extendsExpirationOf(existing, redundancy.minLifetime)

        continue
      }

      // We need more attributes and check if the video still exists
      const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(file.Video.id)
      if (!video) continue

      logger.info('Duplicating %s - %d in videos redundancy with "%s" strategy.', video.url, file.resolution, redundancy.strategy)

      const { baseUrlHttp, baseUrlWs } = video.getBaseUrls()
      const magnetUri = video.generateMagnetUri(file, baseUrlHttp, baseUrlWs)

      const tmpPath = await downloadWebTorrentVideo({ magnetUri }, JOB_TTL['video-import'])

      const destPath = join(CONFIG.STORAGE.VIDEOS_DIR, video.getVideoFilename(file))
      await rename(tmpPath, destPath)

      const createdModel = await VideoRedundancyModel.create({
        expiresOn: this.buildNewExpiration(redundancy.minLifetime),
        url: getVideoCacheFileActivityPubUrl(file),
        fileUrl: video.getVideoFileUrl(file, CONFIG.WEBSERVER.URL),
        strategy: redundancy.strategy,
        videoFileId: file.id,
        actorId: serverActor.id
      })
      createdModel.VideoFile = file

      await sendCreateCacheFile(serverActor, createdModel)
    }
  }

  private async extendsExpirationOf (redundancy: VideoRedundancyModel, expiresAfterMs: number) {
    logger.info('Extending expiration of %s.', redundancy.url)

    const serverActor = await getServerActor()

    redundancy.expiresOn = this.buildNewExpiration(expiresAfterMs)
    await redundancy.save()

    await sendUpdateCacheFile(serverActor, redundancy)
  }

  private async purgeCacheIfNeeded (redundancy: VideosRedundancy, filesToDuplicate: VideoFileModel[]) {
    while (this.isTooHeavy(redundancy, filesToDuplicate)) {
      const toDelete = await VideoRedundancyModel.loadOldestLocalThatAlreadyExpired(redundancy.strategy, redundancy.minLifetime)
      if (!toDelete) return

      await removeVideoRedundancy(toDelete)
    }
  }

  private async isTooHeavy (redundancy: VideosRedundancy, filesToDuplicate: VideoFileModel[]) {
    const maxSize = redundancy.size - this.getTotalFileSizes(filesToDuplicate)

    const totalDuplicated = await VideoRedundancyModel.getTotalDuplicated(redundancy.strategy)

    return totalDuplicated > maxSize
  }

  private buildNewExpiration (expiresAfterMs: number) {
    return new Date(Date.now() + expiresAfterMs)
  }

  private buildEntryLogId (object: VideoRedundancyModel) {
    return `${object.VideoFile.Video.url}-${object.VideoFile.resolution}`
  }

  private getTotalFileSizes (files: VideoFileModel[]) {
    const fileReducer = (previous: number, current: VideoFileModel) => previous + current.size

    return files.reduce(fileReducer, 0)
  }
}
