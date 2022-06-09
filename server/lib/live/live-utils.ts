import { remove } from 'fs-extra'
import { basename } from 'path'
import { MStreamingPlaylist, MVideo } from '@server/types/models'
import { getHLSDirectory } from '../video-paths'

function buildConcatenatedName (segmentOrPlaylistPath: string) {
  const num = basename(segmentOrPlaylistPath).match(/^(\d+)(-|\.)/)

  return 'concat-' + num[1] + '.ts'
}

async function cleanupLive (video: MVideo, streamingPlaylist: MStreamingPlaylist) {
  const hlsDirectory = getHLSDirectory(video)

  await remove(hlsDirectory)

  await streamingPlaylist.destroy()
}

export {
  cleanupLive,
  buildConcatenatedName
}
