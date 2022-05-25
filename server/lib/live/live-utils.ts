import { pathExists, readdir, remove } from 'fs-extra'
import { basename, join } from 'path'
import { logger } from '@server/helpers/logger'
import { MStreamingPlaylist, MVideo } from '@server/types/models'
import { getLiveDirectory } from '../paths'

function buildConcatenatedName (segmentOrPlaylistPath: string) {
  const num = basename(segmentOrPlaylistPath).match(/^(\d+)(-|\.)/)

  return 'concat-' + num[1] + '.ts'
}

async function cleanupPermanentLive (video: MVideo, streamingPlaylist?: MStreamingPlaylist) {
  const hlsDirectory = getLiveDirectory(video)

  await cleanupTMPLiveFiles(hlsDirectory)

  if (streamingPlaylist) await streamingPlaylist.destroy()
}

async function cleanupNormalLive (video: MVideo, streamingPlaylist?: MStreamingPlaylist) {
  const hlsDirectory = getLiveDirectory(video)

  await remove(hlsDirectory)

  if (streamingPlaylist) await streamingPlaylist.destroy()
}

async function cleanupTMPLiveFiles (hlsDirectory: string) {
  if (!await pathExists(hlsDirectory)) return

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
  cleanupNormalLive,
  cleanupTMPLiveFiles,
  buildConcatenatedName
}
