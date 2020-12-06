import * as express from 'express'
import { move } from 'fs-extra'
import { extname } from 'path'
import toInt from 'validator/lib/toInt'
import { addOptimizeOrMergeAudioJob } from '@server/helpers/video'
import { createTorrentAndSetInfoHash } from '@server/helpers/webtorrent'
import { changeVideoChannelShare } from '@server/lib/activitypub/share'
import { getLocalVideoActivityPubUrl } from '@server/lib/activitypub/url'
import { LiveManager } from '@server/lib/live-manager'
import { buildLocalVideoFromReq, buildVideoThumbnailsFromReq, setVideoTags } from '@server/lib/video'
import { getVideoFilePath } from '@server/lib/video-paths'
import { getServerActor } from '@server/models/application/application'
import { MVideoFullLight } from '@server/types/models'
import { VideoCreate, VideoState, VideoUpdate } from '../../../../shared'
import { VideoFilter } from '../../../../shared/models/videos/video-query.type'
import { auditLoggerFactory, getAuditIdFromRes, VideoAuditView } from '../../../helpers/audit-logger'
import { resetSequelizeInstance } from '../../../helpers/database-utils'
import { buildNSFWFilter, createReqFiles, getCountVideos } from '../../../helpers/express-utils'
import { getMetadataFromFile, getVideoFileFPS, getVideoFileResolution } from '../../../helpers/ffprobe-utils'
import { logger } from '../../../helpers/logger'
import { getFormattedObjects } from '../../../helpers/utils'
import { CONFIG } from '../../../initializers/config'
import {
  DEFAULT_AUDIO_RESOLUTION,
  MIMETYPES,
  VIDEO_CATEGORIES,
  VIDEO_LANGUAGES,
  VIDEO_LICENCES,
  VIDEO_PRIVACIES
} from '../../../initializers/constants'
import { sequelizeTypescript } from '../../../initializers/database'
import { sendView } from '../../../lib/activitypub/send/send-view'
import { federateVideoIfNeeded, fetchRemoteVideoDescription } from '../../../lib/activitypub/videos'
import { JobQueue } from '../../../lib/job-queue'
import { Notifier } from '../../../lib/notifier'
import { Hooks } from '../../../lib/plugins/hooks'
import { Redis } from '../../../lib/redis'
import { generateVideoMiniature } from '../../../lib/thumbnail'
import { autoBlacklistVideoIfNeeded } from '../../../lib/video-blacklist'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  checkVideoFollowConstraints,
  commonVideosFiltersValidator,
  optionalAuthenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultVideosSort,
  videoFileMetadataGetValidator,
  videosAddValidator,
  videosCustomGetValidator,
  videosGetValidator,
  videosRemoveValidator,
  videosSortValidator,
  videosUpdateValidator
} from '../../../middlewares'
import { ScheduleVideoUpdateModel } from '../../../models/video/schedule-video-update'
import { VideoModel } from '../../../models/video/video'
import { VideoFileModel } from '../../../models/video/video-file'
import { blacklistRouter } from './blacklist'
import { videoCaptionsRouter } from './captions'
import { videoCommentRouter } from './comment'
import { videoImportsRouter } from './import'
import { liveRouter } from './live'
import { ownershipVideoRouter } from './ownership'
import { rateVideoRouter } from './rate'
import { watchingRouter } from './watching'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs/http-error-codes'

const auditLogger = auditLoggerFactory('videos')
const videosRouter = express.Router()

const reqVideoFileAdd = createReqFiles(
  [ 'videofile', 'thumbnailfile', 'previewfile' ],
  Object.assign({}, MIMETYPES.VIDEO.MIMETYPE_EXT, MIMETYPES.IMAGE.MIMETYPE_EXT),
  {
    videofile: CONFIG.STORAGE.TMP_DIR,
    thumbnailfile: CONFIG.STORAGE.TMP_DIR,
    previewfile: CONFIG.STORAGE.TMP_DIR
  }
)
const reqVideoFileUpdate = createReqFiles(
  [ 'thumbnailfile', 'previewfile' ],
  MIMETYPES.IMAGE.MIMETYPE_EXT,
  {
    thumbnailfile: CONFIG.STORAGE.TMP_DIR,
    previewfile: CONFIG.STORAGE.TMP_DIR
  }
)

