import * as express from 'express'
import { extname } from 'path'
import { VideoCreate, VideoPrivacy, VideoState, VideoUpdate } from '../../../../shared'
import { getMetadataFromFile, getVideoFileFPS, getVideoFileResolution } from '../../../helpers/ffmpeg-utils'
import { logger } from '../../../helpers/logger'
import { auditLoggerFactory, getAuditIdFromRes, VideoAuditView } from '../../../helpers/audit-logger'
import { getFormattedObjects } from '../../../helpers/utils'
import { autoBlacklistVideoIfNeeded } from '../../../lib/video-blacklist'
import {
  DEFAULT_AUDIO_RESOLUTION,
  MIMETYPES,
  VIDEO_CATEGORIES,
  VIDEO_LANGUAGES,
  VIDEO_LICENCES,
  VIDEO_PRIVACIES
} from '../../../initializers/constants'
import { federateVideoIfNeeded, fetchRemoteVideoDescription } from '../../../lib/activitypub/videos'
import { JobQueue } from '../../../lib/job-queue'
import { Redis } from '../../../lib/redis'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  checkVideoFollowConstraints,
  commonVideosFiltersValidator,
  optionalAuthenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort,
  videoFileMetadataGetValidator,
  videosAddValidator,
  videosCustomGetValidator,
  videosGetValidator,
  videosRemoveValidator,
  videosSortValidator,
  videosUpdateValidator
} from '../../../middlewares'
import { TagModel } from '../../../models/video/tag'
import { VideoModel } from '../../../models/video/video'
import { VideoFileModel } from '../../../models/video/video-file'
import { abuseVideoRouter } from './abuse'
import { blacklistRouter } from './blacklist'
import { videoCommentRouter } from './comment'
import { rateVideoRouter } from './rate'
import { ownershipVideoRouter } from './ownership'
import { VideoFilter } from '../../../../shared/models/videos/video-query.type'
import { buildNSFWFilter, createReqFiles, getCountVideos } from '../../../helpers/express-utils'
import { ScheduleVideoUpdateModel } from '../../../models/video/schedule-video-update'
import { videoCaptionsRouter } from './captions'
import { videoImportsRouter } from './import'
import { resetSequelizeInstance } from '../../../helpers/database-utils'
import { move } from 'fs-extra'
import { watchingRouter } from './watching'
import { Notifier } from '../../../lib/notifier'
import { sendView } from '../../../lib/activitypub/send/send-view'
import { CONFIG } from '../../../initializers/config'
import { sequelizeTypescript } from '../../../initializers/database'
import { createVideoMiniatureFromExisting, generateVideoMiniature } from '../../../lib/thumbnail'
import { ThumbnailType } from '../../../../shared/models/videos/thumbnail.type'
import { Hooks } from '../../../lib/plugins/hooks'
import { MVideoDetails, MVideoFullLight } from '@server/types/models'
import { createTorrentAndSetInfoHash } from '@server/helpers/webtorrent'
import { getVideoFilePath } from '@server/lib/video-paths'
import toInt from 'validator/lib/toInt'
import { addOptimizeOrMergeAudioJob } from '@server/helpers/video'
import { getServerActor } from '@server/models/application/application'
import { changeVideoChannelShare } from '@server/lib/activitypub/share'
import { getVideoActivityPubUrl } from '@server/lib/activitypub/url'

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

videosRouter.use('/', abuseVideoRouter)
videosRouter.use('/', blacklistRouter)
videosRouter.use('/', rateVideoRouter)
videosRouter.use('/', videoCommentRouter)
videosRouter.use('/', videoCaptionsRouter)
videosRouter.use('/', videoImportsRouter)
videosRouter.use('/', ownershipVideoRouter)
videosRouter.use('/', watchingRouter)

videosRouter.get('/categories', listVideoCategories)
videosRouter.get('/licences', listVideoLicences)
videosRouter.get('/languages', listVideoLanguages)
videosRouter.get('/privacies', listVideoPrivacies)

