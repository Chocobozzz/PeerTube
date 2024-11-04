import { HttpStatusCode } from '@peertube/peertube-models'
import { pickCommonVideoQuery } from '@server/helpers/query.js'
import { openapiOperationDoc } from '@server/middlewares/doc.js'
import { getServerActor } from '@server/models/application/application.js'
import express from 'express'
import { auditLoggerFactory, getAuditIdFromRes, VideoAuditView } from '../../../helpers/audit-logger.js'
import { buildNSFWFilter, getCountVideos } from '../../../helpers/express-utils.js'
import { logger } from '../../../helpers/logger.js'
import { getFormattedObjects } from '../../../helpers/utils.js'
import { VIDEO_CATEGORIES, VIDEO_LANGUAGES, VIDEO_LICENCES, VIDEO_PRIVACIES } from '../../../initializers/constants.js'
import { sequelizeTypescript } from '../../../initializers/database.js'
import { JobQueue } from '../../../lib/job-queue/index.js'
import { Hooks } from '../../../lib/plugins/hooks.js'
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
  videosRemoveValidator,
  videosSortValidator
} from '../../../middlewares/index.js'
import { guessAdditionalAttributesFromQuery } from '../../../models/video/formatter/index.js'
import { VideoModel } from '../../../models/video/video.js'
import { blacklistRouter } from './blacklist.js'
import { videoCaptionsRouter } from './captions.js'
import { videoChaptersRouter } from './chapters.js'
import { videoCommentRouter } from './comment.js'
import { filesRouter } from './files.js'
import { videoImportsRouter } from './import.js'
import { liveRouter } from './live.js'
import { ownershipVideoRouter } from './ownership.js'
import { videoPasswordRouter } from './passwords.js'
import { rateVideoRouter } from './rate.js'
import { videoSourceRouter } from './source.js'
import { statsRouter } from './stats.js'
import { storyboardRouter } from './storyboard.js'
import { studioRouter } from './studio.js'
import { tokenRouter } from './token.js'
import { transcodingRouter } from './transcoding.js'
import { updateRouter } from './update.js'
import { uploadRouter } from './upload.js'
import { viewRouter } from './view.js'

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
videosRouter.use('/', videoSourceRouter)
videosRouter.use('/', videoChaptersRouter)

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

async function getVideo (req: express.Request, res: express.Response) {
  const videoId = res.locals.videoAPI.id
  const userId = res.locals.oauth?.token.User.id

  const video = await Hooks.wrapObject(res.locals.videoAPI, 'filter:api.video.get.result', { req, id: videoId, userId })
  // Filter may return null/undefined value to forbid video access
  if (!video) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  if (video.isOutdated()) {
    JobQueue.Instance.createJobAsync({ type: 'activitypub-refresher', payload: { type: 'video', url: video.url } })
  }

  return res.json(video.toFormattedDetailsJSON())
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
    VideoModel.listForApi.bind(VideoModel),
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
