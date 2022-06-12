import express from 'express'
import { pickCommonVideoQuery } from '@server/helpers/query'
import { doJSONRequest } from '@server/helpers/requests'
import { VideoViews } from '@server/lib/video-views'
import { openapiOperationDoc } from '@server/middlewares/doc'
import { getServerActor } from '@server/models/application/application'
import { guessAdditionalAttributesFromQuery } from '@server/models/video/formatter/video-format-utils'
import { MVideoAccountLight } from '@server/types/models'
import { HttpStatusCode } from '../../../../shared/models'
import { auditLoggerFactory, getAuditIdFromRes, VideoAuditView } from '../../../helpers/audit-logger'
import { buildNSFWFilter, getCountVideos } from '../../../helpers/express-utils'
import { logger } from '../../../helpers/logger'
import { getFormattedObjects } from '../../../helpers/utils'
import { REMOTE_SCHEME, VIDEO_CATEGORIES, VIDEO_LANGUAGES, VIDEO_LICENCES, VIDEO_PRIVACIES } from '../../../initializers/constants'
import { sequelizeTypescript } from '../../../initializers/database'
import { sendView } from '../../../lib/activitypub/send/send-view'
import { JobQueue } from '../../../lib/job-queue'
import { Hooks } from '../../../lib/plugins/hooks'
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
  videosCustomGetValidator,
  videosGetValidator,
  videosRemoveValidator,
  videosSortValidator
} from '../../../middlewares'
import { VideoModel } from '../../../models/video/video'
import { blacklistRouter } from './blacklist'
import { videoCaptionsRouter } from './captions'
import { videoCommentRouter } from './comment'
import { filesRouter } from './files'
import { videoImportsRouter } from './import'
import { liveRouter } from './live'
import { ownershipVideoRouter } from './ownership'
import { rateVideoRouter } from './rate'
import { transcodingRouter } from './transcoding'
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
videosRouter.use('/', filesRouter)
videosRouter.use('/', transcodingRouter)

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
videosRouter.get('/:id',
  openapiOperationDoc({ operationId: 'getVideo' }),
  optionalAuthenticate,
  asyncMiddleware(videosCustomGetValidator('for-api')),
  asyncMiddleware(checkVideoFollowConstraints),
  getVideo
)
videosRouter.post('/:id/views',
  openapiOperationDoc({ operationId: 'addView' }),
  asyncMiddleware(videosCustomGetValidator('only-video')),
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

function getVideo (_req: express.Request, res: express.Response) {
  const video = res.locals.videoAPI

  if (video.isOutdated()) {
    JobQueue.Instance.createJob({ type: 'activitypub-refresher', payload: { type: 'video', url: video.url } })
  }

  return res.json(video.toFormattedDetailsJSON())
}

async function viewVideo (req: express.Request, res: express.Response) {
  const video = res.locals.onlyVideo

  const ip = req.ip
  const success = await VideoViews.Instance.processView({ video, ip })

  if (success) {
    const serverActor = await getServerActor()
    await sendView(serverActor, video, undefined)

    Hooks.runAction('action:api.video.viewed', { video: video, ip, req, res })
  }

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function getVideoDescription (req: express.Request, res: express.Response) {
  const videoInstance = res.locals.videoAll

  const description = videoInstance.isOwned()
    ? videoInstance.description
    : await fetchRemoteVideoDescription(videoInstance)

  return res.json({ description })
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
