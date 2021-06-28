import * as express from 'express'
import { Hooks } from '@server/lib/plugins/hooks'
import { getServerActor } from '@server/models/application/application'
import { MChannelBannerAccountDefault } from '@server/types/models'
import { ActorImageType, VideoChannelCreate, VideoChannelUpdate, VideosCommonQuery } from '../../../shared'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'
import { auditLoggerFactory, getAuditIdFromRes, VideoChannelAuditView } from '../../helpers/audit-logger'
import { resetSequelizeInstance } from '../../helpers/database-utils'
import { buildNSFWFilter, createReqFiles, getCountVideos, isUserAbleToSearchRemoteURI } from '../../helpers/express-utils'
import { logger } from '../../helpers/logger'
import { getFormattedObjects } from '../../helpers/utils'
import { CONFIG } from '../../initializers/config'
import { MIMETYPES } from '../../initializers/constants'
import { sequelizeTypescript } from '../../initializers/database'
import { sendUpdateActor } from '../../lib/activitypub/send'
import { JobQueue } from '../../lib/job-queue'
import { deleteLocalActorImageFile, updateLocalActorImageFile } from '../../lib/local-actor'
import { createLocalVideoChannel, federateAllVideosOfChannel } from '../../lib/video-channel'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  commonVideosFiltersValidator,
  optionalAuthenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort,
  setDefaultVideosSort,
  videoChannelsAddValidator,
  videoChannelsRemoveValidator,
  videoChannelsSortValidator,
  videoChannelsUpdateValidator,
  videoPlaylistsSortValidator
} from '../../middlewares'
import { videoChannelsListValidator, videoChannelsNameWithHostValidator, videosSortValidator } from '../../middlewares/validators'
import { updateAvatarValidator, updateBannerValidator } from '../../middlewares/validators/actor-image'
import { commonVideoPlaylistFiltersValidator } from '../../middlewares/validators/videos/video-playlists'
import { AccountModel } from '../../models/account/account'
import { VideoModel } from '../../models/video/video'
import { VideoChannelModel } from '../../models/video/video-channel'
import { VideoPlaylistModel } from '../../models/video/video-playlist'

const auditLogger = auditLoggerFactory('channels')
const reqAvatarFile = createReqFiles([ 'avatarfile' ], MIMETYPES.IMAGE.MIMETYPE_EXT, { avatarfile: CONFIG.STORAGE.TMP_DIR })
const reqBannerFile = createReqFiles([ 'bannerfile' ], MIMETYPES.IMAGE.MIMETYPE_EXT, { bannerfile: CONFIG.STORAGE.TMP_DIR })

const videoChannelRouter = express.Router()

videoChannelRouter.get('/',
  paginationValidator,
  videoChannelsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  videoChannelsListValidator,
  asyncMiddleware(listVideoChannels)
)

videoChannelRouter.post('/',
  authenticate,
  asyncMiddleware(videoChannelsAddValidator),
  asyncRetryTransactionMiddleware(addVideoChannel)
)

videoChannelRouter.post('/:nameWithHost/avatar/pick',
  authenticate,
  reqAvatarFile,
  // Check the rights
  asyncMiddleware(videoChannelsUpdateValidator),
  updateAvatarValidator,
  asyncMiddleware(updateVideoChannelAvatar)
)

videoChannelRouter.post('/:nameWithHost/banner/pick',
  authenticate,
  reqBannerFile,
  // Check the rights
  asyncMiddleware(videoChannelsUpdateValidator),
  updateBannerValidator,
  asyncMiddleware(updateVideoChannelBanner)
)

videoChannelRouter.delete('/:nameWithHost/avatar',
  authenticate,
  // Check the rights
  asyncMiddleware(videoChannelsUpdateValidator),
  asyncMiddleware(deleteVideoChannelAvatar)
)

videoChannelRouter.delete('/:nameWithHost/banner',
  authenticate,
  // Check the rights
  asyncMiddleware(videoChannelsUpdateValidator),
  asyncMiddleware(deleteVideoChannelBanner)
)

videoChannelRouter.put('/:nameWithHost',
  authenticate,
  asyncMiddleware(videoChannelsUpdateValidator),
  asyncRetryTransactionMiddleware(updateVideoChannel)
)

videoChannelRouter.delete('/:nameWithHost',
  authenticate,
  asyncMiddleware(videoChannelsRemoveValidator),
  asyncRetryTransactionMiddleware(removeVideoChannel)
)

