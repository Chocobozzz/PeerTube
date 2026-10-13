import { FileStorage, type FileStorageType, VideosRedundancyStrategy } from '@peertube/peertube-models'
import { buildUUID } from '@peertube/peertube-node-utils'
import { getServerActor } from '@server/models/application/application.js'
import { VideoModel } from '@server/models/video/video.js'
import {
  MStreamingPlaylistFiles,
  MVideoAccountLight,
  MVideoFile,
  MVideoRedundancyStreamingPlaylistVideo,
  MVideoRedundancyVideo,
  MVideoUUID,
  MVideoWithAllFiles
} from '@server/types/models/index.js'
import { pathExists, remove } from 'fs-extra/esm'
import { readdir, stat } from 'fs/promises'
import { join } from 'path'
import { createLogger } from '../../helpers/logger.js'
import { CONFIG } from '../../initializers/config.js'
import { DIRECTORIES, REDUNDANCY, VIDEO_IMPORT_TIMEOUT } from '../../initializers/constants.js'
import { VideoRedundancyModel } from '../../models/redundancy/video-redundancy.js'
import { sendCreateCacheFile, sendUpdateCacheFile } from '../activitypub/send/index.js'
import { getLocalVideoCacheStreamingPlaylistActivityPubUrl } from '../activitypub/url.js'
import { getOrCreateAPVideo } from '../activitypub/videos/index.js'
import { acquireDistributedLock } from '../distributed-lock.js'
import { downloadPlaylistSegments } from '../hls.js'
import {
  buildRedundancyObjectBaseUrl,
  listRedundancyObjectVideos,
  removeRedundancyObjects,
  storeRedundancyDirectory
} from '../object-storage/redundancy.js'
import { getHLSRedundancyDirectory } from '../paths.js'
import { removeVideoRedundancy } from '../redundancy.js'
import { generateHLSRedundancyUrl } from '../video-urls.js'
import { AbstractScheduler } from './abstract-scheduler.js'

const logger = createLogger('schedulers', 'redundancy')

type CandidateToDuplicate = {
  redundancy: VideosRedundancyStrategy
  video: MVideoWithAllFiles
  streamingPlaylists: MStreamingPlaylistFiles[]
}

export class VideosRedundancyScheduler extends AbstractScheduler {
  private static instance: VideosRedundancyScheduler

  protected schedulerIntervalMs = CONFIG.REDUNDANCY.VIDEOS.CHECK_INTERVAL

  private constructor () {
    super({ randomRunOnEnable: true })
  }

  async createManualRedundancy (videoId: number) {
    const videoToDuplicate = await VideoModel.loadWithFiles(videoId)

    if (!videoToDuplicate) {
      logger.warn('Video to manually duplicate %d does not exist anymore.', videoId)
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
      logger.info('Running redundancy scheduler for strategy %s.', redundancyConfig.strategy)

      try {
        const videoToDuplicate = await this.findVideoToDuplicate(redundancyConfig)
        if (!videoToDuplicate) continue

        const candidateToDuplicate = {
          video: videoToDuplicate,
          redundancy: redundancyConfig,
          streamingPlaylists: videoToDuplicate.VideoStreamingPlaylists
        }

        await logger.withContext([ videoToDuplicate.uuid ], async () => {
          await this.purgeCacheIfNeeded(candidateToDuplicate)

          if (await this.isTooHeavy(candidateToDuplicate)) {
            logger.info('Video %s is too big for our cache, skipping.', videoToDuplicate.url)
            return
          }

          logger.info('Will duplicate video %s in redundancy scheduler "%s".', videoToDuplicate.url, redundancyConfig.strategy)

          await this.createVideoRedundancies(candidateToDuplicate)
        })
      } catch (err) {
        logger.error('Cannot run videos redundancy %s.', redundancyConfig.strategy, { err })
      }
    }

    await this.extendsLocalExpiration()

    await this.purgeRemoteExpired()

    await this.removeOrphanFiles()
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }

