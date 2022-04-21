import { Job } from 'bull'
import { pathExists, readdir, remove } from 'fs-extra'
import { join } from 'path'
import { ffprobePromise, getAudioStream, getVideoStreamDimensionsInfo, getVideoStreamDuration } from '@server/helpers/ffmpeg'
import { getLocalVideoActivityPubUrl } from '@server/lib/activitypub/url'
import { federateVideoIfNeeded } from '@server/lib/activitypub/videos'
import { cleanupLive, LiveSegmentShaStore } from '@server/lib/live'
import {
  generateHLSMasterPlaylistFilename,
  generateHlsSha256SegmentsFilename,
  getLiveDirectory,
  getLiveReplayBaseDirectory
} from '@server/lib/paths'
import { generateVideoMiniature } from '@server/lib/thumbnail'
import { generateHlsPlaylistResolutionFromTS } from '@server/lib/transcoding/transcoding'
import { moveToNextState } from '@server/lib/video-state'
import { VideoModel } from '@server/models/video/video'
import { VideoFileModel } from '@server/models/video/video-file'
import { VideoLiveModel } from '@server/models/video/video-live'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist'
import { MVideo, MVideoLive, MVideoWithAllFiles } from '@server/types/models'
import { ThumbnailType, VideoLiveEndingPayload, VideoState } from '@shared/models'
import { logger } from '../../../helpers/logger'
import { VideoBlacklistModel } from '@server/models/video/video-blacklist'

async function processVideoLiveEnding (job: Job) {
  const payload = job.data as VideoLiveEndingPayload

  logger.info('Processing video live ending for %s.', payload.videoId, { payload })

  function logError () {
    logger.warn('Video live %d does not exist anymore. Cannot process live ending.', payload.videoId)
  }

  const video = await VideoModel.load(payload.videoId)
  const live = await VideoLiveModel.loadByVideoId(payload.videoId)

  if (!video || !live) {
    logError()
    return
  }

  LiveSegmentShaStore.Instance.cleanupShaSegments(video.uuid)

  if (live.saveReplay !== true) {
    return cleanupLiveAndFederate(video)
  }

  if (live.permanentLive) {
    await saveReplayToExternalVideo(video, payload.publishedAt, payload.replayDirectory)

    return cleanupLiveAndFederate(video)
  }

  return replaceLiveByReplay(video, live, payload.replayDirectory)
}

// ---------------------------------------------------------------------------

export {
  processVideoLiveEnding
}

// ---------------------------------------------------------------------------

async function saveReplayToExternalVideo (liveVideo: MVideo, publishedAt: string, replayDirectory: string) {
  await cleanupTMPLiveFiles(getLiveDirectory(liveVideo))

  const video = new VideoModel({
    name: `${liveVideo.name} - ${new Date(publishedAt).toLocaleString()}`,
    isLive: false,
    state: VideoState.TO_TRANSCODE,
    duration: 0,

    remote: liveVideo.remote,
    category: liveVideo.category,
    licence: liveVideo.licence,
    language: liveVideo.language,
    commentsEnabled: liveVideo.commentsEnabled,
    downloadEnabled: liveVideo.downloadEnabled,
    waitTranscoding: liveVideo.waitTranscoding,
    nsfw: liveVideo.nsfw,
    description: liveVideo.description,
    support: liveVideo.support,
    privacy: liveVideo.privacy,
    channelId: liveVideo.channelId
  }) as MVideoWithAllFiles

  video.Thumbnails = []
  video.VideoFiles = []
  video.VideoStreamingPlaylists = []

  video.url = getLocalVideoActivityPubUrl(video)

  await video.save()

  // If live is blacklisted, also blacklist the replay
  const blacklist = await VideoBlacklistModel.loadByVideoId(liveVideo.id)
  if (blacklist) {
    await VideoBlacklistModel.create({
      videoId: video.id,
      unfederated: blacklist.unfederated,
      reason: blacklist.reason,
      type: blacklist.type
    })
  }

  await assignReplaysToVideo(video, replayDirectory)

  await remove(replayDirectory)

  for (const type of [ ThumbnailType.MINIATURE, ThumbnailType.PREVIEW ]) {
    const image = await generateVideoMiniature({ video, videoFile: video.getMaxQualityFile(), type })
    await video.addAndSaveThumbnail(image)
  }

  await moveToNextState({ video, isNewVideo: true })
}

async function replaceLiveByReplay (video: MVideo, live: MVideoLive, replayDirectory: string) {
  await cleanupTMPLiveFiles(getLiveDirectory(video))

  await live.destroy()

  video.isLive = false
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

  await assignReplaysToVideo(videoWithFiles, replayDirectory)

  await remove(getLiveReplayBaseDirectory(videoWithFiles))

  // Regenerate the thumbnail & preview?
  if (videoWithFiles.getMiniature().automaticallyGenerated === true) {
    const miniature = await generateVideoMiniature({
      video: videoWithFiles,
      videoFile: videoWithFiles.getMaxQualityFile(),
      type: ThumbnailType.MINIATURE
    })
    await video.addAndSaveThumbnail(miniature)
  }

  if (videoWithFiles.getPreview().automaticallyGenerated === true) {
    const preview = await generateVideoMiniature({
      video: videoWithFiles,
      videoFile: videoWithFiles.getMaxQualityFile(),
      type: ThumbnailType.PREVIEW
    })
    await video.addAndSaveThumbnail(preview)
  }

  await moveToNextState({ video: videoWithFiles, isNewVideo: false })
}

async function assignReplaysToVideo (video: MVideo, replayDirectory: string) {
  let durationDone = false

  const concatenatedTsFiles = await readdir(replayDirectory)

  for (const concatenatedTsFile of concatenatedTsFiles) {
    const concatenatedTsFilePath = join(replayDirectory, concatenatedTsFile)

    const probe = await ffprobePromise(concatenatedTsFilePath)
    const { audioStream } = await getAudioStream(concatenatedTsFilePath, probe)

    const { resolution, isPortraitMode } = await getVideoStreamDimensionsInfo(concatenatedTsFilePath, probe)

    const { resolutionPlaylistPath: outputPath } = await generateHlsPlaylistResolutionFromTS({
      video,
      concatenatedTsFilePath,
      resolution,
      isPortraitMode,
      isAAC: audioStream?.codec_name === 'aac'
    })

    if (!durationDone) {
      video.duration = await getVideoStreamDuration(outputPath)
      await video.save()

      durationDone = true
    }
  }

  return video
}

async function cleanupLiveAndFederate (video: MVideo) {
  const streamingPlaylist = await VideoStreamingPlaylistModel.loadHLSPlaylistByVideo(video.id)
  await cleanupLive(video, streamingPlaylist)

  const fullVideo = await VideoModel.loadAndPopulateAccountAndServerAndTags(video.id)
  return federateVideoIfNeeded(fullVideo, false, undefined)
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
