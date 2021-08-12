import { UploadFiles } from 'express'
import { Transaction } from 'sequelize/types'
import { logger } from '@server/helpers/logger'
import { CONFIG } from '@server/initializers/config'
import { DEFAULT_AUDIO_RESOLUTION, JOB_PRIORITY } from '@server/initializers/constants'
import { sequelizeTypescript } from '@server/initializers/database'
import { TagModel } from '@server/models/video/tag'
import { VideoModel } from '@server/models/video/video'
import { VideoJobInfoModel } from '@server/models/video/video-job-info'
import { FilteredModelAttributes } from '@server/types'
import { MThumbnail, MUserId, MVideoFile, MVideoTag, MVideoThumbnail, MVideoUUID } from '@server/types/models'
import { ThumbnailType, VideoCreate, VideoPrivacy, VideoState, VideoTranscodingPayload } from '@shared/models'
import { federateVideoIfNeeded } from './activitypub/videos'
import { CreateJobOptions, JobQueue } from './job-queue/job-queue'
import { Notifier } from './notifier'
import { updateVideoMiniatureFromExisting } from './thumbnail'

function buildLocalVideoFromReq (videoInfo: VideoCreate, channelId: number): FilteredModelAttributes<VideoModel> {
  return {
    name: videoInfo.name,
    remote: false,
    category: videoInfo.category,
    licence: videoInfo.licence,
    language: videoInfo.language,
    commentsEnabled: videoInfo.commentsEnabled !== false, // If the value is not "false", the default is "true"
    downloadEnabled: videoInfo.downloadEnabled !== false,
    waitTranscoding: videoInfo.waitTranscoding || false,
    nsfw: videoInfo.nsfw || false,
    description: videoInfo.description,
    support: videoInfo.support,
    privacy: videoInfo.privacy || VideoPrivacy.PRIVATE,
    channelId: channelId,
    originallyPublishedAt: videoInfo.originallyPublishedAt
      ? new Date(videoInfo.originallyPublishedAt)
      : null
  }
}

async function buildVideoThumbnailsFromReq (options: {
  video: MVideoThumbnail
  files: UploadFiles
  fallback: (type: ThumbnailType) => Promise<MThumbnail>
  automaticallyGenerated?: boolean
}) {
  const { video, files, fallback, automaticallyGenerated } = options

  const promises = [
    {
      type: ThumbnailType.MINIATURE,
      fieldName: 'thumbnailfile'
    },
    {
      type: ThumbnailType.PREVIEW,
      fieldName: 'previewfile'
    }
  ].map(p => {
    const fields = files?.[p.fieldName]

    if (fields) {
      return updateVideoMiniatureFromExisting({
        inputPath: fields[0].path,
        video,
        type: p.type,
        automaticallyGenerated: automaticallyGenerated || false
      })
    }

    return fallback(p.type)
  })

  return Promise.all(promises)
}

async function setVideoTags (options: {
  video: MVideoTag
  tags: string[]
  transaction?: Transaction
}) {
  const { video, tags, transaction } = options

  const internalTags = tags || []
  const tagInstances = await TagModel.findOrCreateTags(internalTags, transaction)

  await video.$set('Tags', tagInstances, { transaction })
  video.Tags = tagInstances
}

