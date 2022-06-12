import { move } from 'fs-extra'
import { join } from 'path'
import { getServerActor } from '@server/models/application/application'
import { VideoModel } from '@server/models/video/video'
import {
  MStreamingPlaylistFiles,
  MVideoAccountLight,
  MVideoFile,
  MVideoFileVideo,
  MVideoRedundancyFileVideo,
  MVideoRedundancyStreamingPlaylistVideo,
  MVideoRedundancyVideo,
  MVideoWithAllFiles
} from '@server/types/models'
import { VideosRedundancyStrategy } from '../../../shared/models/redundancy'
import { logger, loggerTagsFactory } from '../../helpers/logger'
import { downloadWebTorrentVideo } from '../../helpers/webtorrent'
import { CONFIG } from '../../initializers/config'
import { HLS_REDUNDANCY_DIRECTORY, REDUNDANCY, VIDEO_IMPORT_TIMEOUT } from '../../initializers/constants'
import { VideoRedundancyModel } from '../../models/redundancy/video-redundancy'
import { sendCreateCacheFile, sendUpdateCacheFile } from '../activitypub/send'
import { getLocalVideoCacheFileActivityPubUrl, getLocalVideoCacheStreamingPlaylistActivityPubUrl } from '../activitypub/url'
import { getOrCreateAPVideo } from '../activitypub/videos'
import { downloadPlaylistSegments } from '../hls'
import { removeVideoRedundancy } from '../redundancy'
import { generateHLSRedundancyUrl, generateWebTorrentRedundancyUrl } from '../video-urls'
import { AbstractScheduler } from './abstract-scheduler'

const lTags = loggerTagsFactory('redundancy')

type CandidateToDuplicate = {
  redundancy: VideosRedundancyStrategy
  video: MVideoWithAllFiles
  files: MVideoFile[]
  streamingPlaylists: MStreamingPlaylistFiles[]
}

function isMVideoRedundancyFileVideo (
  o: MVideoRedundancyFileVideo | MVideoRedundancyStreamingPlaylistVideo
): o is MVideoRedundancyFileVideo {
  return !!(o as MVideoRedundancyFileVideo).VideoFile
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
      files: videoToDuplicate.VideoFiles,
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
        const { totalUsed } = await VideoRedundancyModel.getStats(redundancyConfig.strategy)

        // If the administrator disabled the redundancy or decreased the cache size, remove this redundancy instead of extending it
        if (!redundancyConfig || totalUsed > redundancyConfig.size) {
          logger.info('Destroying redundancy %s because the cache size %s is too heavy.', redundancyModel.url, redundancyModel.strategy)

          await removeVideoRedundancy(redundancyModel)
        } else {
          await this.extendsRedundancy(redundancyModel)
        }
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

    for (const file of data.files) {
      const existingRedundancy = await VideoRedundancyModel.loadLocalByFileId(file.id)
      if (existingRedundancy) {
        await this.extendsRedundancy(existingRedundancy)

        continue
      }

      await this.createVideoFileRedundancy(data.redundancy, video, file)
    }

    for (const streamingPlaylist of data.streamingPlaylists) {
      const existingRedundancy = await VideoRedundancyModel.loadLocalByStreamingPlaylistId(streamingPlaylist.id)
      if (existingRedundancy) {
        await this.extendsRedundancy(existingRedundancy)

        continue
      }

      await this.createStreamingPlaylistRedundancy(data.redundancy, video, streamingPlaylist)
    }
  }

  private async createVideoFileRedundancy (redundancy: VideosRedundancyStrategy | null, video: MVideoAccountLight, fileArg: MVideoFile) {
    let strategy = 'manual'
    let expiresOn: Date = null

    if (redundancy) {
      strategy = redundancy.strategy
      expiresOn = this.buildNewExpiration(redundancy.minLifetime)
    }

    const file = fileArg as MVideoFileVideo
    file.Video = video

    const serverActor = await getServerActor()

    logger.info('Duplicating %s - %d in videos redundancy with "%s" strategy.', video.url, file.resolution, strategy, lTags(video.uuid))

    const tmpPath = await downloadWebTorrentVideo({ uri: file.torrentUrl }, VIDEO_IMPORT_TIMEOUT)

    const destPath = join(CONFIG.STORAGE.REDUNDANCY_DIR, file.filename)
    await move(tmpPath, destPath, { overwrite: true })

    const createdModel: MVideoRedundancyFileVideo = await VideoRedundancyModel.create({
      expiresOn,
      url: getLocalVideoCacheFileActivityPubUrl(file),
      fileUrl: generateWebTorrentRedundancyUrl(file),
      strategy,
      videoFileId: file.id,
      actorId: serverActor.id
    })

    createdModel.VideoFile = file

    await sendCreateCacheFile(serverActor, video, createdModel)

    logger.info('Duplicated %s - %d -> %s.', video.url, file.resolution, createdModel.url, lTags(video.uuid))
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

    const destDirectory = join(HLS_REDUNDANCY_DIRECTORY, video.uuid)
    const masterPlaylistUrl = playlist.getMasterPlaylistUrl(video)

    const maxSizeKB = this.getTotalFileSizes([], [ playlist ]) / 1000
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

      const videoId = toDelete.VideoFile
        ? toDelete.VideoFile.videoId
        : toDelete.VideoStreamingPlaylist.videoId

      const redundancies = await VideoRedundancyModel.listLocalByVideoId(videoId)

      for (const redundancy of redundancies) {
        await removeVideoRedundancy(redundancy)
      }
    }
  }

  private async isTooHeavy (candidateToDuplicate: CandidateToDuplicate) {
    const maxSize = candidateToDuplicate.redundancy.size

    const { totalUsed: alreadyUsed } = await VideoRedundancyModel.getStats(candidateToDuplicate.redundancy.strategy)

    const videoSize = this.getTotalFileSizes(candidateToDuplicate.files, candidateToDuplicate.streamingPlaylists)
    const willUse = alreadyUsed + videoSize

    logger.debug('Checking candidate size.', { maxSize, alreadyUsed, videoSize, willUse, ...lTags(candidateToDuplicate.video.uuid) })

    return willUse > maxSize
  }

  private buildNewExpiration (expiresAfterMs: number) {
    return new Date(Date.now() + expiresAfterMs)
  }

  private buildEntryLogId (object: MVideoRedundancyFileVideo | MVideoRedundancyStreamingPlaylistVideo) {
    if (isMVideoRedundancyFileVideo(object)) return `${object.VideoFile.Video.url}-${object.VideoFile.resolution}`

    return `${object.VideoStreamingPlaylist.getMasterPlaylistUrl(object.VideoStreamingPlaylist.Video)}`
  }

  private getTotalFileSizes (files: MVideoFile[], playlists: MStreamingPlaylistFiles[]): number {
    const fileReducer = (previous: number, current: MVideoFile) => previous + current.size

    let allFiles = files
    for (const p of playlists) {
      allFiles = allFiles.concat(p.VideoFiles)
    }

    return allFiles.reduce(fileReducer, 0)
  }

  private async loadAndRefreshVideo (videoUrl: string) {
    // We need more attributes and check if the video still exists
    const getVideoOptions = {
      videoObject: videoUrl,
      syncParam: { likes: false, dislikes: false, shares: false, comments: false, thumbnail: false, refreshVideo: true },
      fetchType: 'all' as 'all'
    }
    const { video } = await getOrCreateAPVideo(getVideoOptions)

    return video
  }
}
