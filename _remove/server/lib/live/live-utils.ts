import { pathExists, readdir, remove } from 'fs-extra'
import { basename, join } from 'path'
import { logger } from '@server/helpers/logger'
import { MStreamingPlaylist, MVideo } from '@server/types/models'
import { getLiveDirectory } from '../paths'
import { LiveSegmentShaStore } from './live-segment-sha-store'

function buildConcatenatedName (segmentOrPlaylistPath: string) {
  const num = basename(segmentOrPlaylistPath).match(/^(\d+)(-|\.)/)

  return 'concat-' + num[1] + '.ts'
}

async function cleanupPermanentLive (video: MVideo, streamingPlaylist: MStreamingPlaylist) {
  await cleanupTMPLiveFiles(video)

  await streamingPlaylist.destroy()
}

async function cleanupUnsavedNormalLive (video: MVideo, streamingPlaylist: MStreamingPlaylist) {
  const hlsDirectory = getLiveDirectory(video)

  await remove(hlsDirectory)

  await streamingPlaylist.destroy()

  LiveSegmentShaStore.Instance.cleanupShaSegments(video.uuid)
}

async function cleanupTMPLiveFiles (video: MVideo) {
  const hlsDirectory = getLiveDirectory(video)

  LiveSegmentShaStore.Instance.cleanupShaSegments(video.uuid)

  if (!await pathExists(hlsDirectory)) return

  logger.info('Cleanup TMP live files of %s.', hlsDirectory)

  const files = await readdir(hlsDirectory)

  for (const filename of files) {
    if (
      filename.endsWith('.ts') ||
      filename.endsWith('.m3u8') ||
      filename.endsWith('.mpd') ||
      filename.endsWith('.m4s') ||
      filename.endsWith('.tmp')
    ) {
      const p = join(hlsDirectory, filename)

      remove(p)
        .catch(err => logger.error('Cannot remove %s.', p, { err }))
    }
  }
}

export {
  cleanupPermanentLive,
  cleanupUnsavedNormalLive,
  cleanupTMPLiveFiles,
  buildConcatenatedName
}
