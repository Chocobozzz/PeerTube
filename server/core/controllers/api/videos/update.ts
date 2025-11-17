import { forceNumber } from '@peertube/peertube-core-utils'
import {
  HttpStatusCode,
  NSFWFlag,
  ThumbnailType,
  VideoChannelActivityAction,
  VideoPrivacy,
  VideoPrivacyType,
  VideoUpdate
} from '@peertube/peertube-models'
import { exists } from '@server/helpers/custom-validators/misc.js'
import { changeVideoChannelShare } from '@server/lib/activitypub/share.js'
import { isNewVideoPrivacyForFederation, isPrivacyForFederation } from '@server/lib/activitypub/videos/federate.js'
import { AutomaticTagger } from '@server/lib/automatic-tags/automatic-tagger.js'
import { setAndSaveVideoAutomaticTags } from '@server/lib/automatic-tags/automatic-tags.js'
import { updateLocalVideoMiniatureFromExisting } from '@server/lib/thumbnail.js'
import { replaceChaptersFromDescriptionIfNeeded } from '@server/lib/video-chapters.js'
import { addVideoJobsAfterUpdate } from '@server/lib/video-jobs.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { setVideoPrivacy } from '@server/lib/video-privacy.js'
import { setVideoTags } from '@server/lib/video.js'
import { openapiOperationDoc } from '@server/middlewares/doc.js'
import { VideoChannelActivityModel } from '@server/models/video/video-channel-activity.js'
import { VideoPasswordModel } from '@server/models/video/video-password.js'
import { FilteredModelAttributes } from '@server/types/index.js'
import { MVideoFullLight, MVideoThumbnail } from '@server/types/models/index.js'
import express, { UploadFiles } from 'express'
import { Transaction } from 'sequelize'
import { VideoAuditView, auditLoggerFactory, getAuditIdFromRes } from '../../../helpers/audit-logger.js'
import { resetSequelizeInstance } from '../../../helpers/database-utils.js'
import { createReqFiles } from '../../../helpers/express-utils.js'
import { logger, loggerTagsFactory } from '../../../helpers/logger.js'
import { MIMETYPES } from '../../../initializers/constants.js'
import { sequelizeTypescript } from '../../../initializers/database.js'
import { Hooks } from '../../../lib/plugins/hooks.js'
import { autoBlacklistVideoIfNeeded } from '../../../lib/video-blacklist.js'
import { asyncMiddleware, asyncRetryTransactionMiddleware, authenticate, videosUpdateValidator } from '../../../middlewares/index.js'
import { ScheduleVideoUpdateModel } from '../../../models/video/schedule-video-update.js'
import { VideoModel } from '../../../models/video/video.js'

const lTags = loggerTagsFactory('api', 'video')
const auditLogger = auditLoggerFactory('videos')
const updateRouter = express.Router()

const reqVideoFileUpdate = createReqFiles([ 'thumbnailfile', 'previewfile' ], MIMETYPES.IMAGE.MIMETYPE_EXT)

updateRouter.put(
  '/:id',
  openapiOperationDoc({ operationId: 'putVideo' }),
  authenticate,
  reqVideoFileUpdate,
  asyncMiddleware(videosUpdateValidator),
  asyncRetryTransactionMiddleware(updateVideo)
)

// ---------------------------------------------------------------------------

export {
  updateRouter
}

// ---------------------------------------------------------------------------

