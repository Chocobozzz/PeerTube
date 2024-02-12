import { pathExists, remove } from 'fs-extra/esm'
import { readdir } from 'fs/promises'
import { basename, join } from 'path'
import { LiveVideoLatencyMode, LiveVideoLatencyModeType, FileStorage } from '@peertube/peertube-models'
import { logger } from '@server/helpers/logger.js'
import { VIDEO_LIVE } from '@server/initializers/constants.js'
import { MStreamingPlaylist, MStreamingPlaylistVideo, MVideo } from '@server/types/models/index.js'
import { listHLSFileKeysOf, removeHLSFileObjectStorageByFullKey, removeHLSObjectStorage } from '../object-storage/index.js'
import { getLiveDirectory } from '../paths.js'

function buildConcatenatedName (segmentOrPlaylistPath: string) {
  const num = basename(segmentOrPlaylistPath).match(/^(\d+)(-|\.)/)

  return 'concat-' + num[1] + '.ts'
}

async function cleanupAndDestroyPermanentLive (video: MVideo, streamingPlaylist: MStreamingPlaylist) {
  await cleanupTMPLiveFiles(video, streamingPlaylist)

  await streamingPlaylist.destroy()
}

async function cleanupUnsavedNormalLive (video: MVideo, streamingPlaylist: MStreamingPlaylist) {
  const hlsDirectory = getLiveDirectory(video)

  // We uploaded files to object storage too, remove them
  if (streamingPlaylist.storage === FileStorage.OBJECT_STORAGE) {
    await removeHLSObjectStorage(streamingPlaylist.withVideo(video))
  }

  await remove(hlsDirectory)

  await streamingPlaylist.destroy()
}

async function cleanupTMPLiveFiles (video: MVideo, streamingPlaylist: MStreamingPlaylist) {
  await cleanupTMPLiveFilesFromObjectStorage(streamingPlaylist.withVideo(video))

  await cleanupTMPLiveFilesFromFilesystem(video)
}

function getLiveSegmentTime (latencyMode: LiveVideoLatencyModeType) {
  if (latencyMode === LiveVideoLatencyMode.SMALL_LATENCY) {
    return VIDEO_LIVE.SEGMENT_TIME_SECONDS.SMALL_LATENCY
  }

  return VIDEO_LIVE.SEGMENT_TIME_SECONDS.DEFAULT_LATENCY
}

export {
  cleanupAndDestroyPermanentLive,
  cleanupUnsavedNormalLive,
  cleanupTMPLiveFiles,
  getLiveSegmentTime,
  buildConcatenatedName
}

// ---------------------------------------------------------------------------

function isTMPLiveFile (name: string) {
  return name.endsWith('.ts') ||
    name.endsWith('.m3u8') ||
    name.endsWith('.json') ||
    name.endsWith('.mpd') ||
    name.endsWith('.m4s') ||
    name.endsWith('.tmp')
}

async function cleanupTMPLiveFilesFromFilesystem (video: MVideo) {
  const hlsDirectory = getLiveDirectory(video)

  if (!await pathExists(hlsDirectory)) return

  logger.info('Cleanup TMP live files from filesystem of %s.', hlsDirectory)

  const files = await readdir(hlsDirectory)

  for (const filename of files) {
    if (isTMPLiveFile(filename)) {
      const p = join(hlsDirectory, filename)

      remove(p)
        .catch(err => logger.error('Cannot remove %s.', p, { err }))
    }
  }
}

async function cleanupTMPLiveFilesFromObjectStorage (streamingPlaylist: MStreamingPlaylistVideo) {
  if (streamingPlaylist.storage !== FileStorage.OBJECT_STORAGE) return

  logger.info('Cleanup TMP live files from object storage for %s.', streamingPlaylist.Video.uuid)

  const keys = await listHLSFileKeysOf(streamingPlaylist)

  for (const key of keys) {
    if (isTMPLiveFile(key)) {
      await removeHLSFileObjectStorageByFullKey(key)
    }
  }
}
