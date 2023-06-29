import { Job } from 'bullmq'
import { readdir, remove } from 'fs-extra'
import { join } from 'path'
import { peertubeTruncate } from '@server/helpers/core-utils'
import { CONSTRAINTS_FIELDS } from '@server/initializers/constants'
import { getLocalVideoActivityPubUrl } from '@server/lib/activitypub/url'
import { federateVideoIfNeeded } from '@server/lib/activitypub/videos'
import { cleanupAndDestroyPermanentLive, cleanupTMPLiveFiles, cleanupUnsavedNormalLive } from '@server/lib/live'
import { generateHLSMasterPlaylistFilename, generateHlsSha256SegmentsFilename, getLiveReplayBaseDirectory } from '@server/lib/paths'
import { generateLocalVideoMiniature } from '@server/lib/thumbnail'
import { generateHlsPlaylistResolutionFromTS } from '@server/lib/transcoding/hls-transcoding'
import { VideoPathManager } from '@server/lib/video-path-manager'
import { moveToNextState } from '@server/lib/video-state'
import { VideoModel } from '@server/models/video/video'
import { VideoBlacklistModel } from '@server/models/video/video-blacklist'
import { VideoFileModel } from '@server/models/video/video-file'
import { VideoLiveModel } from '@server/models/video/video-live'
import { VideoLiveReplaySettingModel } from '@server/models/video/video-live-replay-setting'
import { VideoLiveSessionModel } from '@server/models/video/video-live-session'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist'
import { MVideo, MVideoLive, MVideoLiveSession, MVideoWithAllFiles } from '@server/types/models'
import { ffprobePromise, getAudioStream, getVideoStreamDimensionsInfo, getVideoStreamFPS } from '@shared/ffmpeg'
import { ThumbnailType, VideoLiveEndingPayload, VideoState } from '@shared/models'
import { logger, loggerTagsFactory } from '../../../helpers/logger'
import { JobQueue } from '../job-queue'

const lTags = loggerTagsFactory('live', 'job')

async function processVideoLiveEnding (job: Job) {
  const payload = job.data as VideoLiveEndingPayload

  logger.info('Processing video live ending for %s.', payload.videoId, { payload, ...lTags() })

  function logError () {
    logger.warn('Video live %d does not exist anymore. Cannot process live ending.', payload.videoId, lTags())
  }

  const video = await VideoModel.load(payload.videoId)
  const live = await VideoLiveModel.loadByVideoId(payload.videoId)
  const liveSession = await VideoLiveSessionModel.load(payload.liveSessionId)

  if (!video || !live || !liveSession) {
    logError()
    return
  }

  const permanentLive = live.permanentLive

  liveSession.endingProcessed = true
  await liveSession.save()

  if (liveSession.saveReplay !== true) {
    return cleanupLiveAndFederate({ permanentLive, video, streamingPlaylistId: payload.streamingPlaylistId })
  }

  if (permanentLive) {
    await saveReplayToExternalVideo({
      liveVideo: video,
      liveSession,
      publishedAt: payload.publishedAt,
      replayDirectory: payload.replayDirectory
    })

    return cleanupLiveAndFederate({ permanentLive, video, streamingPlaylistId: payload.streamingPlaylistId })
  }

  return replaceLiveByReplay({
    video,
    liveSession,
    live,
    permanentLive,
    replayDirectory: payload.replayDirectory
  })
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

  const replaySettings = await VideoLiveReplaySettingModel.load(liveSession.replaySettingId)

  const videoNameSuffix = ` - ${new Date(publishedAt).toLocaleString()}`
  const truncatedVideoName = peertubeTruncate(liveVideo.name, {
    length: CONSTRAINTS_FIELDS.VIDEOS.NAME.max - videoNameSuffix.length
  })

  const replayVideo = new VideoModel({
    name: truncatedVideoName + videoNameSuffix,
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
    privacy: replaySettings.privacy,
    channelId: liveVideo.channelId
  }) as MVideoWithAllFiles

  replayVideo.Thumbnails = []
  replayVideo.VideoFiles = []
  replayVideo.VideoStreamingPlaylists = []

  replayVideo.url = getLocalVideoActivityPubUrl(replayVideo)

  await replayVideo.save()

  liveSession.replayVideoId = replayVideo.id
  await liveSession.save()

  // If live is blacklisted, also blacklist the replay
  const blacklist = await VideoBlacklistModel.loadByVideoId(liveVideo.id)
  if (blacklist) {
    await VideoBlacklistModel.create({
      videoId: replayVideo.id,
      unfederated: blacklist.unfederated,
      reason: blacklist.reason,
      type: blacklist.type
    })
  }

  await assignReplayFilesToVideo({ video: replayVideo, replayDirectory })

  await remove(replayDirectory)

  for (const type of [ ThumbnailType.MINIATURE, ThumbnailType.PREVIEW ]) {
    const image = await generateLocalVideoMiniature({ video: replayVideo, videoFile: replayVideo.getMaxQualityFile(), type })
    await replayVideo.addAndSaveThumbnail(image)
  }

  await moveToNextState({ video: replayVideo, isNewVideo: true })

  await createStoryboardJob(replayVideo)
}

