import { AbstractScheduler } from './abstract-scheduler'
import { CONFIG, REDUNDANCY, VIDEO_IMPORT_TIMEOUT } from '../../initializers'
import { logger } from '../../helpers/logger'
import { VideosRedundancy } from '../../../shared/models/redundancy'
import { VideoRedundancyModel } from '../../models/redundancy/video-redundancy'
import { VideoFileModel } from '../../models/video/video-file'
import { downloadWebTorrentVideo } from '../../helpers/webtorrent'
import { join } from 'path'
import { rename } from 'fs-extra'
import { getServerActor } from '../../helpers/utils'
import { sendCreateCacheFile, sendUpdateCacheFile } from '../activitypub/send'
import { getVideoCacheFileActivityPubUrl } from '../activitypub/url'
import { removeVideoRedundancy } from '../redundancy'
import { getOrCreateVideoAndAccountAndChannel } from '../activitypub'

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
        await this.extendsOrDeleteRedundancy(redundancyModel)
      } catch (err) {
        logger.error('Cannot extend expiration of %s video from our redundancy system.', this.buildEntryLogId(redundancyModel))
      }
    }
  }

  private async extendsOrDeleteRedundancy (redundancyModel: VideoRedundancyModel) {
    // Refresh the video, maybe it was deleted
    const video = await this.loadAndRefreshVideo(redundancyModel.VideoFile.Video.url)

    if (!video) {
      logger.info('Destroying existing redundancy %s, because the associated video does not exist anymore.', redundancyModel.url)

      await redundancyModel.destroy()
      return
    }

    const redundancy = CONFIG.REDUNDANCY.VIDEOS.STRATEGIES.find(s => s.strategy === redundancyModel.strategy)
    await this.extendsExpirationOf(redundancyModel, redundancy.minLifetime)
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
      const video = await this.loadAndRefreshVideo(file.Video.url)

      const existingRedundancy = await VideoRedundancyModel.loadLocalByFileId(file.id)
      if (existingRedundancy) {
        await this.extendsOrDeleteRedundancy(existingRedundancy)

        continue
      }

      if (!video) {
        logger.info('Video %s we want to duplicate does not existing anymore, skipping.', file.Video.url)

        continue
      }

      logger.info('Duplicating %s - %d in videos redundancy with "%s" strategy.', video.url, file.resolution, redundancy.strategy)

      const { baseUrlHttp, baseUrlWs } = video.getBaseUrls()
      const magnetUri = video.generateMagnetUri(file, baseUrlHttp, baseUrlWs)

      const tmpPath = await downloadWebTorrentVideo({ magnetUri }, VIDEO_IMPORT_TIMEOUT)

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

      logger.info('Duplicated %s - %d -> %s.', video.url, file.resolution, createdModel.url)
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

  private async loadAndRefreshVideo (videoUrl: string) {
    // We need more attributes and check if the video still exists
    const getVideoOptions = {
      videoObject: videoUrl,
      syncParam: { likes: false, dislikes: false, shares: false, comments: false, thumbnail: false, refreshVideo: true },
      fetchType: 'all' as 'all'
    }
    const { video } = await getOrCreateVideoAndAccountAndChannel(getVideoOptions)

    return video
  }
}