  private async extendsLocalExpiration () {
    const expired = await VideoRedundancyModel.listLocalExpired()

    for (const redundancyModel of expired) {
      await logger.withContext([ redundancyModel.getVideoUUID() ], async () => {
        try {
          const redundancyConfig = CONFIG.REDUNDANCY.VIDEOS.STRATEGIES.find(s => s.strategy === redundancyModel.strategy)

          // If the admin disabled the redundancy, remove this redundancy instead of extending it
          if (!redundancyConfig) {
            logger.info(
              'Destroying redundancy %s because the redundancy %s does not exist anymore.',
              redundancyModel.url,
              redundancyModel.strategy
            )

            await removeVideoRedundancy(redundancyModel)
            return
          }

          const { totalUsed } = await VideoRedundancyModel.getStats(redundancyConfig.strategy)

          // If the admin decreased the cache size, remove this redundancy instead of extending it
          if (totalUsed > redundancyConfig.size) {
            logger.info('Destroying redundancy %s because the cache size %s is too heavy.', redundancyModel.url, redundancyModel.strategy)

            await removeVideoRedundancy(redundancyModel)
            return
          }

          await this.extendsRedundancy(redundancyModel)
        } catch (err) {
          logger.error(
            'Cannot extend or remove expiration of %s video from our redundancy system.',
            this.buildEntryLogId(redundancyModel),
            {
              err
            }
          )
        }
      })
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
      await logger.withContext([ redundancyModel.getVideoUUID() ], async () => {
        try {
          await removeVideoRedundancy(redundancyModel)
        } catch (err) {
          logger.error('Cannot remove redundancy %s from our redundancy system.', this.buildEntryLogId(redundancyModel))
        }
      })
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

  private async removeOrphanFiles () {
    try {
      if (CONFIG.OBJECT_STORAGE.ENABLED) await this.removeOrphanFromObjectStorage()
      else await this.removeOrphanFromFS()
    } catch (err) {
      logger.error('Cannot remove orphan redundancy files.', { err })
    }
  }

  private async removeOrphanFromFS () {
    if (!await pathExists(DIRECTORIES.HLS_REDUNDANCY)) return

    const duplicatedUUIDs = await VideoRedundancyModel.listVideoUUIDOfDuplicated(FileStorage.FILE_SYSTEM)

    for (const videoUUID of await readdir(DIRECTORIES.HLS_REDUNDANCY)) {
      if (duplicatedUUIDs.has(videoUUID)) continue

      const directory = join(DIRECTORIES.HLS_REDUNDANCY, videoUUID)

      // The redundancy may be in creation: its files are downloaded before the creation of its model
      const { mtimeMs } = await stat(directory)
      if (Date.now() - mtimeMs < VIDEO_IMPORT_TIMEOUT) continue

      logger.info('Removing orphan redundancy directory %s.', directory)

      await remove(directory)
    }
  }

  private async removeOrphanFromObjectStorage () {
    const objectVideos = await listRedundancyObjectVideos()
    if (objectVideos.size === 0) return

    const duplicatedUUIDs = await VideoRedundancyModel.listVideoUUIDOfDuplicated(FileStorage.OBJECT_STORAGE)

    for (const [ videoUUID, lastModified ] of objectVideos) {
      if (duplicatedUUIDs.has(videoUUID)) continue

      // Pending redundancy creation, skip it
      if (Date.now() - lastModified.getTime() < VIDEO_IMPORT_TIMEOUT) continue

      logger.info('Removing orphan redundancy objects of video %s.', videoUUID)

      await removeRedundancyObjects({ uuid: videoUUID })
    }
  }

  private async createVideoRedundancies (data: CandidateToDuplicate) {
    const video = await this.loadAndRefreshVideo(data.video.url)

    if (!video) {
      logger.info('Video %s we want to duplicate does not existing anymore, skipping.', data.video.url)

      return
    }

    const releaseLock = await acquireDistributedLock('video-redundancy-' + video.uuid)

    try {
      // Only HLS player supports redundancy, so do not duplicate web videos
      for (const streamingPlaylist of data.streamingPlaylists) {
        const existingRedundancy = await VideoRedundancyModel.loadLocalByStreamingPlaylistId(streamingPlaylist.id)
        if (existingRedundancy) {
          await this.extendsRedundancy(existingRedundancy)

          continue
        }

        await this.createStreamingPlaylistRedundancy(data.redundancy, video, streamingPlaylist)
      }
    } finally {
      await releaseLock()
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

    logger.info('Duplicating %s streaming playlist in videos redundancy with "%s" strategy.', video.url, strategy)

    const masterPlaylistUrl = playlist.getMasterPlaylistUrl(video)

    const maxSizeKB = this.getTotalFileSizes([ playlist ]) / 1000
    const toleranceKB = maxSizeKB + ((5 * maxSizeKB) / 100) // 5% more tolerance

    const { storage, fileUrl } = CONFIG.OBJECT_STORAGE.ENABLED
      ? await this.duplicateInObjectStorage({ video, masterPlaylistUrl, toleranceKB })
      : await this.duplicateInFileSystem({ video, playlist, masterPlaylistUrl, toleranceKB })

    let createdModel: MVideoRedundancyStreamingPlaylistVideo

    try {
      createdModel = await VideoRedundancyModel.create({
        expiresOn,
        url: getLocalVideoCacheStreamingPlaylistActivityPubUrl(video, playlist),
        fileUrl,
        storage,
        strategy,
        videoStreamingPlaylistId: playlist.id,
        actorId: serverActor.id
      })
    } catch (err) {
      await this.removeDuplicatedFiles(video, storage)

      throw err
    }

    createdModel.VideoStreamingPlaylist = playlist

    await sendCreateCacheFile(serverActor, video, createdModel)

    logger.info('Duplicated playlist %s -> %s.', masterPlaylistUrl, createdModel.url)
  }

  private async duplicateInFileSystem (options: {
    video: MVideoAccountLight
    playlist: MStreamingPlaylistFiles
    masterPlaylistUrl: string
    toleranceKB: number
  }) {
    const { video, playlist, masterPlaylistUrl, toleranceKB } = options

    await downloadPlaylistSegments(masterPlaylistUrl, getHLSRedundancyDirectory(video), VIDEO_IMPORT_TIMEOUT, toleranceKB)

    return { storage: FileStorage.FILE_SYSTEM, fileUrl: generateHLSRedundancyUrl(video, playlist) }
  }

  private async duplicateInObjectStorage (options: {
    video: MVideoAccountLight
    masterPlaylistUrl: string
    toleranceKB: number
  }) {
    const { video, masterPlaylistUrl, toleranceKB } = options

    const tmpDirectory = join(CONFIG.STORAGE.TMP_DIR, 'redundancy-' + buildUUID())

    try {
      await downloadPlaylistSegments(masterPlaylistUrl, tmpDirectory, VIDEO_IMPORT_TIMEOUT, toleranceKB)

      try {
        await storeRedundancyDirectory(video, tmpDirectory)
      } catch (err) {
        // Some files may have been uploaded
        await this.removeDuplicatedFiles(video, FileStorage.OBJECT_STORAGE)

        throw err
      }
    } finally {
      await remove(tmpDirectory)
    }

    return { storage: FileStorage.OBJECT_STORAGE, fileUrl: buildRedundancyObjectBaseUrl(video) }
  }

  private async removeDuplicatedFiles (video: MVideoUUID, storage: FileStorageType) {
    try {
      if (storage === FileStorage.OBJECT_STORAGE) await removeRedundancyObjects(video)
      else await remove(getHLSRedundancyDirectory(video))
    } catch (err) {
      logger.error('Cannot remove files of failed redundancy of video %s.', video.uuid, { err })
    }
  }

  private async extendsExpirationOf (redundancy: MVideoRedundancyVideo, expiresAfterMs: number) {
    logger.info('Extending expiration of %s.', redundancy.url)

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

    logger.debug('Checking candidate size.', { maxSize, alreadyUsed, videoSize, willUse })

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
      fetchType: 'full' as const
    }
    const { video } = await getOrCreateAPVideo(getVideoOptions)

    return video
  }
}
