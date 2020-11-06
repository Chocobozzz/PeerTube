import * as Bull from 'bull'
import { readdir, remove } from 'fs-extra'
import { join } from 'path'
import { getDurationFromVideoFile, getVideoFileResolution, hlsPlaylistToFragmentedMP4 } from '@server/helpers/ffmpeg-utils'
import { publishAndFederateIfNeeded } from '@server/lib/video'
import { getHLSDirectory } from '@server/lib/video-paths'
import { generateHlsPlaylist } from '@server/lib/video-transcoding'
import { VideoModel } from '@server/models/video/video'
import { VideoFileModel } from '@server/models/video/video-file'
import { VideoLiveModel } from '@server/models/video/video-live'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist'
import { MStreamingPlaylist, MVideo, MVideoLive } from '@server/types/models'
import { ThumbnailType, VideoLiveEndingPayload, VideoState } from '@shared/models'
import { logger } from '../../../helpers/logger'
import { generateVideoMiniature } from '@server/lib/thumbnail'

async function processVideoLiveEnding (job: Bull.Job) {
  const payload = job.data as VideoLiveEndingPayload

  function logError () {
    logger.warn('Video live %d does not exist anymore. Cannot process live ending.', payload.videoId)
  }

  const video = await VideoModel.load(payload.videoId)
  const live = await VideoLiveModel.loadByVideoId(payload.videoId)

  if (!video || !live) {
    logError()
    return
  }

  const streamingPlaylist = await VideoStreamingPlaylistModel.loadHLSPlaylistByVideo(video.id)
  if (!streamingPlaylist) {
    logError()
    return
  }

  if (live.saveReplay !== true) {
    return cleanupLive(video, streamingPlaylist)
  }

  return saveLive(video, live)
}

// ---------------------------------------------------------------------------

export {
  processVideoLiveEnding
}

// ---------------------------------------------------------------------------

async function saveLive (video: MVideo, live: MVideoLive) {
  const hlsDirectory = getHLSDirectory(video, false)
  const files = await readdir(hlsDirectory)

  const playlistFiles = files.filter(f => f.endsWith('.m3u8') && f !== 'master.m3u8')
  const resolutions: number[] = []
  let duration: number

  for (const playlistFile of playlistFiles) {
    const playlistPath = join(hlsDirectory, playlistFile)
    const { videoFileResolution } = await getVideoFileResolution(playlistPath)

    const mp4TmpPath = buildMP4TmpPath(hlsDirectory, videoFileResolution)

    // Playlist name is for example 3.m3u8
    // Segments names are 3-0.ts 3-1.ts etc
    const shouldStartWith = playlistFile.replace(/\.m3u8$/, '') + '-'

    const segmentFiles = files.filter(f => f.startsWith(shouldStartWith) && f.endsWith('.ts'))
    await hlsPlaylistToFragmentedMP4(hlsDirectory, segmentFiles, mp4TmpPath)

    if (!duration) {
      duration = await getDurationFromVideoFile(mp4TmpPath)
    }

    resolutions.push(videoFileResolution)
  }

  await cleanupLiveFiles(hlsDirectory)

  await live.destroy()

  video.isLive = false
  video.state = VideoState.TO_TRANSCODE
  video.duration = duration

  await video.save()

  // Remove old HLS playlist video files
  const videoWithFiles = await VideoModel.loadWithFiles(video.id)

  const hlsPlaylist = videoWithFiles.getHLSPlaylist()
  await VideoFileModel.removeHLSFilesOfVideoId(hlsPlaylist.id)
  hlsPlaylist.VideoFiles = []

  for (const resolution of resolutions) {
    const videoInputPath = buildMP4TmpPath(hlsDirectory, resolution)
    const { isPortraitMode } = await getVideoFileResolution(videoInputPath)

    await generateHlsPlaylist({
      video: videoWithFiles,
      videoInputPath,
      resolution: resolution,
      copyCodecs: true,
      isPortraitMode
    })

    await remove(videoInputPath)
  }

  // Regenerate the thumbnail & preview?
  if (videoWithFiles.getMiniature().automaticallyGenerated === true) {
    await generateVideoMiniature(videoWithFiles, videoWithFiles.getMaxQualityFile(), ThumbnailType.MINIATURE)
  }

  if (videoWithFiles.getPreview().automaticallyGenerated === true) {
    await generateVideoMiniature(videoWithFiles, videoWithFiles.getMaxQualityFile(), ThumbnailType.PREVIEW)
  }

  await publishAndFederateIfNeeded(video, true)
}

async function cleanupLive (video: MVideo, streamingPlaylist: MStreamingPlaylist) {
  const hlsDirectory = getHLSDirectory(video)

  await remove(hlsDirectory)

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

function buildMP4TmpPath (basePath: string, resolution: number) {
  return join(basePath, resolution + '-tmp.mp4')
}
