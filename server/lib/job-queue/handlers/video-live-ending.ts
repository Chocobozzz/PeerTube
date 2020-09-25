import * as Bull from 'bull'
import { readdir, remove } from 'fs-extra'
import { join } from 'path'
import { getHLSDirectory } from '@server/lib/video-paths'
import { VideoModel } from '@server/models/video/video'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist'
import { VideoLiveEndingPayload } from '@shared/models'
import { logger } from '../../../helpers/logger'

async function processVideoLiveEnding (job: Bull.Job) {
  const payload = job.data as VideoLiveEndingPayload

  const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(payload.videoId)
  if (!video) {
    logger.warn('Video live %d does not exist anymore. Cannot cleanup.', payload.videoId)
    return
  }

  const streamingPlaylist = await VideoStreamingPlaylistModel.loadHLSPlaylistByVideo(video.id)
  const hlsDirectory = getHLSDirectory(video, false)

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

  streamingPlaylist.destroy()
    .catch(err => logger.error('Cannot remove live streaming playlist.', { err }))
}

// ---------------------------------------------------------------------------

export {
  processVideoLiveEnding
}