async function updateVideo (req: express.Request, res: express.Response) {
  const videoFromReq = res.locals.videoAll
  const oldVideoAuditView = new VideoAuditView(videoFromReq.toFormattedDetailsJSON())
  const body: VideoUpdate = req.body
  const user = res.locals.oauth.token.User

  const hadPrivacyForFederation = isPrivacyForFederation(videoFromReq.privacy)
  const oldPrivacy = videoFromReq.privacy

  const thumbnails = await buildVideoThumbnailsFromReq(videoFromReq, req.files)
  const videoFileLockReleaser = await VideoPathManager.Instance.lockFiles(videoFromReq.uuid)

  try {
    const { videoInstanceUpdated, isNewVideoForFederation } = await sequelizeTypescript.transaction(async t => {
      // Refresh video since thumbnails to prevent concurrent updates
      const video = await VideoModel.loadFull(videoFromReq.id, t)

      const oldName = video.name
      const oldDescription = video.description
      const oldVideoChannel = video.VideoChannel

      const keysToUpdate: (keyof VideoUpdate & FilteredModelAttributes<VideoModel>)[] = [
        'name',
        'category',
        'licence',
        'language',
        'nsfw',
        'nsfwFlags',
        'nsfwSummary',
        'waitTranscoding',
        'support',
        'description',
        'downloadEnabled'
      ]

      for (const key of keysToUpdate) {
        if (body[key] !== undefined) video.set(key, body[key])
      }

      if (!video.nsfw) {
        video.nsfwFlags = NSFWFlag.NONE
        video.nsfwSummary = null
      }

      if (body.commentsPolicy !== undefined) {
        video.commentsPolicy = body.commentsPolicy
      }

      if (body.originallyPublishedAt !== undefined) {
        video.originallyPublishedAt = body.originallyPublishedAt
          ? new Date(body.originallyPublishedAt)
          : null
      }

      // Privacy update?
      let isNewVideoForFederation = false

      if (body.privacy !== undefined) {
        isNewVideoForFederation = await updateVideoPrivacy({
          videoInstance: video,
          videoInfoToUpdate: body,
          hadPrivacyForFederation,
          transaction: t
        })
      }

      // Force updatedAt attribute change
      if (!video.changed()) {
        await video.setAsRefreshed(t)
      }

      const videoInstanceUpdated = await video.save({ transaction: t }) as MVideoFullLight

      // Thumbnail & preview updates?
      for (const thumbnail of thumbnails) {
        await videoInstanceUpdated.addAndSaveThumbnail(thumbnail, t)
      }

      // Video tags update?
      if (body.tags !== undefined) {
        await setVideoTags({ video: videoInstanceUpdated, tags: body.tags, transaction: t })
      }

      // Video channel update?
      const newChannel = res.locals.videoChannel
      if (newChannel && videoInstanceUpdated.channelId !== newChannel.id) {
        const oldChannel = videoInstanceUpdated.VideoChannel

        await VideoChannelActivityModel.addVideoActivity({
          action: VideoChannelActivityAction.REMOVE_CHANNEL_OWNERSHIP,
          user,
          channel: oldChannel,
          video: videoInstanceUpdated,
          transaction: t
        })

        await VideoChannelActivityModel.addVideoActivity({
          action: VideoChannelActivityAction.CREATE_CHANNEL_OWNERSHIP,
          user,
          channel: newChannel,
          video: videoInstanceUpdated,
          transaction: t
        })

        await videoInstanceUpdated.$set('VideoChannel', newChannel, { transaction: t })
        videoInstanceUpdated.VideoChannel = newChannel

        if (hadPrivacyForFederation === true) {
          await changeVideoChannelShare(videoInstanceUpdated, oldVideoChannel, t)
        }
      } else {
        await VideoChannelActivityModel.addVideoActivity({
          action: VideoChannelActivityAction.UPDATE,
          user: res.locals.oauth.token.User,
          channel: videoInstanceUpdated.VideoChannel,
          video: videoInstanceUpdated,
          transaction: t
        })
      }

      // Schedule an update in the future?
      await updateSchedule(videoInstanceUpdated, body, t)

      if (oldDescription !== video.description) {
        await replaceChaptersFromDescriptionIfNeeded({
          newDescription: videoInstanceUpdated.description,
          transaction: t,
          video,
          oldDescription
        })
      }

      if (oldName !== video.name || oldDescription !== video.description) {
        const automaticTags = await new AutomaticTagger().buildVideoAutomaticTags({ video, transaction: t })
        await setAndSaveVideoAutomaticTags({ video, automaticTags, transaction: t })
      }

      await autoBlacklistVideoIfNeeded({
        video: videoInstanceUpdated,
        user,
        isRemote: false,
        isNew: false,
        isNewFile: false,
        transaction: t
      })

      auditLogger.update(
        getAuditIdFromRes(res),
        new VideoAuditView(videoInstanceUpdated.toFormattedDetailsJSON()),
        oldVideoAuditView
      )
      logger.info('Video with name %s and uuid %s updated.', video.name, video.uuid, lTags(video.uuid))

      return { videoInstanceUpdated, isNewVideoForFederation }
    })

    Hooks.runAction('action:api.video.updated', { video: videoInstanceUpdated, body: req.body, req, res })

    await addVideoJobsAfterUpdate({
      video: videoInstanceUpdated,
      nameChanged: !!body.name,
      oldPrivacy,
      isNewVideoForFederation
    })
  } catch (err) {
    // If the transaction is retried, sequelize will think the object has not changed
    // So we need to restore the previous fields
    await resetSequelizeInstance(videoFromReq)

    throw err
  } finally {
    videoFileLockReleaser()
  }

  return res.type('json')
    .status(HttpStatusCode.NO_CONTENT_204)
    .end()
}

