import { wait } from '@peertube/peertube-core-utils'
import { FileStorage, LiveVideoLatencyMode, LiveVideoLatencyModeType, VideoState } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { VIDEO_LIVE } from '@server/initializers/constants.js'
import { MStreamingPlaylist, MStreamingPlaylistVideo, MVideo } from '@server/types/models/index.js'
import Bluebird from 'bluebird'
import { pathExists, remove } from 'fs-extra/esm'
import { readdir, rmdir } from 'fs/promises'
import { basename, join } from 'path'
import { listHLSFileKeysOf, removeHLSFileObjectStorageByFullKey, removeHLSObjectStorage } from '../object-storage/index.js'
import { getLiveDirectory, getLiveReplayBaseDirectory } from '../paths.js'

const logger = createLogger()

export function buildConcatenatedName (segmentOrPlaylistPath: string) {
  const num = basename(segmentOrPlaylistPath).match(/^(\d+)(-|\.)/)

  return 'concat-' + num[1] + '.ts'
}

export async function cleanupAndDestroyPermanentLive (video: MVideo, streamingPlaylist: MStreamingPlaylist) {
  const cleaned = await cleanupTMPLiveFiles(video, streamingPlaylist)

  if (video.state === VideoState.WAITING_FOR_LIVE) {
    // Try to delete local filesystem empty paths
    // Object storage doesn't have the concept of directories so we don't need to duplicate the logic here
    try {
      await rmdir(getLiveReplayBaseDirectory(video))
      await wait(100)
      await rmdir(getLiveDirectory(video))
    } catch (err) {
      logger.debug('Cannot cleanup permanent local live files', { err })
    }
  }

  // Keep the playlist instead, so the next session retries the cleanup before writing in the directory
  if (!cleaned) {
    logger.warn(
      'Not destroying the streaming playlist of %s: some live files could not be removed, keeping it so the cleanup is retried.',
      video.uuid
    )
    return
  }

  await streamingPlaylist.destroy()
}

export async function cleanupUnsavedNormalLive (video: MVideo, streamingPlaylist: MStreamingPlaylist) {
  const hlsDirectory = getLiveDirectory(video)

  // We uploaded files to object storage too, remove them
  if (streamingPlaylist.storage === FileStorage.OBJECT_STORAGE) {
    await removeHLSObjectStorage(video)
  }

  await remove(hlsDirectory)

  await streamingPlaylist.destroy()
}

// Returns false if some files could not be removed
export async function cleanupTMPLiveFiles (video: MVideo, streamingPlaylist: MStreamingPlaylist) {
  await cleanupTMPLiveFilesFromObjectStorage(streamingPlaylist.withVideo(video))

  return cleanupTMPLiveFilesFromFilesystem(video)
}

export function getLiveSegmentTime (latencyMode: LiveVideoLatencyModeType) {
  if (latencyMode === LiveVideoLatencyMode.SMALL_LATENCY) {
    return VIDEO_LIVE.SEGMENT_TIME_SECONDS.SMALL_LATENCY
  }

  return VIDEO_LIVE.SEGMENT_TIME_SECONDS.DEFAULT_LATENCY
}

export function getLiveSegmentListSize (options: {
  latencyMode: LiveVideoLatencyModeType
  dvrWindow: number
}) {
  const { latencyMode, dvrWindow } = options

  if (dvrWindow === 0) return VIDEO_LIVE.SEGMENTS_LIST_SIZE

  const segmentDuration = getLiveSegmentTime(latencyMode)
  const maxDvrWindow = CONFIG.LIVE.DVR.MAX_WINDOW

  const sanitizedWindow = Math.min(dvrWindow, maxDvrWindow)

  return Math.ceil(sanitizedWindow / segmentDuration)
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function isTMPLiveFile (name: string) {
  return name.endsWith('.ts') ||
    name.endsWith('.m3u8') ||
    name.endsWith('.json') ||
    name.endsWith('.mpd') ||
    name.endsWith('.m4s') ||
    name.endsWith('.tmp')
}

// Returns false if some files could not be removed
async function cleanupTMPLiveFilesFromFilesystem (video: MVideo) {
  const hlsDirectory = getLiveDirectory(video)

  if (!await pathExists(hlsDirectory)) return true

  logger.info('Cleanup TMP live files from filesystem of %s.', hlsDirectory)

  const files = await readdir(hlsDirectory)

  let cleaned = true

  // Await the removals: the caller can start a new live session in this directory just after
  // A live directory can hold thousands of segments with a big DVR window, so don't remove them all at once
  await Bluebird.map(files.filter(filename => isTMPLiveFile(filename)), filename => {
    const p = join(hlsDirectory, filename)

    return remove(p)
      .catch(err => {
        logger.error('Cannot remove %s.', p, { err })

        cleaned = false
      })
  }, { concurrency: 10 })

  return cleaned
}

async function cleanupTMPLiveFilesFromObjectStorage (streamingPlaylist: MStreamingPlaylistVideo) {
  if (streamingPlaylist.storage !== FileStorage.OBJECT_STORAGE) return

  logger.info('Cleanup TMP live files from object storage for %s.', streamingPlaylist.Video.uuid)

  const keys = await listHLSFileKeysOf(streamingPlaylist.Video)

  for (const key of keys) {
    if (isTMPLiveFile(key)) {
      await removeHLSFileObjectStorageByFullKey(key)
    }
  }
}
