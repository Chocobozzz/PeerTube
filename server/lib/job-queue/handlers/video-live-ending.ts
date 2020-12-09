import * as Bull from 'bull'
import { pathExists, readdir, remove } from 'fs-extra'
import { join } from 'path'
import { ffprobePromise, getAudioStream, getDurationFromVideoFile, getVideoFileResolution } from '@server/helpers/ffprobe-utils'
import { VIDEO_LIVE } from '@server/initializers/constants'
import { LiveManager } from '@server/lib/live-manager'
import { generateVideoMiniature } from '@server/lib/thumbnail'
import { publishAndFederateIfNeeded } from '@server/lib/video'
import { getHLSDirectory } from '@server/lib/video-paths'
import { generateHlsPlaylistFromTS } from '@server/lib/video-transcoding'
import { VideoModel } from '@server/models/video/video'
import { VideoFileModel } from '@server/models/video/video-file'
import { VideoLiveModel } from '@server/models/video/video-live'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist'
import { MStreamingPlaylist, MVideo, MVideoLive } from '@server/types/models'
import { ThumbnailType, VideoLiveEndingPayload, VideoState } from '@shared/models'
import { logger } from '../../../helpers/logger'

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

  LiveManager.Instance.cleanupShaSegments(video.uuid)

  if (live.saveReplay !== true) {
    return cleanupLive(video, streamingPlaylist)
  }

  return saveLive(video, live)
}

async function cleanupLive (video: MVideo, streamingPlaylist: MStreamingPlaylist) {
  const hlsDirectory = getHLSDirectory(video)

  await remove(hlsDirectory)

  await streamingPlaylist.destroy()
}

// ---------------------------------------------------------------------------

export {
  processVideoLiveEnding,
  cleanupLive
}

// ---------------------------------------------------------------------------

async function saveLive (video: MVideo, live: MVideoLive) {
  const hlsDirectory = getHLSDirectory(video, false)
  const replayDirectory = join(hlsDirectory, VIDEO_LIVE.REPLAY_DIRECTORY)

  const rootFiles = await readdir(hlsDirectory)

  const playlistFiles = rootFiles.filter(file => {
    return file.endsWith('.m3u8') && file !== 'master.m3u8'
  })

  await cleanupLiveFiles(hlsDirectory)

  await live.destroy()

  video.isLive = false
  // Reinit views
  video.views = 0
  video.state = VideoState.TO_TRANSCODE

  await video.save()

  // Remove old HLS playlist video files
  const videoWithFiles = await VideoModel.loadWithFiles(video.id)

  const hlsPlaylist = videoWithFiles.getHLSPlaylist()
  await VideoFileModel.removeHLSFilesOfVideoId(hlsPlaylist.id)
  hlsPlaylist.VideoFiles = []

  let durationDone = false

  for (const playlistFile of playlistFiles) {
    const concatenatedTsFile = LiveManager.Instance.buildConcatenatedName(playlistFile)
    const concatenatedTsFilePath = join(replayDirectory, concatenatedTsFile)

    const probe = await ffprobePromise(concatenatedTsFilePath)
    const { audioStream } = await getAudioStream(concatenatedTsFilePath, probe)

    const { videoFileResolution, isPortraitMode } = await getVideoFileResolution(concatenatedTsFilePath, probe)

    const outputPath = await generateHlsPlaylistFromTS({
      video: videoWithFiles,
      concatenatedTsFilePath,
      resolution: videoFileResolution,
      isPortraitMode,
      isAAC: audioStream?.codec_name === 'aac'
    })

    if (!durationDone) {
      videoWithFiles.duration = await getDurationFromVideoFile(outputPath)
      await videoWithFiles.save()

      durationDone = true
    }
  }

  await remove(replayDirectory)

  // Regenerate the thumbnail & preview?
  if (videoWithFiles.getMiniature().automaticallyGenerated === true) {
    await generateVideoMiniature(videoWithFiles, videoWithFiles.getMaxQualityFile(), ThumbnailType.MINIATURE)
  }

  if (videoWithFiles.getPreview().automaticallyGenerated === true) {
    await generateVideoMiniature(videoWithFiles, videoWithFiles.getMaxQualityFile(), ThumbnailType.PREVIEW)
  }

  await publishAndFederateIfNeeded(videoWithFiles, true)
}

async function cleanupLiveFiles (hlsDirectory: string) {
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
