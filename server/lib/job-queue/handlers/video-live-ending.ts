import { Job } from 'bull'
import { readdir, remove } from 'fs-extra'
import { join } from 'path'
import { ffprobePromise, getAudioStream, getVideoStreamDimensionsInfo, getVideoStreamDuration } from '@server/helpers/ffmpeg'
import { getLocalVideoActivityPubUrl } from '@server/lib/activitypub/url'
import { federateVideoIfNeeded } from '@server/lib/activitypub/videos'
import { cleanupUnsavedNormalLive, cleanupPermanentLive, cleanupTMPLiveFiles, LiveSegmentShaStore } from '@server/lib/live'
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
import { VideoBlacklistModel } from '@server/models/video/video-blacklist'
import { VideoFileModel } from '@server/models/video/video-file'
import { VideoLiveModel } from '@server/models/video/video-live'
import { VideoLiveSessionModel } from '@server/models/video/video-live-session'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist'
import { MVideo, MVideoLive, MVideoLiveSession, MVideoWithAllFiles } from '@server/types/models'
import { ThumbnailType, VideoLiveEndingPayload, VideoState } from '@shared/models'
import { logger, loggerTagsFactory } from '../../../helpers/logger'

const lTags = loggerTagsFactory('live', 'job')

async function processVideoLiveEnding (job: Job) {
  const payload = job.data as VideoLiveEndingPayload

  logger.info('Processing video live ending for %s.', payload.videoId, { payload, ...lTags() })

  function logError () {
    logger.warn('Video live %d does not exist anymore. Cannot process live ending.', payload.videoId, lTags())
  }

  const liveVideo = await VideoModel.load(payload.videoId)
  const live = await VideoLiveModel.loadByVideoId(payload.videoId)
  const liveSession = await VideoLiveSessionModel.load(payload.liveSessionId)

  if (!liveVideo || !live || !liveSession) {
    logError()
    return
  }

  LiveSegmentShaStore.Instance.cleanupShaSegments(liveVideo.uuid)

  if (live.saveReplay !== true) {
    return cleanupLiveAndFederate({ live, video: liveVideo, streamingPlaylistId: payload.streamingPlaylistId })
  }

  if (live.permanentLive) {
    await saveReplayToExternalVideo({ liveVideo, liveSession, publishedAt: payload.publishedAt, replayDirectory: payload.replayDirectory })

    return cleanupLiveAndFederate({ live, video: liveVideo, streamingPlaylistId: payload.streamingPlaylistId })
  }

  return replaceLiveByReplay({ liveVideo, live, liveSession, replayDirectory: payload.replayDirectory })
}

// ---------------------------------------------------------------------------

export {
  processVideoLiveEnding
}

// ---------------------------------------------------------------------------

async function saveReplayToExternalVideo (options: {
  liveVideo: MVideo
  liveSession: MVideoLiveSession
  publishedAt: string
  replayDirectory: string
}) {
  const { liveVideo, liveSession, publishedAt, replayDirectory } = options

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
    waitTranscoding: true,
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

  liveSession.replayVideoId = video.id
  await liveSession.save()

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

  await assignReplayFilesToVideo({ video, replayDirectory })

  await remove(replayDirectory)

  for (const type of [ ThumbnailType.MINIATURE, ThumbnailType.PREVIEW ]) {
    const image = await generateVideoMiniature({ video, videoFile: video.getMaxQualityFile(), type })
    await video.addAndSaveThumbnail(image)
  }

  await moveToNextState({ video, isNewVideo: true })
}

async function replaceLiveByReplay (options: {
  liveVideo: MVideo
  liveSession: MVideoLiveSession
  live: MVideoLive
  replayDirectory: string
}) {
  const { liveVideo, liveSession, live, replayDirectory } = options

  await cleanupTMPLiveFiles(getLiveDirectory(liveVideo))

  await live.destroy()

  liveVideo.isLive = false
  liveVideo.waitTranscoding = true
  liveVideo.state = VideoState.TO_TRANSCODE

  await liveVideo.save()

  liveSession.replayVideoId = liveVideo.id
  await liveSession.save()

  // Remove old HLS playlist video files
  const videoWithFiles = await VideoModel.loadAndPopulateAccountAndServerAndTags(liveVideo.id)

  const hlsPlaylist = videoWithFiles.getHLSPlaylist()
  await VideoFileModel.removeHLSFilesOfVideoId(hlsPlaylist.id)

  // Reset playlist
  hlsPlaylist.VideoFiles = []
  hlsPlaylist.playlistFilename = generateHLSMasterPlaylistFilename()
  hlsPlaylist.segmentsSha256Filename = generateHlsSha256SegmentsFilename()
  await hlsPlaylist.save()

  await assignReplayFilesToVideo({ video: videoWithFiles, replayDirectory })

  if (live.permanentLive) { // Remove session replay
    await remove(replayDirectory)
  } else { // We won't stream again in this live, we can delete the base replay directory
    await remove(getLiveReplayBaseDirectory(videoWithFiles))
  }

  // Regenerate the thumbnail & preview?
  if (videoWithFiles.getMiniature().automaticallyGenerated === true) {
    const miniature = await generateVideoMiniature({
      video: videoWithFiles,
      videoFile: videoWithFiles.getMaxQualityFile(),
      type: ThumbnailType.MINIATURE
    })
    await videoWithFiles.addAndSaveThumbnail(miniature)
  }

  if (videoWithFiles.getPreview().automaticallyGenerated === true) {
    const preview = await generateVideoMiniature({
      video: videoWithFiles,
      videoFile: videoWithFiles.getMaxQualityFile(),
      type: ThumbnailType.PREVIEW
    })
    await videoWithFiles.addAndSaveThumbnail(preview)
  }

  // We consider this is a new video
  await moveToNextState({ video: videoWithFiles, isNewVideo: true })
}

async function assignReplayFilesToVideo (options: {
  video: MVideo
  replayDirectory: string
}) {
  const { video, replayDirectory } = options

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

async function cleanupLiveAndFederate (options: {
  live: MVideoLive
  video: MVideo
  streamingPlaylistId: number
}) {
  const { live, video, streamingPlaylistId } = options

  const streamingPlaylist = await VideoStreamingPlaylistModel.loadWithVideo(streamingPlaylistId)

  if (streamingPlaylist) {
    if (live.permanentLive) {
      await cleanupPermanentLive(video, streamingPlaylist)
    } else {
      await cleanupUnsavedNormalLive(video, streamingPlaylist)
    }
  }

  try {
    const fullVideo = await VideoModel.loadAndPopulateAccountAndServerAndTags(video.id)
    return federateVideoIfNeeded(fullVideo, false, undefined)
  } catch (err) {
    logger.warn('Cannot federate live after cleanup', { videoId: video.id, err })
  }
}
