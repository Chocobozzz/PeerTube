import { VideoBlacklistType, VideoChannelActivityAction, VideoDuplicatePayload, VideoPrivacy, VideoState } from '@peertube/peertube-models'
import { buildUUID } from '@peertube/peertube-node-utils'
import { runTransaction } from '@server/helpers/database-utils.js'
import { generateImageFilename } from '@server/helpers/image-utils.js'
import { createLogger } from '@server/helpers/logger.js'
import { getLocalVideoActivityPubUrl } from '@server/lib/activitypub/url.js'
import { auditLog, buildVideoAuditEntity, getAuditActorFromRes } from '@server/lib/audit-log/index.js'
import { JobQueue } from '@server/lib/job-queue/index.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { replaceChapters } from '@server/lib/video-chapters.js'
import { safeCleanupStudioTMPFiles } from '@server/lib/video-studio.js'
import { setVideoTags } from '@server/lib/video.js'
import { ThumbnailModel } from '@server/models/video/thumbnail.js'
import { VideoBlacklistModel } from '@server/models/video/video-blacklist.js'
import { VideoChannelActivityModel } from '@server/models/video/video-channel-activity.js'
import { VideoChapterModel } from '@server/models/video/video-chapter.js'
import { VideoModel } from '@server/models/video/video.js'
import { MThumbnail, MUserAccountId, MVideo, MVideoFull, MVideoId } from '@server/types/models/index.js'
import express from 'express'
import { Transaction } from 'sequelize'
import { extname } from 'path'
import { copyCommonFile, getInputFilenames } from './shared/copy-files.js'

const logger = createLogger('video-duplicate')

type StudioOptions = Pick<VideoDuplicatePayload['studio'], 'tasks' | 'taskFilesStaged'>

