import { UploadFiles } from 'express'
import { Transaction } from 'sequelize/types'
import { DEFAULT_AUDIO_RESOLUTION, JOB_PRIORITY } from '@server/initializers/constants'
import { sequelizeTypescript } from '@server/initializers/database'
import { TagModel } from '@server/models/video/tag'
import { VideoModel } from '@server/models/video/video'
import { FilteredModelAttributes } from '@server/types'
import { MThumbnail, MUserId, MVideo, MVideoFile, MVideoTag, MVideoThumbnail, MVideoUUID } from '@server/types/models'
import { ThumbnailType, VideoCreate, VideoPrivacy, VideoTranscodingPayload } from '@shared/models'
import { federateVideoIfNeeded } from './activitypub/videos'
import { JobQueue } from './job-queue/job-queue'
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

async function publishAndFederateIfNeeded (video: MVideoUUID, wasLive = false) {
  const result = await sequelizeTypescript.transaction(async t => {
    // Maybe the video changed in database, refresh it
    const videoDatabase = await VideoModel.loadAndPopulateAccountAndServerAndTags(video.uuid, t)
    // Video does not exist anymore
    if (!videoDatabase) return undefined

    // We transcoded the video file in another format, now we can publish it
    const videoPublished = await videoDatabase.publishIfNeededAndSave(t)

    // If the video was not published, we consider it is a new one for other instances
    // Live videos are always federated, so it's not a new video
    await federateVideoIfNeeded(videoDatabase, !wasLive && videoPublished, t)

    return { videoDatabase, videoPublished }
  })

  if (result?.videoPublished) {
    Notifier.Instance.notifyOnNewVideoIfNeeded(result.videoDatabase)
    Notifier.Instance.notifyOnVideoPublishedAfterTranscoding(result.videoDatabase)
  }
}

async function addOptimizeOrMergeAudioJob (video: MVideo, videoFile: MVideoFile, user: MUserId) {
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

  return JobQueue.Instance.createJobWithPromise({ type: 'video-transcoding', payload: dataInput }, jobOptions)
}

async function getTranscodingJobPriority (user: MUserId) {
  const now = new Date()
  const lastWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)

  const videoUploadedByUser = await VideoModel.countVideosUploadedByUserSince(user.id, lastWeek)

  return JOB_PRIORITY.TRANSCODING + videoUploadedByUser
}

// ---------------------------------------------------------------------------

export {
  buildLocalVideoFromReq,
  publishAndFederateIfNeeded,
  buildVideoThumbnailsFromReq,
  setVideoTags,
  addOptimizeOrMergeAudioJob,
  getTranscodingJobPriority
}
