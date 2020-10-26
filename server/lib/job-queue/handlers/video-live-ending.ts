import * as Bull from 'bull'
import { readdir, remove } from 'fs-extra'
import { join } from 'path'
import { getVideoFileResolution, hlsPlaylistToFragmentedMP4 } from '@server/helpers/ffmpeg-utils'
import { getHLSDirectory } from '@server/lib/video-paths'
import { generateHlsPlaylist } from '@server/lib/video-transcoding'
import { VideoModel } from '@server/models/video/video'
import { VideoLiveModel } from '@server/models/video/video-live'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist'
import { MStreamingPlaylist, MVideo } from '@server/types/models'
import { VideoLiveEndingPayload, VideoState } from '@shared/models'
import { logger } from '../../../helpers/logger'

async function processVideoLiveEnding (job: Bull.Job) {
  const payload = job.data as VideoLiveEndingPayload

  const video = await VideoModel.load(payload.videoId)
  const live = await VideoLiveModel.loadByVideoId(payload.videoId)

  const streamingPlaylist = await VideoStreamingPlaylistModel.loadHLSPlaylistByVideo(video.id)
  if (!video || !streamingPlaylist || !live) {
    logger.warn('Video live %d does not exist anymore. Cannot process live ending.', payload.videoId)
    return
  }

  if (live.saveReplay !== true) {
    return cleanupLive(video, streamingPlaylist)
  }

  return saveLive(video, streamingPlaylist)
}

// ---------------------------------------------------------------------------

export {
  processVideoLiveEnding
}

// ---------------------------------------------------------------------------

async function saveLive (video: MVideo, streamingPlaylist: MStreamingPlaylist) {
  const videoFiles = await streamingPlaylist.get('VideoFiles')
  const hlsDirectory = getHLSDirectory(video, false)

  for (const videoFile of videoFiles) {
    const playlistPath = join(hlsDirectory, VideoStreamingPlaylistModel.getHlsPlaylistFilename(videoFile.resolution))

    const mp4TmpName = buildMP4TmpName(videoFile.resolution)
    await hlsPlaylistToFragmentedMP4(playlistPath, mp4TmpName)
  }

  await cleanupLiveFiles(hlsDirectory)

  video.isLive = false
  video.state = VideoState.TO_TRANSCODE
  await video.save()

  const videoWithFiles = await VideoModel.loadWithFiles(video.id)

  for (const videoFile of videoFiles) {
    const videoInputPath = buildMP4TmpName(videoFile.resolution)
    const { isPortraitMode } = await getVideoFileResolution(videoInputPath)

    await generateHlsPlaylist({
      video: videoWithFiles,
      videoInputPath,
      resolution: videoFile.resolution,
      copyCodecs: true,
      isPortraitMode
    })
  }

  video.state = VideoState.PUBLISHED
  await video.save()
}

async function cleanupLive (video: MVideo, streamingPlaylist: MStreamingPlaylist) {
  const hlsDirectory = getHLSDirectory(video, false)

  await cleanupLiveFiles(hlsDirectory)

  streamingPlaylist.destroy()
    .catch(err => logger.error('Cannot remove live streaming playlist.', { err }))
}

async function cleanupLiveFiles (hlsDirectory: string) {
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

function buildMP4TmpName (resolution: number) {
  return resolution + 'tmp.mp4'
}
