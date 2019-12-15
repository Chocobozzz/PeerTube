import { AbstractScheduler } from './abstract-scheduler'
import { HLS_REDUNDANCY_DIRECTORY, REDUNDANCY, VIDEO_IMPORT_TIMEOUT, WEBSERVER } from '../../initializers/constants'
import { logger } from '../../helpers/logger'
import { VideosRedundancy } from '../../../shared/models/redundancy'
import { VideoRedundancyModel } from '../../models/redundancy/video-redundancy'
import { downloadWebTorrentVideo, generateMagnetUri } from '../../helpers/webtorrent'
import { join } from 'path'
import { move } from 'fs-extra'
import { getServerActor } from '../../helpers/utils'
import { sendCreateCacheFile, sendUpdateCacheFile } from '../activitypub/send'
import { getVideoCacheFileActivityPubUrl, getVideoCacheStreamingPlaylistActivityPubUrl } from '../activitypub/url'
import { removeVideoRedundancy } from '../redundancy'
import { getOrCreateVideoAndAccountAndChannel } from '../activitypub'
import { downloadPlaylistSegments } from '../hls'
import { CONFIG } from '../../initializers/config'
import {
  MStreamingPlaylist, MStreamingPlaylistFiles,
  MStreamingPlaylistVideo,
  MVideoAccountLight,
  MVideoFile,
  MVideoFileVideo,
  MVideoRedundancyFileVideo,
  MVideoRedundancyStreamingPlaylistVideo,
  MVideoRedundancyVideo,
  MVideoWithAllFiles
} from '@server/typings/models'
import { getVideoFilename } from '../video-paths'

type CandidateToDuplicate = {
  redundancy: VideosRedundancy,
  video: MVideoWithAllFiles,
  files: MVideoFile[],
  streamingPlaylists: MStreamingPlaylistFiles[]
}

function isMVideoRedundancyFileVideo (
  o: MVideoRedundancyFileVideo | MVideoRedundancyStreamingPlaylistVideo
): o is MVideoRedundancyFileVideo {
  return !!(o as MVideoRedundancyFileVideo).VideoFile
}