function moveToNextState (video: MVideoUUID, isNewVideo = true) {
  return sequelizeTypescript.transaction(async t => {
    // Maybe the video changed in database, refresh it
    const videoDatabase = await VideoModel.loadAndPopulateAccountAndServerAndTags(video.uuid, t)
    // Video does not exist anymore
    if (!videoDatabase) return undefined

    const previousState = videoDatabase.state

    // Already in its final state
    if (previousState === VideoState.PUBLISHED) return

    const newState = buildNextVideoState(previousState)

    if (newState === VideoState.PUBLISHED) {
      logger.info('Publishing video %s.', video.uuid, { tags: [ video.uuid ] })

      await videoDatabase.setNewState(newState, t)

      // If the video was not published, we consider it is a new one for other instances
      // Live videos are always federated, so it's not a new video
      await federateVideoIfNeeded(videoDatabase, isNewVideo, t)

      Notifier.Instance.notifyOnNewVideoIfNeeded(videoDatabase)

      if (previousState === VideoState.TO_TRANSCODE) {
        Notifier.Instance.notifyOnVideoPublishedAfterTranscoding(videoDatabase)
      }

      return
    }

    if (newState === VideoState.TO_MOVE_TO_EXTERNAL_STORAGE) {
      const videoJobInfo = await VideoJobInfoModel.load(videoDatabase.id, t)
      const pendingTranscoding = videoJobInfo?.pendingTranscoding || 0

      // We want to wait all transcoding jobs before moving the video on an external storage
      if (pendingTranscoding !== 0) return

      await videoDatabase.setNewState(newState, t)

      logger.info('Creating external storage move job for video %s.', video.uuid, { tags: [ video.uuid ] })

      addMoveToObjectStorageJob(video)
        .catch(err => logger.error('Cannot add move to object storage job', { err }))
    }
  })
}

async function addOptimizeOrMergeAudioJob (video: MVideoUUID, videoFile: MVideoFile, user: MUserId) {
  let dataInput: VideoTranscodingPayload

  if (videoFile.isAudio()) {
    dataInput = {
      type: 'merge-audio-to-webtorrent',
      resolution: DEFAULT_AUDIO_RESOLUTION,
      videoUUID: video.uuid,
      isNewVideo: true
    }
  } else {
    dataInput = {
      type: 'optimize-to-webtorrent',
      videoUUID: video.uuid,
      isNewVideo: true
    }
  }

  const jobOptions = {
    priority: await getTranscodingJobPriority(user)
  }

  return addTranscodingJob(dataInput, jobOptions)
}

async function addTranscodingJob (payload: VideoTranscodingPayload, options: CreateJobOptions) {
  await VideoJobInfoModel.increaseOrCreate(payload.videoUUID, 'pendingTranscoding')

  return JobQueue.Instance.createJobWithPromise({ type: 'video-transcoding', payload: payload }, options)
}

async function addMoveToObjectStorageJob (video: MVideoUUID) {
  await VideoJobInfoModel.increaseOrCreate(video.uuid, 'pendingMove')

  const dataInput = { videoUUID: video.uuid }
  return JobQueue.Instance.createJobWithPromise({ type: 'move-to-object-storage', payload: dataInput })
}

async function getTranscodingJobPriority (user: MUserId) {
  const now = new Date()
  const lastWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)

  const videoUploadedByUser = await VideoModel.countVideosUploadedByUserSince(user.id, lastWeek)

  return JOB_PRIORITY.TRANSCODING + videoUploadedByUser
}

function buildNextVideoState (currentState?: VideoState) {
  if (currentState === VideoState.PUBLISHED) {
    throw new Error('Video is already in its final state')
  }

  if (
    currentState !== VideoState.TO_TRANSCODE &&
    currentState !== VideoState.TO_MOVE_TO_EXTERNAL_STORAGE &&
    CONFIG.TRANSCODING.ENABLED
  ) {
    return VideoState.TO_TRANSCODE
  }

  if (
    currentState !== VideoState.TO_MOVE_TO_EXTERNAL_STORAGE &&
    CONFIG.OBJECT_STORAGE.ENABLED
  ) {
    return VideoState.TO_MOVE_TO_EXTERNAL_STORAGE
  }

  return VideoState.PUBLISHED
}

// ---------------------------------------------------------------------------

export {
  buildLocalVideoFromReq,
  buildVideoThumbnailsFromReq,
  setVideoTags,
  moveToNextState,
  addOptimizeOrMergeAudioJob,
  buildNextVideoState,
  addTranscodingJob,
  addMoveToObjectStorageJob,
  getTranscodingJobPriority
}
