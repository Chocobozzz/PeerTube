import { Job } from 'bull'
import { pathExists, readdir, remove } from 'fs-extra'
import { join } from 'path'
import { ffprobePromise, getAudioStream, getDurationFromVideoFile, getVideoFileResolution } from '@server/helpers/ffprobe-utils'
import { VIDEO_LIVE } from '@server/initializers/constants'
import { buildConcatenatedName, cleanupLive, LiveSegmentShaStore } from '@server/lib/live'
import { generateHLSMasterPlaylistFilename, generateHlsSha256SegmentsFilename, getLiveDirectory } from '@server/lib/paths'
import { generateVideoMiniature } from '@server/lib/thumbnail'
import { generateHlsPlaylistResolutionFromTS } from '@server/lib/transcoding/video-transcoding'
import { VideoPathManager } from '@server/lib/video-path-manager'
import { moveToNextState } from '@server/lib/video-state'
import { VideoModel } from '@server/models/video/video'
import { VideoFileModel } from '@server/models/video/video-file'
import { VideoLiveModel } from '@server/models/video/video-live'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist'
import { MStreamingPlaylist, MVideo, MVideoLive } from '@server/types/models'
import { ThumbnailType, VideoLiveEndingPayload, VideoState } from '@shared/models'
import { logger } from '../../../helpers/logger'

async function processVideoLiveEnding (job: Job) {
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

  LiveSegmentShaStore.Instance.cleanupShaSegments(video.uuid)

  if (live.saveReplay !== true) {
    return cleanupLive(video, streamingPlaylist)
  }

  return saveLive(video, live, streamingPlaylist)
}

// ---------------------------------------------------------------------------

export {
  processVideoLiveEnding
}

// ---------------------------------------------------------------------------

async function saveLive (video: MVideo, live: MVideoLive, streamingPlaylist: MStreamingPlaylist) {
  const replayDirectory = VideoPathManager.Instance.getFSHLSOutputPath(video, VIDEO_LIVE.REPLAY_DIRECTORY)

  const rootFiles = await readdir(getLiveDirectory(video))

  const playlistFiles = rootFiles.filter(file => {
    return file.endsWith('.m3u8') && file !== streamingPlaylist.playlistFilename
  })

  await cleanupTMPLiveFiles(getLiveDirectory(video))

  await live.destroy()

  video.isLive = false
  // Reinit views
  video.views = 0
  video.state = VideoState.TO_TRANSCODE

  await video.save()

  // Remove old HLS playlist video files
  const videoWithFiles = await VideoModel.loadAndPopulateAccountAndServerAndTags(video.id)

  const hlsPlaylist = videoWithFiles.getHLSPlaylist()
  await VideoFileModel.removeHLSFilesOfVideoId(hlsPlaylist.id)

  // Reset playlist
  hlsPlaylist.VideoFiles = []
  hlsPlaylist.playlistFilename = generateHLSMasterPlaylistFilename()
  hlsPlaylist.segmentsSha256Filename = generateHlsSha256SegmentsFilename()
  await hlsPlaylist.save()

  let durationDone = false

  for (const playlistFile of playlistFiles) {
    const concatenatedTsFile = buildConcatenatedName(playlistFile)
    const concatenatedTsFilePath = join(replayDirectory, concatenatedTsFile)

    const probe = await ffprobePromise(concatenatedTsFilePath)
    const { audioStream } = await getAudioStream(concatenatedTsFilePath, probe)

    const { resolution, isPortraitMode } = await getVideoFileResolution(concatenatedTsFilePath, probe)

    const { resolutionPlaylistPath: outputPath } = await generateHlsPlaylistResolutionFromTS({
      video: videoWithFiles,
      concatenatedTsFilePath,
      resolution,
      isPortraitMode,
      isAAC: audioStream?.codec_name === 'aac',
      videoPlaylistId: hlsPlaylist.id
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
    await generateVideoMiniature({
      video: videoWithFiles,
      videoFile: videoWithFiles.getMaxQualityFile(),
      type: ThumbnailType.MINIATURE
    })
  }

  if (videoWithFiles.getPreview().automaticallyGenerated === true) {
    await generateVideoMiniature({
      video: videoWithFiles,
      videoFile: videoWithFiles.getMaxQualityFile(),
      type: ThumbnailType.PREVIEW
    })
  }

  await moveToNextState(videoWithFiles, false)
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