videoChannelRouter.get('/:nameWithHost',
  asyncMiddleware(videoChannelsNameWithHostValidator),
  asyncMiddleware(getVideoChannel)
)

videoChannelRouter.get('/:nameWithHost/video-playlists',
  asyncMiddleware(videoChannelsNameWithHostValidator),
  paginationValidator,
  videoPlaylistsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  commonVideoPlaylistFiltersValidator,
  asyncMiddleware(listVideoChannelPlaylists)
)

videoChannelRouter.get('/:nameWithHost/videos',
  asyncMiddleware(videoChannelsNameWithHostValidator),
  paginationValidator,
  videosSortValidator,
  setDefaultVideosSort,
  setDefaultPagination,
  optionalAuthenticate,
  commonVideosFiltersValidator,
  asyncMiddleware(listVideoChannelVideos)
)

// ---------------------------------------------------------------------------

export {
  videoChannelRouter
}

// ---------------------------------------------------------------------------

async function listVideoChannels (req: express.Request, res: express.Response) {
  const serverActor = await getServerActor()
  const resultList = await VideoChannelModel.listForApi({
    actorId: serverActor.id,
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function updateVideoChannelBanner (req: express.Request, res: express.Response) {
  const bannerPhysicalFile = req.files['bannerfile'][0]
  const videoChannel = res.locals.videoChannel
  const oldVideoChannelAuditKeys = new VideoChannelAuditView(videoChannel.toFormattedJSON())

  const banner = await updateLocalActorImageFile(videoChannel, bannerPhysicalFile, ActorImageType.BANNER)

  auditLogger.update(getAuditIdFromRes(res), new VideoChannelAuditView(videoChannel.toFormattedJSON()), oldVideoChannelAuditKeys)

  return res.json({ banner: banner.toFormattedJSON() })
}

async function updateVideoChannelAvatar (req: express.Request, res: express.Response) {
  const avatarPhysicalFile = req.files['avatarfile'][0]
  const videoChannel = res.locals.videoChannel
  const oldVideoChannelAuditKeys = new VideoChannelAuditView(videoChannel.toFormattedJSON())

  const avatar = await updateLocalActorImageFile(videoChannel, avatarPhysicalFile, ActorImageType.AVATAR)

  auditLogger.update(getAuditIdFromRes(res), new VideoChannelAuditView(videoChannel.toFormattedJSON()), oldVideoChannelAuditKeys)

  return res.json({ avatar: avatar.toFormattedJSON() })
}

async function deleteVideoChannelAvatar (req: express.Request, res: express.Response) {
  const videoChannel = res.locals.videoChannel

  await deleteLocalActorImageFile(videoChannel, ActorImageType.AVATAR)

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function deleteVideoChannelBanner (req: express.Request, res: express.Response) {
  const videoChannel = res.locals.videoChannel

  await deleteLocalActorImageFile(videoChannel, ActorImageType.BANNER)

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function addVideoChannel (req: express.Request, res: express.Response) {
  const videoChannelInfo: VideoChannelCreate = req.body

  const videoChannelCreated = await sequelizeTypescript.transaction(async t => {
    const account = await AccountModel.load(res.locals.oauth.token.User.Account.id, t)

    return createLocalVideoChannel(videoChannelInfo, account, t)
  })

  const payload = { actorId: videoChannelCreated.actorId }
  await JobQueue.Instance.createJobWithPromise({ type: 'actor-keys', payload })

  auditLogger.create(getAuditIdFromRes(res), new VideoChannelAuditView(videoChannelCreated.toFormattedJSON()))
  logger.info('Video channel %s created.', videoChannelCreated.Actor.url)

  return res.json({
    videoChannel: {
      id: videoChannelCreated.id
    }
  })
}

async function updateVideoChannel (req: express.Request, res: express.Response) {
  const videoChannelInstance = res.locals.videoChannel
  const videoChannelFieldsSave = videoChannelInstance.toJSON()
  const oldVideoChannelAuditKeys = new VideoChannelAuditView(videoChannelInstance.toFormattedJSON())
  const videoChannelInfoToUpdate = req.body as VideoChannelUpdate
  let doBulkVideoUpdate = false

  try {
    await sequelizeTypescript.transaction(async t => {
      if (videoChannelInfoToUpdate.displayName !== undefined) videoChannelInstance.name = videoChannelInfoToUpdate.displayName
      if (videoChannelInfoToUpdate.description !== undefined) videoChannelInstance.description = videoChannelInfoToUpdate.description

      if (videoChannelInfoToUpdate.support !== undefined) {
        const oldSupportField = videoChannelInstance.support
        videoChannelInstance.support = videoChannelInfoToUpdate.support

        if (videoChannelInfoToUpdate.bulkVideosSupportUpdate === true && oldSupportField !== videoChannelInfoToUpdate.support) {
          doBulkVideoUpdate = true
          await VideoModel.bulkUpdateSupportField(videoChannelInstance, t)
        }
      }

      const videoChannelInstanceUpdated = await videoChannelInstance.save({ transaction: t }) as MChannelBannerAccountDefault
      await sendUpdateActor(videoChannelInstanceUpdated, t)

      auditLogger.update(
        getAuditIdFromRes(res),
        new VideoChannelAuditView(videoChannelInstanceUpdated.toFormattedJSON()),
        oldVideoChannelAuditKeys
      )

      logger.info('Video channel %s updated.', videoChannelInstance.Actor.url)
    })
  } catch (err) {
    logger.debug('Cannot update the video channel.', { err })

    // Force fields we want to update
    // If the transaction is retried, sequelize will think the object has not changed
    // So it will skip the SQL request, even if the last one was ROLLBACKed!
    resetSequelizeInstance(videoChannelInstance, videoChannelFieldsSave)

    throw err
  }

  res.type('json').status(HttpStatusCode.NO_CONTENT_204).end()

  // Don't process in a transaction, and after the response because it could be long
  if (doBulkVideoUpdate) {
    await federateAllVideosOfChannel(videoChannelInstance)
  }
}

async function removeVideoChannel (req: express.Request, res: express.Response) {
  const videoChannelInstance = res.locals.videoChannel

  await sequelizeTypescript.transaction(async t => {
    await VideoPlaylistModel.resetPlaylistsOfChannel(videoChannelInstance.id, t)

    await videoChannelInstance.destroy({ transaction: t })

    auditLogger.delete(getAuditIdFromRes(res), new VideoChannelAuditView(videoChannelInstance.toFormattedJSON()))
    logger.info('Video channel %s deleted.', videoChannelInstance.Actor.url)
  })

  return res.type('json').status(HttpStatusCode.NO_CONTENT_204).end()
}

async function getVideoChannel (req: express.Request, res: express.Response) {
  const videoChannel = res.locals.videoChannel

  if (videoChannel.isOutdated()) {
    JobQueue.Instance.createJob({ type: 'activitypub-refresher', payload: { type: 'actor', url: videoChannel.Actor.url } })
  }

  return res.json(videoChannel.toFormattedJSON())
}

async function listVideoChannelPlaylists (req: express.Request, res: express.Response) {
  const serverActor = await getServerActor()

  const resultList = await VideoPlaylistModel.listForApi({
    followerActorId: serverActor.id,
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    videoChannelId: res.locals.videoChannel.id,
    type: req.query.playlistType
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function listVideoChannelVideos (req: express.Request, res: express.Response) {
  const videoChannelInstance = res.locals.videoChannel
  const followerActorId = isUserAbleToSearchRemoteURI(res) ? null : undefined
  const countVideos = getCountVideos(req)
  const query = req.query as VideosCommonQuery

  const apiOptions = await Hooks.wrapObject({
    followerActorId,
    start: query.start,
    count: query.count,
    sort: query.sort,
    includeLocalVideos: true,
    categoryOneOf: query.categoryOneOf,
    licenceOneOf: query.licenceOneOf,
    languageOneOf: query.languageOneOf,
    tagsOneOf: query.tagsOneOf,
    tagsAllOf: query.tagsAllOf,
    filter: query.filter,
    nsfw: buildNSFWFilter(res, query.nsfw),
    withFiles: false,
    videoChannelId: videoChannelInstance.id,
    user: res.locals.oauth ? res.locals.oauth.token.User : undefined,
    countVideos
  }, 'filter:api.video-channels.videos.list.params')

  const resultList = await Hooks.wrapPromiseFun(
    VideoModel.listForApi,
    apiOptions,
    'filter:api.video-channels.videos.list.result'
  )

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}