videosRouter.use('/', blacklistRouter)
videosRouter.use('/', rateVideoRouter)
videosRouter.use('/', videoCommentRouter)
videosRouter.use('/', videoCaptionsRouter)
videosRouter.use('/', videoImportsRouter)
videosRouter.use('/', ownershipVideoRouter)
videosRouter.use('/', watchingRouter)
videosRouter.use('/', liveRouter)

videosRouter.get('/categories', listVideoCategories)
videosRouter.get('/licences', listVideoLicences)
videosRouter.get('/languages', listVideoLanguages)
videosRouter.get('/privacies', listVideoPrivacies)

videosRouter.get('/',
  paginationValidator,
  videosSortValidator,
  setDefaultVideosSort,
  setDefaultPagination,
  optionalAuthenticate,
  commonVideosFiltersValidator,
  asyncMiddleware(listVideos)
)
videosRouter.put('/:id',
  authenticate,
  reqVideoFileUpdate,
  asyncMiddleware(videosUpdateValidator),
  asyncRetryTransactionMiddleware(updateVideo)
)
videosRouter.post('/upload',
  authenticate,
  reqVideoFileAdd,
  asyncMiddleware(videosAddValidator),
  asyncRetryTransactionMiddleware(addVideo)
)

videosRouter.get('/:id/description',
  asyncMiddleware(videosGetValidator),
  asyncMiddleware(getVideoDescription)
)
videosRouter.get('/:id/metadata/:videoFileId',
  asyncMiddleware(videoFileMetadataGetValidator),
  asyncMiddleware(getVideoFileMetadata)
)
videosRouter.get('/:id',
  optionalAuthenticate,
  asyncMiddleware(videosCustomGetValidator('only-video-with-rights')),
  asyncMiddleware(checkVideoFollowConstraints),
  asyncMiddleware(getVideo)
)
videosRouter.post('/:id/views',
  asyncMiddleware(videosCustomGetValidator('only-immutable-attributes')),
  asyncMiddleware(viewVideo)
)

videosRouter.delete('/:id',
  authenticate,
  asyncMiddleware(videosRemoveValidator),
  asyncRetryTransactionMiddleware(removeVideo)
)

// ---------------------------------------------------------------------------

export {
  videosRouter
}

// ---------------------------------------------------------------------------

function listVideoCategories (req: express.Request, res: express.Response) {
  res.json(VIDEO_CATEGORIES)
}

function listVideoLicences (req: express.Request, res: express.Response) {
  res.json(VIDEO_LICENCES)
}

function listVideoLanguages (req: express.Request, res: express.Response) {
  res.json(VIDEO_LANGUAGES)
}

function listVideoPrivacies (req: express.Request, res: express.Response) {
  res.json(VIDEO_PRIVACIES)
}