videosRouter.get('/',
  paginationValidator,
  videosSortValidator,
  setDefaultSort,
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
  // Processing the video could be long
  // Set timeout to 10 minutes
  req.setTimeout(1000 * 60 * 10, () => {
    logger.error('Upload video has timed out.')
    return res.sendStatus(408)
  })

  const videoPhysicalFile = req.files['videofile'][0]
  const videoInfo: VideoCreate = req.body

  // Prepare data so we don't block the transaction
  const videoData = {
    name: videoInfo.name,
    remote: false,
    category: videoInfo.category,
    licence: videoInfo.licence,
    language: videoInfo.language,
    commentsEnabled: videoInfo.commentsEnabled !== false, // If the value is not "false", the default is "true"
    downloadEnabled: videoInfo.downloadEnabled !== false,
    waitTranscoding: videoInfo.waitTranscoding || false,
    state: CONFIG.TRANSCODING.ENABLED ? VideoState.TO_TRANSCODE : VideoState.PUBLISHED,
    nsfw: videoInfo.nsfw || false,
    description: videoInfo.description,
    support: videoInfo.support,
    privacy: videoInfo.privacy || VideoPrivacy.PRIVATE,
    duration: videoPhysicalFile['duration'], // duration was added by a previous middleware
    channelId: res.locals.videoChannel.id,
    originallyPublishedAt: videoInfo.originallyPublishedAt
  }

  const video = new VideoModel(videoData) as MVideoDetails
  video.url = getVideoActivityPubUrl(video) // We use the UUID, so set the URL after building the object

  const videoFile = new VideoFileModel({
    extname: extname(videoPhysicalFile.filename),
    size: videoPhysicalFile.size,
    videoStreamingPlaylistId: null,
    metadata: await getMetadataFromFile<any>(videoPhysicalFile.path)
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

  // Process thumbnail or create it from the video
  const thumbnailField = req.files['thumbnailfile']
  const thumbnailModel = thumbnailField
    ? await createVideoMiniatureFromExisting(thumbnailField[0].path, video, ThumbnailType.MINIATURE, false)
    : await generateVideoMiniature(video, videoFile, ThumbnailType.MINIATURE)

  // Process preview or create it from the video
  const previewField = req.files['previewfile']
  const previewModel = previewField
    ? await createVideoMiniatureFromExisting(previewField[0].path, video, ThumbnailType.PREVIEW, false)
    : await generateVideoMiniature(video, videoFile, ThumbnailType.PREVIEW)

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

    // Create tags
    if (videoInfo.tags !== undefined) {
      const tagInstances = await TagModel.findOrCreateTags(videoInfo.tags, t)

      await video.$set('Tags', tagInstances, sequelizeOptions)
      video.Tags = tagInstances
    }

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
  }).end()
}

async function updateVideo (req: express.Request, res: express.Response) {
  const videoInstance = res.locals.videoAll
  const videoFieldsSave = videoInstance.toJSON()
  const oldVideoAuditView = new VideoAuditView(videoInstance.toFormattedDetailsJSON())
  const videoInfoToUpdate: VideoUpdate = req.body

  const wasConfidentialVideo = videoInstance.isConfidential()
  const hadPrivacyForFederation = videoInstance.hasPrivacyForFederation()

  // Process thumbnail or create it from the video
  const thumbnailModel = req.files?.['thumbnailfile']
    ? await createVideoMiniatureFromExisting(req.files['thumbnailfile'][0].path, videoInstance, ThumbnailType.MINIATURE, false)
    : undefined

  const previewModel = req.files?.['previewfile']
    ? await createVideoMiniatureFromExisting(req.files['previewfile'][0].path, videoInstance, ThumbnailType.PREVIEW, false)
    : undefined

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
      if (videoInfoToUpdate.tags !== undefined) {
        const tagInstances = await TagModel.findOrCreateTags(videoInfoToUpdate.tags, t)

        await videoInstanceUpdated.$set('Tags', tagInstances, sequelizeOptions)
        videoInstanceUpdated.Tags = tagInstances
      }

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

    Hooks.runAction('action:api.video.updated', { video: videoInstanceUpdated })
  } catch (err) {
    // Force fields we want to update
    // If the transaction is retried, sequelize will think the object has not changed
    // So it will skip the SQL request, even if the last one was ROLLBACKed!
    resetSequelizeInstance(videoInstance, videoFieldsSave)

    throw err
  }

  return res.type('json').status(204).end()
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
  const videoInstance = res.locals.onlyImmutableVideo

  const ip = req.ip
  const exists = await Redis.Instance.doesVideoIPViewExist(ip, videoInstance.uuid)
  if (exists) {
    logger.debug('View for ip %s and video %s already exists.', ip, videoInstance.uuid)
    return res.status(204).end()
  }

  await Promise.all([
    Redis.Instance.addVideoView(videoInstance.id),
    Redis.Instance.setIPVideoView(ip, videoInstance.uuid)
  ])

  const serverActor = await getServerActor()
  await sendView(serverActor, videoInstance, undefined)

  Hooks.runAction('action:api.video.viewed', { video: videoInstance, ip })

  return res.status(204).end()
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

  return res.type('json').status(204).end()
}
