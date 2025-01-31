import { VideosRedundancyStrategy } from '@peertube/peertube-models'
import { getServerActor } from '@server/models/application/application.js'
import { VideoModel } from '@server/models/video/video.js'
import {
  MStreamingPlaylistFiles,
  MVideoAccountLight,
  MVideoFile,
  MVideoRedundancyStreamingPlaylistVideo,
  MVideoRedundancyVideo,
  MVideoWithAllFiles
} from '@server/types/models/index.js'
import { join } from 'path'
import { logger, loggerTagsFactory } from '../../helpers/logger.js'
import { CONFIG } from '../../initializers/config.js'
import { DIRECTORIES, REDUNDANCY, VIDEO_IMPORT_TIMEOUT } from '../../initializers/constants.js'
import { VideoRedundancyModel } from '../../models/redundancy/video-redundancy.js'
import { sendCreateCacheFile, sendUpdateCacheFile } from '../activitypub/send/index.js'
import { getLocalVideoCacheStreamingPlaylistActivityPubUrl } from '../activitypub/url.js'
import { getOrCreateAPVideo } from '../activitypub/videos/index.js'
import { downloadPlaylistSegments } from '../hls.js'
import { removeVideoRedundancy } from '../redundancy.js'
import { generateHLSRedundancyUrl } from '../video-urls.js'
import { AbstractScheduler } from './abstract-scheduler.js'

const lTags = loggerTagsFactory('redundancy')

type CandidateToDuplicate = {
  redundancy: VideosRedundancyStrategy
  video: MVideoWithAllFiles
  streamingPlaylists: MStreamingPlaylistFiles[]
}

export class VideosRedundancyScheduler extends AbstractScheduler {

  private static instance: VideosRedundancyScheduler

  protected schedulerIntervalMs = CONFIG.REDUNDANCY.VIDEOS.CHECK_INTERVAL

  private constructor () {
    super()
  }

  async createManualRedundancy (videoId: number) {
    const videoToDuplicate = await VideoModel.loadWithFiles(videoId)

    if (!videoToDuplicate) {
      logger.warn('Video to manually duplicate %d does not exist anymore.', videoId, lTags())
      return
    }

    return this.createVideoRedundancies({
      video: videoToDuplicate,
      redundancy: null,
      streamingPlaylists: videoToDuplicate.VideoStreamingPlaylists
    })
  }

  protected async internalExecute () {
    for (const redundancyConfig of CONFIG.REDUNDANCY.VIDEOS.STRATEGIES) {
      logger.info('Running redundancy scheduler for strategy %s.', redundancyConfig.strategy, lTags())

      try {
        const videoToDuplicate = await this.findVideoToDuplicate(redundancyConfig)
        if (!videoToDuplicate) continue

        const candidateToDuplicate = {
          video: videoToDuplicate,
          redundancy: redundancyConfig,
          files: videoToDuplicate.VideoFiles,
          streamingPlaylists: videoToDuplicate.VideoStreamingPlaylists
        }

        await this.purgeCacheIfNeeded(candidateToDuplicate)

        if (await this.isTooHeavy(candidateToDuplicate)) {
          logger.info('Video %s is too big for our cache, skipping.', videoToDuplicate.url, lTags(videoToDuplicate.uuid))
          continue
        }

        logger.info(
          'Will duplicate video %s in redundancy scheduler "%s".',
          videoToDuplicate.url, redundancyConfig.strategy, lTags(videoToDuplicate.uuid)
        )

        await this.createVideoRedundancies(candidateToDuplicate)
      } catch (err) {
        logger.error('Cannot run videos redundancy %s.', redundancyConfig.strategy, { err, ...lTags() })
      }
    }

    await this.extendsLocalExpiration()

    await this.purgeRemoteExpired()
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }

  private async extendsLocalExpiration () {
    const expired = await VideoRedundancyModel.listLocalExpired()

    for (const redundancyModel of expired) {
      try {
        const redundancyConfig = CONFIG.REDUNDANCY.VIDEOS.STRATEGIES.find(s => s.strategy === redundancyModel.strategy)

        // If the admin disabled the redundancy, remove this redundancy instead of extending it
        if (!redundancyConfig) {
          logger.info(
            'Destroying redundancy %s because the redundancy %s does not exist anymore.',
            redundancyModel.url, redundancyModel.strategy
          )

          await removeVideoRedundancy(redundancyModel)
          continue
        }

        const { totalUsed } = await VideoRedundancyModel.getStats(redundancyConfig.strategy)

        // If the admin decreased the cache size, remove this redundancy instead of extending it
        if (totalUsed > redundancyConfig.size) {
          logger.info('Destroying redundancy %s because the cache size %s is too heavy.', redundancyModel.url, redundancyModel.strategy)

          await removeVideoRedundancy(redundancyModel)
          continue
        }

        await this.extendsRedundancy(redundancyModel)
      } catch (err) {
        logger.error(
          'Cannot extend or remove expiration of %s video from our redundancy system.',
          this.buildEntryLogId(redundancyModel), { err, ...lTags(redundancyModel.getVideoUUID()) }
        )
      }
    }
  }

  private async extendsRedundancy (redundancyModel: MVideoRedundancyVideo) {
    const redundancy = CONFIG.REDUNDANCY.VIDEOS.STRATEGIES.find(s => s.strategy === redundancyModel.strategy)
    // Redundancy strategy disabled, remove our redundancy instead of extending expiration
    if (!redundancy) {
      await removeVideoRedundancy(redundancyModel)
      return
    }

    await this.extendsExpirationOf(redundancyModel, redundancy.minLifetime)
  }