async function addVideo (req: express.Request, res: express.Response) {
  // Uploading the video could be long
  // Set timeout to 10 minutes, as Express's default is 2 minutes
  req.setTimeout(1000 * 60 * 10, () => {
    logger.error('Upload video has timed out.')
    return res.sendStatus(HttpStatusCode.REQUEST_TIMEOUT_408)
  })

  const videoPhysicalFile = req.files['videofile'][0]
  const videoInfo: VideoCreate = req.body

  const videoData = buildLocalVideoFromReq(videoInfo, res.locals.videoChannel.id)
  videoData.state = CONFIG.TRANSCODING.ENABLED ? VideoState.TO_TRANSCODE : VideoState.PUBLISHED
  videoData.duration = videoPhysicalFile['duration'] // duration was added by a previous middleware

  const video = new VideoModel(videoData) as MVideoFullLight
  video.url = getLocalVideoActivityPubUrl(video) // We use the UUID, so set the URL after building the object

  const videoFile = new VideoFileModel({
    extname: extname(videoPhysicalFile.filename),
    size: videoPhysicalFile.size,
    videoStreamingPlaylistId: null,
    metadata: await getMetadataFromFile(videoPhysicalFile.path)
  })

  if (videoFile.isAudio()) {
    videoFile.resolution = DEFAULT_AUDIO_RESOLUTION
  } else {
    videoFile.fps = await getVideoFileFPS(videoPhysicalFile.path)
    videoFile.resolution = (await getVideoFileResolution(videoPhysicalFile.path)).videoFileResolution
  }

  // Move physical file
  const destination = getVideoFilePath(video, videoFile)
  await move(videoPhysicalFile.path, destination)
  // This is important in case if there is another attempt in the retry process
  videoPhysicalFile.filename = getVideoFilePath(video, videoFile)
  videoPhysicalFile.path = destination

  const [ thumbnailModel, previewModel ] = await buildVideoThumbnailsFromReq({
    video,
    files: req.files,
    fallback: type => generateVideoMiniature(video, videoFile, type)
  })

  // Create the torrent file
  await createTorrentAndSetInfoHash(video, videoFile)

  const { videoCreated } = await sequelizeTypescript.transaction(async t => {
    const sequelizeOptions = { transaction: t }

    const videoCreated = await video.save(sequelizeOptions) as MVideoFullLight

    await videoCreated.addAndSaveThumbnail(thumbnailModel, t)
    await videoCreated.addAndSaveThumbnail(previewModel, t)

    // Do not forget to add video channel information to the created video
    videoCreated.VideoChannel = res.locals.videoChannel

    videoFile.videoId = video.id
    await videoFile.save(sequelizeOptions)

    video.VideoFiles = [ videoFile ]

    await setVideoTags({ video, tags: videoInfo.tags, transaction: t })

    // Schedule an update in the future?
    if (videoInfo.scheduleUpdate) {
      await ScheduleVideoUpdateModel.create({
        videoId: video.id,
        updateAt: videoInfo.scheduleUpdate.updateAt,
        privacy: videoInfo.scheduleUpdate.privacy || null
      }, { transaction: t })
    }

    await autoBlacklistVideoIfNeeded({
      video,
      user: res.locals.oauth.token.User,
      isRemote: false,
      isNew: true,
      transaction: t
    })
    await federateVideoIfNeeded(video, true, t)

    auditLogger.create(getAuditIdFromRes(res), new VideoAuditView(videoCreated.toFormattedDetailsJSON()))
    logger.info('Video with name %s and uuid %s created.', videoInfo.name, videoCreated.uuid)

    return { videoCreated }
  })

  Notifier.Instance.notifyOnNewVideoIfNeeded(videoCreated)

  if (video.state === VideoState.TO_TRANSCODE) {
    await addOptimizeOrMergeAudioJob(videoCreated, videoFile)
  }

  Hooks.runAction('action:api.video.uploaded', { video: videoCreated })

  return res.json({
    video: {
      id: videoCreated.id,
      uuid: videoCreated.uuid
    }
  })
}