export class VideosRedundancyScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler

  protected schedulerIntervalMs = CONFIG.REDUNDANCY.VIDEOS.CHECK_INTERVAL

  private constructor () {
    super()
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
          files: videoToDuplicate.VideoFiles,
          streamingPlaylists: videoToDuplicate.VideoStreamingPlaylists
        }

        await this.purgeCacheIfNeeded(candidateToDuplicate)

        if (await this.isTooHeavy(candidateToDuplicate)) {
          logger.info('Video %s is too big for our cache, skipping.', videoToDuplicate.url)
          continue
        }

        logger.info('Will duplicate video %s in redundancy scheduler "%s".', videoToDuplicate.url, redundancyConfig.strategy)

        await this.createVideoRedundancies(candidateToDuplicate)
      } catch (err) {
        logger.error('Cannot run videos redundancy %s.', redundancyConfig.strategy, { err })
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
        const candidate = {
          redundancy: redundancyConfig,
          video: null,
          files: [],
          streamingPlaylists: []
        }

        // If the administrator disabled the redundancy or decreased the cache size, remove this redundancy instead of extending it
        if (!redundancyConfig || await this.isTooHeavy(candidate)) {
          logger.info('Destroying redundancy %s because the cache size %s is too heavy.', redundancyModel.url, redundancyModel.strategy)
          await removeVideoRedundancy(redundancyModel)
        } else {
          await this.extendsRedundancy(redundancyModel)
        }
      } catch (err) {
        logger.error(
          'Cannot extend or remove expiration of %s video from our redundancy system.', this.buildEntryLogId(redundancyModel),
          { err }
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

  private async createVideoRedundancies (data: CandidateToDuplicate) {
    const video = await this.loadAndRefreshVideo(data.video.url)

    if (!video) {
      logger.info('Video %s we want to duplicate does not existing anymore, skipping.', data.video.url)

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

  private async createVideoFileRedundancy (redundancy: VideosRedundancy, video: MVideoAccountLight, fileArg: MVideoFile) {
    const file = fileArg as MVideoFileVideo
    file.Video = video

    const serverActor = await getServerActor()

    logger.info('Duplicating %s - %d in videos redundancy with "%s" strategy.', video.url, file.resolution, redundancy.strategy)

    const { baseUrlHttp, baseUrlWs } = video.getBaseUrls()
    const magnetUri = generateMagnetUri(video, file, baseUrlHttp, baseUrlWs)

    const tmpPath = await downloadWebTorrentVideo({ magnetUri }, VIDEO_IMPORT_TIMEOUT)

    const destPath = join(CONFIG.STORAGE.REDUNDANCY_DIR, getVideoFilename(video, file))
    await move(tmpPath, destPath, { overwrite: true })

    const createdModel: MVideoRedundancyFileVideo = await VideoRedundancyModel.create({
      expiresOn: this.buildNewExpiration(redundancy.minLifetime),
      url: getVideoCacheFileActivityPubUrl(file),
      fileUrl: video.getVideoRedundancyUrl(file, WEBSERVER.URL),
      strategy: redundancy.strategy,
      videoFileId: file.id,
      actorId: serverActor.id
    })

    createdModel.VideoFile = file

    await sendCreateCacheFile(serverActor, video, createdModel)

    logger.info('Duplicated %s - %d -> %s.', video.url, file.resolution, createdModel.url)
  }

  private async createStreamingPlaylistRedundancy (
    redundancy: VideosRedundancy,
    video: MVideoAccountLight,
    playlistArg: MStreamingPlaylist
  ) {
    const playlist = playlistArg as MStreamingPlaylistVideo
    playlist.Video = video

    const serverActor = await getServerActor()

    logger.info('Duplicating %s streaming playlist in videos redundancy with "%s" strategy.', video.url, redundancy.strategy)

    const destDirectory = join(HLS_REDUNDANCY_DIRECTORY, video.uuid)
    await downloadPlaylistSegments(playlist.playlistUrl, destDirectory, VIDEO_IMPORT_TIMEOUT)

    const createdModel: MVideoRedundancyStreamingPlaylistVideo = await VideoRedundancyModel.create({
      expiresOn: this.buildNewExpiration(redundancy.minLifetime),
      url: getVideoCacheStreamingPlaylistActivityPubUrl(video, playlist),
      fileUrl: playlist.getVideoRedundancyUrl(WEBSERVER.URL),
      strategy: redundancy.strategy,
      videoStreamingPlaylistId: playlist.id,
      actorId: serverActor.id
    })

    createdModel.VideoStreamingPlaylist = playlist

    await sendCreateCacheFile(serverActor, video, createdModel)

    logger.info('Duplicated playlist %s -> %s.', playlist.playlistUrl, createdModel.url)
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

      await removeVideoRedundancy(toDelete)
    }
  }

  private async isTooHeavy (candidateToDuplicate: CandidateToDuplicate) {
    const maxSize = candidateToDuplicate.redundancy.size

    const totalDuplicated = await VideoRedundancyModel.getTotalDuplicated(candidateToDuplicate.redundancy.strategy)
    const totalWillDuplicate = totalDuplicated + this.getTotalFileSizes(candidateToDuplicate.files, candidateToDuplicate.streamingPlaylists)

    return totalWillDuplicate > maxSize
  }

  private buildNewExpiration (expiresAfterMs: number) {
    return new Date(Date.now() + expiresAfterMs)
  }

  private buildEntryLogId (object: MVideoRedundancyFileVideo | MVideoRedundancyStreamingPlaylistVideo) {
    if (isMVideoRedundancyFileVideo(object)) return `${object.VideoFile.Video.url}-${object.VideoFile.resolution}`

    return `${object.VideoStreamingPlaylist.playlistUrl}`
  }

  private getTotalFileSizes (files: MVideoFile[], playlists: MStreamingPlaylistFiles[]) {
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
    const { video } = await getOrCreateVideoAndAccountAndChannel(getVideoOptions)

    return video
  }
}