async function replaceLiveByReplay (options: {
  video: MVideo
  liveSession: MVideoLiveSession
  live: MVideoLive
  permanentLive: boolean
  replayDirectory: string
}) {
  const { video, liveSession, live, permanentLive, replayDirectory } = options

  const replaySettings = await VideoLiveReplaySettingModel.load(liveSession.replaySettingId)
  const videoWithFiles = await VideoModel.loadFull(video.id)
  const hlsPlaylist = videoWithFiles.getHLSPlaylist()

  await cleanupTMPLiveFiles(videoWithFiles, hlsPlaylist)

  await live.destroy()

  videoWithFiles.isLive = false
  videoWithFiles.privacy = replaySettings.privacy
  videoWithFiles.waitTranscoding = true
  videoWithFiles.state = VideoState.TO_TRANSCODE

  await videoWithFiles.save()

  liveSession.replayVideoId = videoWithFiles.id
  await liveSession.save()

  await VideoFileModel.removeHLSFilesOfVideoId(hlsPlaylist.id)

  // Reset playlist
  hlsPlaylist.VideoFiles = []
  hlsPlaylist.playlistFilename = generateHLSMasterPlaylistFilename()
  hlsPlaylist.segmentsSha256Filename = generateHlsSha256SegmentsFilename()
  await hlsPlaylist.save()

  await assignReplayFilesToVideo({ video: videoWithFiles, replayDirectory })

  // FIXME: should not happen in this function
  if (permanentLive) { // Remove session replay
    await remove(replayDirectory)
  } else { // We won't stream again in this live, we can delete the base replay directory
    await remove(getLiveReplayBaseDirectory(videoWithFiles))
  }

  // Regenerate the thumbnail & preview?
  if (videoWithFiles.getMiniature().automaticallyGenerated === true) {
    const miniature = await generateLocalVideoMiniature({
      video: videoWithFiles,
      videoFile: videoWithFiles.getMaxQualityFile(),
      type: ThumbnailType.MINIATURE
    })
    await videoWithFiles.addAndSaveThumbnail(miniature)
  }

  if (videoWithFiles.getPreview().automaticallyGenerated === true) {
    const preview = await generateLocalVideoMiniature({
      video: videoWithFiles,
      videoFile: videoWithFiles.getMaxQualityFile(),
      type: ThumbnailType.PREVIEW
    })
    await videoWithFiles.addAndSaveThumbnail(preview)
  }

  // We consider this is a new video
  await moveToNextState({ video: videoWithFiles, isNewVideo: true })

  await createStoryboardJob(videoWithFiles)
}

async function assignReplayFilesToVideo (options: {
  video: MVideo
  replayDirectory: string
}) {
  const { video, replayDirectory } = options

  const concatenatedTsFiles = await readdir(replayDirectory)

  for (const concatenatedTsFile of concatenatedTsFiles) {
    const inputFileMutexReleaser = await VideoPathManager.Instance.lockFiles(video.uuid)
    await video.reload()

    const concatenatedTsFilePath = join(replayDirectory, concatenatedTsFile)

    const probe = await ffprobePromise(concatenatedTsFilePath)
    const { audioStream } = await getAudioStream(concatenatedTsFilePath, probe)
    const { resolution } = await getVideoStreamDimensionsInfo(concatenatedTsFilePath, probe)
    const fps = await getVideoStreamFPS(concatenatedTsFilePath, probe)

    try {
      await generateHlsPlaylistResolutionFromTS({
        video,
        inputFileMutexReleaser,
        concatenatedTsFilePath,
        resolution,
        fps,
        isAAC: audioStream?.codec_name === 'aac'
      })
    } catch (err) {
      logger.error('Cannot generate HLS playlist resolution from TS files.', { err })
    }

    inputFileMutexReleaser()
  }

  return video
}

async function cleanupLiveAndFederate (options: {
  video: MVideo
  permanentLive: boolean
  streamingPlaylistId: number
}) {
  const { permanentLive, video, streamingPlaylistId } = options

  const streamingPlaylist = await VideoStreamingPlaylistModel.loadWithVideo(streamingPlaylistId)

  if (streamingPlaylist) {
    if (permanentLive) {
      await cleanupAndDestroyPermanentLive(video, streamingPlaylist)
    } else {
      await cleanupUnsavedNormalLive(video, streamingPlaylist)
    }
  }

  try {
    const fullVideo = await VideoModel.loadFull(video.id)
    return federateVideoIfNeeded(fullVideo, false, undefined)
  } catch (err) {
    logger.warn('Cannot federate live after cleanup', { videoId: video.id, err })
  }
}

function createStoryboardJob (video: MVideo) {
  return JobQueue.Instance.createJob({
    type: 'generate-video-storyboard' as 'generate-video-storyboard',
    payload: {
      videoUUID: video.uuid,
      federate: true
    }
  })
}