async function updateVideo (req: express.Request, res: express.Response) {
  const videoInstance = res.locals.videoAll
  const videoFieldsSave = videoInstance.toJSON()
  const oldVideoAuditView = new VideoAuditView(videoInstance.toFormattedDetailsJSON())
  const videoInfoToUpdate: VideoUpdate = req.body

  const wasConfidentialVideo = videoInstance.isConfidential()
  const hadPrivacyForFederation = videoInstance.hasPrivacyForFederation()

  const [ thumbnailModel, previewModel ] = await buildVideoThumbnailsFromReq({
    video: videoInstance,
    files: req.files,
    fallback: () => Promise.resolve(undefined),
    automaticallyGenerated: false
  })

  try {
    const videoInstanceUpdated = await sequelizeTypescript.transaction(async t => {
      const sequelizeOptions = { transaction: t }
      const oldVideoChannel = videoInstance.VideoChannel

      if (videoInfoToUpdate.name !== undefined) videoInstance.name = videoInfoToUpdate.name
      if (videoInfoToUpdate.category !== undefined) videoInstance.category = videoInfoToUpdate.category
      if (videoInfoToUpdate.licence !== undefined) videoInstance.licence = videoInfoToUpdate.licence
      if (videoInfoToUpdate.language !== undefined) videoInstance.language = videoInfoToUpdate.language
      if (videoInfoToUpdate.nsfw !== undefined) videoInstance.nsfw = videoInfoToUpdate.nsfw
      if (videoInfoToUpdate.waitTranscoding !== undefined) videoInstance.waitTranscoding = videoInfoToUpdate.waitTranscoding
      if (videoInfoToUpdate.support !== undefined) videoInstance.support = videoInfoToUpdate.support
      if (videoInfoToUpdate.description !== undefined) videoInstance.description = videoInfoToUpdate.description
      if (videoInfoToUpdate.commentsEnabled !== undefined) videoInstance.commentsEnabled = videoInfoToUpdate.commentsEnabled
      if (videoInfoToUpdate.downloadEnabled !== undefined) videoInstance.downloadEnabled = videoInfoToUpdate.downloadEnabled

      if (videoInfoToUpdate.originallyPublishedAt !== undefined && videoInfoToUpdate.originallyPublishedAt !== null) {
        videoInstance.originallyPublishedAt = new Date(videoInfoToUpdate.originallyPublishedAt)
      }

      let isNewVideo = false
      if (videoInfoToUpdate.privacy !== undefined) {
        isNewVideo = videoInstance.isNewVideo(videoInfoToUpdate.privacy)

        const newPrivacy = parseInt(videoInfoToUpdate.privacy.toString(), 10)
        videoInstance.setPrivacy(newPrivacy)

        // Unfederate the video if the new privacy is not compatible with federation
        if (hadPrivacyForFederation && !videoInstance.hasPrivacyForFederation()) {
          await VideoModel.sendDelete(videoInstance, { transaction: t })
        }
      }

      const videoInstanceUpdated = await videoInstance.save(sequelizeOptions) as MVideoFullLight

      if (thumbnailModel) await videoInstanceUpdated.addAndSaveThumbnail(thumbnailModel, t)
      if (previewModel) await videoInstanceUpdated.addAndSaveThumbnail(previewModel, t)

      // Video tags update?
      await setVideoTags({
        video: videoInstanceUpdated,
        tags: videoInfoToUpdate.tags,
        transaction: t,
        defaultValue: videoInstanceUpdated.Tags
      })

      // Video channel update?
      if (res.locals.videoChannel && videoInstanceUpdated.channelId !== res.locals.videoChannel.id) {
        await videoInstanceUpdated.$set('VideoChannel', res.locals.videoChannel, { transaction: t })
        videoInstanceUpdated.VideoChannel = res.locals.videoChannel

        if (hadPrivacyForFederation === true) await changeVideoChannelShare(videoInstanceUpdated, oldVideoChannel, t)
      }

      // Schedule an update in the future?
      if (videoInfoToUpdate.scheduleUpdate) {
        await ScheduleVideoUpdateModel.upsert({
          videoId: videoInstanceUpdated.id,
          updateAt: videoInfoToUpdate.scheduleUpdate.updateAt,
          privacy: videoInfoToUpdate.scheduleUpdate.privacy || null
        }, { transaction: t })
      } else if (videoInfoToUpdate.scheduleUpdate === null) {
        await ScheduleVideoUpdateModel.deleteByVideoId(videoInstanceUpdated.id, t)
      }

      await autoBlacklistVideoIfNeeded({
        video: videoInstanceUpdated,
        user: res.locals.oauth.token.User,
        isRemote: false,
        isNew: false,
        transaction: t
      })

      await federateVideoIfNeeded(videoInstanceUpdated, isNewVideo, t)

      auditLogger.update(
        getAuditIdFromRes(res),
        new VideoAuditView(videoInstanceUpdated.toFormattedDetailsJSON()),
        oldVideoAuditView
      )
      logger.info('Video with name %s and uuid %s updated.', videoInstance.name, videoInstance.uuid)

      return videoInstanceUpdated
    })

    if (wasConfidentialVideo) {
      Notifier.Instance.notifyOnNewVideoIfNeeded(videoInstanceUpdated)
    }

    Hooks.runAction('action:api.video.updated', { video: videoInstanceUpdated, body: req.body })
  } catch (err) {
    // Force fields we want to update
    // If the transaction is retried, sequelize will think the object has not changed
    // So it will skip the SQL request, even if the last one was ROLLBACKed!
    resetSequelizeInstance(videoInstance, videoFieldsSave)

    throw err
  }

  return res.type('json')
            .status(HttpStatusCode.NO_CONTENT_204)
            .end()
}

