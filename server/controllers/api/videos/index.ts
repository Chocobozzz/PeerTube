import * as express from 'express'
import toInt from 'validator/lib/toInt'
import { doJSONRequest } from '@server/helpers/requests'
import { LiveManager } from '@server/lib/live'
import { openapiOperationDoc } from '@server/middlewares/doc'
import { getServerActor } from '@server/models/application/application'
import { MVideoAccountLight } from '@server/types/models'
import { VideosCommonQuery } from '../../../../shared'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs'
import { auditLoggerFactory, getAuditIdFromRes, VideoAuditView } from '../../../helpers/audit-logger'
import { buildNSFWFilter, getCountVideos } from '../../../helpers/express-utils'
import { logger } from '../../../helpers/logger'
import { getFormattedObjects } from '../../../helpers/utils'
import { REMOTE_SCHEME, VIDEO_CATEGORIES, VIDEO_LANGUAGES, VIDEO_LICENCES, VIDEO_PRIVACIES } from '../../../initializers/constants'
import { sequelizeTypescript } from '../../../initializers/database'
import { sendView } from '../../../lib/activitypub/send/send-view'
import { JobQueue } from '../../../lib/job-queue'
import { Hooks } from '../../../lib/plugins/hooks'
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
  setDefaultVideosSort,
  videoFileMetadataGetValidator,
  videosCustomGetValidator,
  videosGetValidator,
  videosRemoveValidator,
  videosSortValidator
} from '../../../middlewares'
import { VideoModel } from '../../../models/video/video'
import { VideoFileModel } from '../../../models/video/video-file'
import { blacklistRouter } from './blacklist'
import { videoCaptionsRouter } from './captions'
import { videoCommentRouter } from './comment'
import { videoImportsRouter } from './import'
import { liveRouter } from './live'
import { ownershipVideoRouter } from './ownership'
import { rateVideoRouter } from './rate'
import { updateRouter } from './update'
import { uploadRouter } from './upload'
import { watchingRouter } from './watching'

const auditLogger = auditLoggerFactory('videos')
const videosRouter = express.Router()

videosRouter.use('/', blacklistRouter)
videosRouter.use('/', rateVideoRouter)
videosRouter.use('/', videoCommentRouter)
videosRouter.use('/', videoCaptionsRouter)
videosRouter.use('/', videoImportsRouter)
videosRouter.use('/', ownershipVideoRouter)
videosRouter.use('/', watchingRouter)
videosRouter.use('/', liveRouter)
videosRouter.use('/', uploadRouter)
videosRouter.use('/', updateRouter)

videosRouter.get('/categories',
  openapiOperationDoc({ operationId: 'getCategories' }),
  listVideoCategories
)
videosRouter.get('/licences',
  openapiOperationDoc({ operationId: 'getLicences' }),
  listVideoLicences
)
videosRouter.get('/languages',
  openapiOperationDoc({ operationId: 'getLanguages' }),
  listVideoLanguages
)
videosRouter.get('/privacies',
  openapiOperationDoc({ operationId: 'getPrivacies' }),
  listVideoPrivacies
)

videosRouter.get('/',
  openapiOperationDoc({ operationId: 'getVideos' }),
  paginationValidator,
  videosSortValidator,
  setDefaultVideosSort,
  setDefaultPagination,
  optionalAuthenticate,
  commonVideosFiltersValidator,
  asyncMiddleware(listVideos)
)

videosRouter.get('/:id/description',
  openapiOperationDoc({ operationId: 'getVideoDesc' }),
  asyncMiddleware(videosGetValidator),
  asyncMiddleware(getVideoDescription)
)
videosRouter.get('/:id/metadata/:videoFileId',
  asyncMiddleware(videoFileMetadataGetValidator),
  asyncMiddleware(getVideoFileMetadata)
)
videosRouter.get('/:id',
  openapiOperationDoc({ operationId: 'getVideo' }),
  optionalAuthenticate,
  asyncMiddleware(videosCustomGetValidator('for-api')),
  asyncMiddleware(checkVideoFollowConstraints),
  asyncMiddleware(getVideo)
)
videosRouter.post('/:id/views',
  openapiOperationDoc({ operationId: 'addView' }),
  asyncMiddleware(videosCustomGetValidator('only-immutable-attributes')),
  asyncMiddleware(viewVideo)
)

videosRouter.delete('/:id',
  openapiOperationDoc({ operationId: 'delVideo' }),
  authenticate,
  asyncMiddleware(videosRemoveValidator),
  asyncRetryTransactionMiddleware(removeVideo)
)

// ---------------------------------------------------------------------------

export {
  videosRouter
}

// ---------------------------------------------------------------------------

function listVideoCategories (_req: express.Request, res: express.Response) {
  res.json(VIDEO_CATEGORIES)
}

function listVideoLicences (_req: express.Request, res: express.Response) {
  res.json(VIDEO_LICENCES)
}

function listVideoLanguages (_req: express.Request, res: express.Response) {
  res.json(VIDEO_LANGUAGES)
}

function listVideoPrivacies (_req: express.Request, res: express.Response) {
  res.json(VIDEO_PRIVACIES)
}

async function getVideo (_req: express.Request, res: express.Response) {
  const video = res.locals.videoAPI

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
    return res.status(HttpStatusCode.NO_CONTENT_204).end()
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

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function getVideoDescription (req: express.Request, res: express.Response) {
  const videoInstance = res.locals.videoAll

  const description = videoInstance.isOwned()
    ? videoInstance.description
    : await fetchRemoteVideoDescription(videoInstance)

  return res.json({ description })
}

async function getVideoFileMetadata (req: express.Request, res: express.Response) {
  const videoFile = await VideoFileModel.loadWithMetadata(toInt(req.params.videoFileId))

  return res.json(videoFile.metadata)
}

async function listVideos (req: express.Request, res: express.Response) {
  const query = req.query as VideosCommonQuery
  const countVideos = getCountVideos(req)

  const apiOptions = await Hooks.wrapObject({
    start: query.start,
    count: query.count,
    sort: query.sort,
    includeLocalVideos: true,
    categoryOneOf: query.categoryOneOf,
    licenceOneOf: query.licenceOneOf,
    languageOneOf: query.languageOneOf,
    tagsOneOf: query.tagsOneOf,
    tagsAllOf: query.tagsAllOf,
    nsfw: buildNSFWFilter(res, query.nsfw),
    isLive: query.isLive,
    filter: query.filter,
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

async function removeVideo (_req: express.Request, res: express.Response) {
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

// ---------------------------------------------------------------------------

// FIXME: Should not exist, we rely on specific API
async function fetchRemoteVideoDescription (video: MVideoAccountLight) {
  const host = video.VideoChannel.Account.Actor.Server.host
  const path = video.getDescriptionAPIPath()
  const url = REMOTE_SCHEME.HTTP + '://' + host + path

  const { body } = await doJSONRequest<any>(url)
  return body.description || ''
}