  private async purgeRemoteExpired () {
    const expired = await VideoRedundancyModel.listRemoteExpired()

    for (const redundancyModel of expired) {
      try {
        await removeVideoRedundancy(redundancyModel)
      } catch (err) {
        logger.error(
          'Cannot remove redundancy %s from our redundancy system.',
          this.buildEntryLogId(redundancyModel), lTags(redundancyModel.getVideoUUID())
        )
      }
    }
  }

  private findVideoToDuplicate (cache: VideosRedundancyStrategy) {
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

  private async createVideoRedundancies (data: CandidateToDuplicate) {
    const video = await this.loadAndRefreshVideo(data.video.url)

    if (!video) {
      logger.info('Video %s we want to duplicate does not existing anymore, skipping.', data.video.url, lTags(data.video.uuid))

      return
    }

    // Only HLS player supports redundancy, so do not duplicate web videos
    for (const streamingPlaylist of data.streamingPlaylists) {
      const existingRedundancy = await VideoRedundancyModel.loadLocalByStreamingPlaylistId(streamingPlaylist.id)
      if (existingRedundancy) {
        await this.extendsRedundancy(existingRedundancy)

        continue
      }

      await this.createStreamingPlaylistRedundancy(data.redundancy, video, streamingPlaylist)
    }
  }

  private async createStreamingPlaylistRedundancy (
    redundancy: VideosRedundancyStrategy,
    video: MVideoAccountLight,
    playlistArg: MStreamingPlaylistFiles
  ) {
    let strategy = 'manual'
    let expiresOn: Date = null

    if (redundancy) {
      strategy = redundancy.strategy
      expiresOn = this.buildNewExpiration(redundancy.minLifetime)
    }

    const playlist = Object.assign(playlistArg, { Video: video })
    const serverActor = await getServerActor()

    logger.info('Duplicating %s streaming playlist in videos redundancy with "%s" strategy.', video.url, strategy, lTags(video.uuid))

    const destDirectory = join(DIRECTORIES.HLS_REDUNDANCY, video.uuid)
    const masterPlaylistUrl = playlist.getMasterPlaylistUrl(video)

    const maxSizeKB = this.getTotalFileSizes([ playlist ]) / 1000
    const toleranceKB = maxSizeKB + ((5 * maxSizeKB) / 100) // 5% more tolerance
    await downloadPlaylistSegments(masterPlaylistUrl, destDirectory, VIDEO_IMPORT_TIMEOUT, toleranceKB)

    const createdModel: MVideoRedundancyStreamingPlaylistVideo = await VideoRedundancyModel.create({
      expiresOn,
      url: getLocalVideoCacheStreamingPlaylistActivityPubUrl(video, playlist),
      fileUrl: generateHLSRedundancyUrl(video, playlistArg),
      strategy,
      videoStreamingPlaylistId: playlist.id,
      actorId: serverActor.id
    })

    createdModel.VideoStreamingPlaylist = playlist

    await sendCreateCacheFile(serverActor, video, createdModel)

    logger.info('Duplicated playlist %s -> %s.', masterPlaylistUrl, createdModel.url, lTags(video.uuid))
  }

  private async extendsExpirationOf (redundancy: MVideoRedundancyVideo, expiresAfterMs: number) {
    logger.info('Extending expiration of %s.', redundancy.url, lTags(redundancy.getVideoUUID()))

    const serverActor = await getServerActor()

    redundancy.expiresOn = this.buildNewExpiration(expiresAfterMs)
    await redundancy.save()

    await sendUpdateCacheFile(serverActor, redundancy)
  }

  private async purgeCacheIfNeeded (candidateToDuplicate: CandidateToDuplicate) {
    while (await this.isTooHeavy(candidateToDuplicate)) {
      const redundancy = candidateToDuplicate.redundancy
      const toDelete = await VideoRedundancyModel.loadOldestLocalExpired(redundancy.strategy, redundancy.minLifetime)
      if (!toDelete) return

      const redundancies = await VideoRedundancyModel.listLocalByStreamingPlaylistId(toDelete.VideoStreamingPlaylist.id)

      for (const redundancy of redundancies) {
        await removeVideoRedundancy(redundancy)
      }
    }
  }

  private async isTooHeavy (candidateToDuplicate: CandidateToDuplicate) {
    const maxSize = candidateToDuplicate.redundancy.size

    const { totalUsed: alreadyUsed } = await VideoRedundancyModel.getStats(candidateToDuplicate.redundancy.strategy)

    const videoSize = this.getTotalFileSizes(candidateToDuplicate.streamingPlaylists)
    const willUse = alreadyUsed + videoSize

    logger.debug('Checking candidate size.', { maxSize, alreadyUsed, videoSize, willUse, ...lTags(candidateToDuplicate.video.uuid) })

    return willUse > maxSize
  }

  private buildNewExpiration (expiresAfterMs: number) {
    return new Date(Date.now() + expiresAfterMs)
  }

  private buildEntryLogId (object: MVideoRedundancyStreamingPlaylistVideo) {
    return `${object.VideoStreamingPlaylist.getMasterPlaylistUrl(object.VideoStreamingPlaylist.Video)}`
  }

  private getTotalFileSizes (playlists: MStreamingPlaylistFiles[]): number {
    const fileReducer = (previous: number, current: MVideoFile) => previous + current.size

    let allFiles: MVideoFile[] = []
    for (const p of playlists) {
      allFiles = allFiles.concat(p.VideoFiles)
    }

    return allFiles.reduce(fileReducer, 0)
  }

  private async loadAndRefreshVideo (videoUrl: string) {
    // We need more attributes and check if the video still exists
    const getVideoOptions = {
      videoObject: videoUrl,
      syncParam: { rates: false, shares: false, comments: false, refreshVideo: true },
      fetchType: 'all' as 'all'
    }
    const { video } = await getOrCreateAPVideo(getVideoOptions)

    return video
  }
}
