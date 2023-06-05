import express from 'express'
import { pickCommonVideoQuery } from '@server/helpers/query'
import { doJSONRequest } from '@server/helpers/requests'
import { openapiOperationDoc } from '@server/middlewares/doc'
import { getServerActor } from '@server/models/application/application'
import { MVideoAccountLight } from '@server/types/models'
import { HttpStatusCode } from '../../../../shared/models'
import { auditLoggerFactory, getAuditIdFromRes, VideoAuditView } from '../../../helpers/audit-logger'
import { buildNSFWFilter, getCountVideos } from '../../../helpers/express-utils'
import { logger } from '../../../helpers/logger'
import { getFormattedObjects } from '../../../helpers/utils'
import { REMOTE_SCHEME, VIDEO_CATEGORIES, VIDEO_LANGUAGES, VIDEO_LICENCES, VIDEO_PRIVACIES } from '../../../initializers/constants'
import { sequelizeTypescript } from '../../../initializers/database'
import { JobQueue } from '../../../lib/job-queue'
import { Hooks } from '../../../lib/plugins/hooks'
import {
  apiRateLimiter,
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  checkVideoFollowConstraints,
  commonVideosFiltersValidator,
  optionalAuthenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultVideosSort,
  videosCustomGetValidator,
  videosGetValidator,
  videoSourceGetValidator,
  videosRemoveValidator,
  videosSortValidator
} from '../../../middlewares'
import { guessAdditionalAttributesFromQuery } from '../../../models/video/formatter'
import { VideoModel } from '../../../models/video/video'
import { blacklistRouter } from './blacklist'
import { videoCaptionsRouter } from './captions'
import { videoCommentRouter } from './comment'
import { filesRouter } from './files'
import { videoImportsRouter } from './import'
import { liveRouter } from './live'
import { ownershipVideoRouter } from './ownership'
import { rateVideoRouter } from './rate'
import { statsRouter } from './stats'
import { storyboardRouter } from './storyboard'
import { studioRouter } from './studio'
import { tokenRouter } from './token'
import { transcodingRouter } from './transcoding'
import { updateRouter } from './update'
import { uploadRouter } from './upload'
import { viewRouter } from './view'
import { videoPasswordRouter } from './passwords'

const auditLogger = auditLoggerFactory('videos')
const videosRouter = express.Router()

videosRouter.use(apiRateLimiter)

videosRouter.use('/', blacklistRouter)
videosRouter.use('/', statsRouter)
videosRouter.use('/', rateVideoRouter)
videosRouter.use('/', videoCommentRouter)
videosRouter.use('/', studioRouter)
videosRouter.use('/', videoCaptionsRouter)
videosRouter.use('/', videoImportsRouter)
videosRouter.use('/', ownershipVideoRouter)
videosRouter.use('/', viewRouter)
videosRouter.use('/', liveRouter)
videosRouter.use('/', uploadRouter)
videosRouter.use('/', updateRouter)
videosRouter.use('/', filesRouter)
videosRouter.use('/', transcodingRouter)
videosRouter.use('/', tokenRouter)
videosRouter.use('/', videoPasswordRouter)
videosRouter.use('/', storyboardRouter)

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

// TODO: remove, deprecated in 5.0 now we send the complete description in VideoDetails
videosRouter.get('/:id/description',
  openapiOperationDoc({ operationId: 'getVideoDesc' }),
  asyncMiddleware(videosGetValidator),
  asyncMiddleware(getVideoDescription)
)

videosRouter.get('/:id/source',
  openapiOperationDoc({ operationId: 'getVideoSource' }),
  authenticate,
  asyncMiddleware(videoSourceGetValidator),
  getVideoSource
)

videosRouter.get('/:id',
  openapiOperationDoc({ operationId: 'getVideo' }),
  optionalAuthenticate,
  asyncMiddleware(videosCustomGetValidator('for-api')),
  asyncMiddleware(checkVideoFollowConstraints),
  asyncMiddleware(getVideo)
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
  const videoId = res.locals.videoAPI.id
  const userId = res.locals.oauth?.token.User.id

  const video = await Hooks.wrapObject(res.locals.videoAPI, 'filter:api.video.get.result', { id: videoId, userId })

  if (video.isOutdated()) {
    JobQueue.Instance.createJobAsync({ type: 'activitypub-refresher', payload: { type: 'video', url: video.url } })
  }

  return res.json(video.toFormattedDetailsJSON())
}

async function getVideoDescription (req: express.Request, res: express.Response) {
  const videoInstance = res.locals.videoAll

  const description = videoInstance.isOwned()
    ? videoInstance.description
    : await fetchRemoteVideoDescription(videoInstance)

  return res.json({ description })
}

function getVideoSource (req: express.Request, res: express.Response) {
  return res.json(res.locals.videoSource.toFormattedJSON())
}

async function listVideos (req: express.Request, res: express.Response) {
  const serverActor = await getServerActor()

  const query = pickCommonVideoQuery(req.query)
  const countVideos = getCountVideos(req)

  const apiOptions = await Hooks.wrapObject({
    ...query,

    displayOnlyForFollower: {
      actorId: serverActor.id,
      orLocalVideos: true
    },
    nsfw: buildNSFWFilter(res, query.nsfw),
    user: res.locals.oauth ? res.locals.oauth.token.User : undefined,
    countVideos
  }, 'filter:api.videos.list.params')

  const resultList = await Hooks.wrapPromiseFun(
    VideoModel.listForApi,
    apiOptions,
    'filter:api.videos.list.result'
  )

  return res.json(getFormattedObjects(resultList.data, resultList.total, guessAdditionalAttributesFromQuery(query)))
}

async function removeVideo (req: express.Request, res: express.Response) {
  const videoInstance = res.locals.videoAll

  await sequelizeTypescript.transaction(async t => {
    await videoInstance.destroy({ transaction: t })
  })

  auditLogger.delete(getAuditIdFromRes(res), new VideoAuditView(videoInstance.toFormattedDetailsJSON()))
  logger.info('Video with name %s and uuid %s deleted.', videoInstance.name, videoInstance.uuid)

  Hooks.runAction('action:api.video.deleted', { video: videoInstance, req, res })

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