async function getVideo (req: express.Request, res: express.Response) {
  // We need more attributes
  const userId: number = res.locals.oauth ? res.locals.oauth.token.User.id : null

  const video = await Hooks.wrapPromiseFun(
    VideoModel.loadForGetAPI,
    { id: res.locals.onlyVideoWithRights.id, userId },
    'filter:api.video.get.result'
  )

  if (video.isOutdated()) {
    JobQueue.Instance.createJob({ type: 'activitypub-refresher', payload: { type: 'video', url: video.url } })
  }

  return res.json(video.toFormattedDetailsJSON())
}

async function viewVideo (req: express.Request, res: express.Response) {
  const immutableVideoAttrs = res.locals.onlyImmutableVideo

  const ip = req.ip
  const exists = await Redis.Instance.doesVideoIPViewExist(ip, immutableVideoAttrs.uuid)
  if (exists) {
    logger.debug('View for ip %s and video %s already exists.', ip, immutableVideoAttrs.uuid)
    return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
  }

  const video = await VideoModel.load(immutableVideoAttrs.id)

  const promises: Promise<any>[] = [
    Redis.Instance.setIPVideoView(ip, video.uuid, video.isLive)
  ]

  let federateView = true

  // Increment our live manager
  if (video.isLive && video.isOwned()) {
    LiveManager.Instance.addViewTo(video.id)

    // Views of our local live will be sent by our live manager
    federateView = false
  }

  // Increment our video views cache counter
  if (!video.isLive) {
    promises.push(Redis.Instance.addVideoView(video.id))
  }

  if (federateView) {
    const serverActor = await getServerActor()
    promises.push(sendView(serverActor, video, undefined))
  }

  await Promise.all(promises)

  Hooks.runAction('action:api.video.viewed', { video, ip })

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function getVideoDescription (req: express.Request, res: express.Response) {
  const videoInstance = res.locals.videoAll
  let description = ''

  if (videoInstance.isOwned()) {
    description = videoInstance.description
  } else {
    description = await fetchRemoteVideoDescription(videoInstance)
  }

  return res.json({ description })
}

async function getVideoFileMetadata (req: express.Request, res: express.Response) {
  const videoFile = await VideoFileModel.loadWithMetadata(toInt(req.params.videoFileId))

  return res.json(videoFile.metadata)
}

async function listVideos (req: express.Request, res: express.Response) {
  const countVideos = getCountVideos(req)

  const apiOptions = await Hooks.wrapObject({
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    includeLocalVideos: true,
    categoryOneOf: req.query.categoryOneOf,
    licenceOneOf: req.query.licenceOneOf,
    languageOneOf: req.query.languageOneOf,
    tagsOneOf: req.query.tagsOneOf,
    tagsAllOf: req.query.tagsAllOf,
    nsfw: buildNSFWFilter(res, req.query.nsfw),
    filter: req.query.filter as VideoFilter,
    withFiles: false,
    user: res.locals.oauth ? res.locals.oauth.token.User : undefined,
    countVideos
  }, 'filter:api.videos.list.params')

  const resultList = await Hooks.wrapPromiseFun(
    VideoModel.listForApi,
    apiOptions,
    'filter:api.videos.list.result'
  )

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function removeVideo (req: express.Request, res: express.Response) {
  const videoInstance = res.locals.videoAll

  await sequelizeTypescript.transaction(async t => {
    await videoInstance.destroy({ transaction: t })
  })

  auditLogger.delete(getAuditIdFromRes(res), new VideoAuditView(videoInstance.toFormattedDetailsJSON()))
  logger.info('Video with name %s and uuid %s deleted.', videoInstance.name, videoInstance.uuid)

  Hooks.runAction('action:api.video.deleted', { video: videoInstance })

  return res.type('json')
            .status(HttpStatusCode.NO_CONTENT_204)
            .end()
}