export async function createVideoDuplicate (options: {
  sourceVideo: MVideoFull
  user: MUserAccountId
  name: string
  studio?: StudioOptions
  req: express.Request
  res: express.Response
}) {
  const { sourceVideo, studio, req, res } = options

  let video: MVideoFull

  try {
    video = await createVideoWithoutFiles(options)

    try {
      await createDuplicateJob({ sourceVideo, video, studio })
    } catch (err) {
      await video.destroy()
        .catch(destroyErr => logger.error('Cannot remove duplicate %s without job.', video.uuid, { err: destroyErr }))

      throw err
    }
  } catch (err) {
    if (studio) await safeCleanupStudioTMPFiles(studio)

    throw err
  }

  await sourceVideo.VideoChannel.setAsUpdated()

  const videoFull = await VideoModel.loadFull(video.uuid)

  auditLog.create(getAuditActorFromRes(res), () => buildVideoAuditEntity(videoFull.toFormattedDetailsJSON()))
  Hooks.runAction('action:api.video.duplicated', { video: videoFull, sourceVideo, withStudioEdition: !!studio, req, res })

  return videoFull
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function createVideoWithoutFiles (options: {
  sourceVideo: MVideoFull
  user: MUserAccountId
  name: string
  studio?: StudioOptions
}) {
  const { sourceVideo, user, name, studio } = options
  const channel = sourceVideo.VideoChannel

  const videoData = await Hooks.wrapObject(
    {
      uuid: buildUUID(),
      name,
      state: VideoState.TO_DUPLICATE,
      remote: false,
      isLive: false,
      channelId: channel.id,

      // Don't publish the duplicate before the user reviewed it
      privacy: VideoPrivacy.PRIVATE,
      publishedAt: new Date(),

      category: sourceVideo.category,
      licence: sourceVideo.licence,
      language: sourceVideo.language,
      description: sourceVideo.description,
      support: sourceVideo.support,
      nsfw: sourceVideo.nsfw,
      nsfwSummary: sourceVideo.nsfwSummary,
      nsfwFlags: sourceVideo.nsfwFlags,
      commentsPolicy: sourceVideo.commentsPolicy,
      recommendationScope: sourceVideo.recommendationScope,
      downloadEnabled: sourceVideo.downloadEnabled,
      waitTranscoding: sourceVideo.waitTranscoding,
      embedPrivacyPolicy: sourceVideo.embedPrivacyPolicy,
      originallyPublishedAt: sourceVideo.originallyPublishedAt,
      aiUsage: sourceVideo.aiUsage,
      commercialContent: sourceVideo.commercialContent,
      duration: sourceVideo.duration,
      aspectRatio: sourceVideo.aspectRatio
    },
    'filter:api.video.duplicate.video-attribute.result',
    { sourceVideo, user, withStudioEdition: !!studio }
  )

  const video = new VideoModel(videoData) as MVideoFull
  video.VideoChannel = channel
  video.url = getLocalVideoActivityPubUrl(video)

  // Thumbnails are small: copy them now, so the duplicate has a thumbnail while it is processed
  const thumbnails: MThumbnail[] = []

  try {
    for (const sourceThumbnail of sourceVideo.Thumbnails) {
      const thumbnail = new ThumbnailModel({
        filename: generateImageFilename(extname(sourceThumbnail.filename)),
        width: sourceThumbnail.width,
        height: sourceThumbnail.height,
        aspectRatio: sourceThumbnail.aspectRatio,
        automaticallyGenerated: sourceThumbnail.automaticallyGenerated,
        storage: sourceThumbnail.storage,
        cached: false
      })

      await copyCommonFile({ type: 'thumbnails', source: sourceThumbnail, destination: thumbnail, isPrivate: false })
      thumbnails.push(thumbnail)
    }

    const chapters = await VideoChapterModel.listChaptersOfVideo(sourceVideo.id)

    await runTransaction(async transaction => {
      await video.save({ transaction })

      await video.replaceAndSaveThumbnails(thumbnails, transaction)
      await setVideoTags({ video, tags: sourceVideo.Tags.map(t => t.name), transaction })
      await replaceChapters({ video, chapters: chapters.map(c => ({ timecode: c.timecode, title: c.title })), transaction })
      await copyBlockIfNeeded({ sourceVideo, video, transaction })

      await VideoChannelActivityModel.addVideoActivity({
        action: VideoChannelActivityAction.CREATE,
        user,
        channel,
        video,
        transaction
      })
    })
  } catch (err) {
    for (const thumbnail of thumbnails) {
      await thumbnail.removeFile()
        .catch(removeErr => logger.error('Cannot remove thumbnail %s of the failed duplicate.', thumbnail.filename, { err: removeErr }))
    }

    throw err
  }

  return video
}

async function copyBlockIfNeeded (options: {
  sourceVideo: MVideoId
  video: MVideoId
  transaction: Transaction
}) {
  const { sourceVideo, video, transaction } = options

  const sourceBlock = await VideoBlacklistModel.loadByVideoId(sourceVideo.id, transaction)
  if (!sourceBlock || sourceBlock.type === VideoBlacklistType.AUTO_BY_AUTO_TAG_POLICY) return

  await VideoBlacklistModel.create({
    videoId: video.id,
    reason: sourceBlock.reason,
    internalNote: sourceBlock.internalNote,
    unfederated: sourceBlock.unfederated,
    type: sourceBlock.type
  }, { transaction })
}

function createDuplicateJob (options: {
  sourceVideo: MVideoFull
  video: MVideo
  studio: StudioOptions | undefined
}) {
  const { sourceVideo, video, studio } = options

  const payload: VideoDuplicatePayload = {
    videoUUID: video.uuid,
    sourceVideoUUID: sourceVideo.uuid,
    filesToCopy: studio
      ? 'max-quality'
      : 'all',
    studio: studio
      ? { ...studio, sourceFilenames: getInputFilenames(sourceVideo) }
      : undefined
  }

  // The duplicate job creates the studio edition at its end
  return JobQueue.Instance.createJob({ type: 'video-duplicate', payload })
}