// Return a boolean indicating if the video is considered as "new" for remote instances in the federation
async function updateVideoPrivacy (options: {
  videoInstance: MVideoFullLight
  videoInfoToUpdate: VideoUpdate
  hadPrivacyForFederation: boolean
  transaction: Transaction
}) {
  const { videoInstance, videoInfoToUpdate, hadPrivacyForFederation, transaction } = options
  const isNewVideoForFederation = isNewVideoPrivacyForFederation(videoInstance.privacy, videoInfoToUpdate.privacy)

  const newPrivacy = forceNumber(videoInfoToUpdate.privacy) as VideoPrivacyType
  setVideoPrivacy(videoInstance, newPrivacy)

  // Delete passwords if video is not anymore password protected
  if (videoInstance.privacy === VideoPrivacy.PASSWORD_PROTECTED && newPrivacy !== VideoPrivacy.PASSWORD_PROTECTED) {
    await VideoPasswordModel.deleteAllPasswords(videoInstance.id, transaction)
  }

  if (newPrivacy === VideoPrivacy.PASSWORD_PROTECTED && exists(videoInfoToUpdate.videoPasswords)) {
    await VideoPasswordModel.deleteAllPasswords(videoInstance.id, transaction)
    await VideoPasswordModel.addPasswords(videoInfoToUpdate.videoPasswords, videoInstance.id, transaction)
  }

  // Unfederate the video if the new privacy is not compatible with federation
  if (hadPrivacyForFederation && !isPrivacyForFederation(videoInstance.privacy)) {
    await VideoModel.sendDelete(videoInstance, { transaction })
  }

  return isNewVideoForFederation
}

async function updateSchedule (videoInstance: MVideoFullLight, videoInfoToUpdate: VideoUpdate, transaction: Transaction) {
  if (videoInfoToUpdate.scheduleUpdate) {
    const updateAt = new Date(videoInfoToUpdate.scheduleUpdate.updateAt)

    videoInstance.publishedAt = updateAt
    await videoInstance.save({ transaction })

    await ScheduleVideoUpdateModel.upsert({
      videoId: videoInstance.id,
      updateAt,
      privacy: videoInfoToUpdate.scheduleUpdate.privacy || null
    }, { transaction })

    return
  }

  if (videoInfoToUpdate.scheduleUpdate === null) {
    const deleted = await ScheduleVideoUpdateModel.deleteByVideoId(videoInstance.id, transaction)

    if (deleted) {
      videoInstance.publishedAt = new Date()
      await videoInstance.save({ transaction })
    }
  }
}

async function buildVideoThumbnailsFromReq (video: MVideoThumbnail, files: UploadFiles) {
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
    if (!fields) return undefined

    return updateLocalVideoMiniatureFromExisting({
      inputPath: fields[0].path,
      video,
      type: p.type,
      automaticallyGenerated: false
    })
  })

  const thumbnailsOrUndefined = await Promise.all(promises)

  return thumbnailsOrUndefined.filter(t => !!t)
}
