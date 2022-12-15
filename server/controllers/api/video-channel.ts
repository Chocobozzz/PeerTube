import express from 'express'
import { pickCommonVideoQuery } from '@server/helpers/query'
import { getBiggestActorImage } from '@server/lib/actor-image'
import { Hooks } from '@server/lib/plugins/hooks'
import { ActorFollowModel } from '@server/models/actor/actor-follow'
import { getServerActor } from '@server/models/application/application'
import { guessAdditionalAttributesFromQuery } from '@server/models/video/formatter/video-format-utils'
import { MChannelBannerAccountDefault } from '@server/types/models'
import { ActorImageType, HttpStatusCode, VideoChannelCreate, VideoChannelUpdate, VideosImportInChannelCreate } from '@shared/models'
import { auditLoggerFactory, getAuditIdFromRes, VideoChannelAuditView } from '../../helpers/audit-logger'
import { resetSequelizeInstance } from '../../helpers/database-utils'
import { buildNSFWFilter, createReqFiles, getCountVideos, isUserAbleToSearchRemoteURI } from '../../helpers/express-utils'
import { logger } from '../../helpers/logger'
import { getFormattedObjects } from '../../helpers/utils'
import { MIMETYPES } from '../../initializers/constants'
import { sequelizeTypescript } from '../../initializers/database'
import { sendUpdateActor } from '../../lib/activitypub/send'
import { JobQueue } from '../../lib/job-queue'
import { deleteLocalActorImageFile, updateLocalActorImageFiles } from '../../lib/local-actor'
import { createLocalVideoChannel, federateAllVideosOfChannel } from '../../lib/video-channel'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  commonVideosFiltersValidator,
  ensureCanManageChannelOrAccount,
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
import {
  ensureChannelOwnerCanUpload,
  ensureIsLocalChannel,
  videoChannelImportVideosValidator,
  videoChannelsFollowersSortValidator,
  videoChannelsListValidator,
  videoChannelsNameWithHostValidator,
  videosSortValidator
} from '../../middlewares/validators'
import { updateAvatarValidator, updateBannerValidator } from '../../middlewares/validators/actor-image'
import { commonVideoPlaylistFiltersValidator } from '../../middlewares/validators/videos/video-playlists'
import { AccountModel } from '../../models/account/account'
import { VideoModel } from '../../models/video/video'
import { VideoChannelModel } from '../../models/video/video-channel'
import { VideoPlaylistModel } from '../../models/video/video-playlist'

const auditLogger = auditLoggerFactory('channels')
const reqAvatarFile = createReqFiles([ 'avatarfile' ], MIMETYPES.IMAGE.MIMETYPE_EXT)
const reqBannerFile = createReqFiles([ 'bannerfile' ], MIMETYPES.IMAGE.MIMETYPE_EXT)

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
  asyncMiddleware(videoChannelsNameWithHostValidator),
  ensureIsLocalChannel,
  ensureCanManageChannelOrAccount,
  updateAvatarValidator,
  asyncMiddleware(updateVideoChannelAvatar)
)

videoChannelRouter.post('/:nameWithHost/banner/pick',
  authenticate,
  reqBannerFile,
  asyncMiddleware(videoChannelsNameWithHostValidator),
  ensureIsLocalChannel,
  ensureCanManageChannelOrAccount,
  updateBannerValidator,
  asyncMiddleware(updateVideoChannelBanner)
)

videoChannelRouter.delete('/:nameWithHost/avatar',
  authenticate,
  asyncMiddleware(videoChannelsNameWithHostValidator),
  ensureIsLocalChannel,
  ensureCanManageChannelOrAccount,
  asyncMiddleware(deleteVideoChannelAvatar)
)

videoChannelRouter.delete('/:nameWithHost/banner',
  authenticate,
  asyncMiddleware(videoChannelsNameWithHostValidator),
  ensureIsLocalChannel,
  ensureCanManageChannelOrAccount,
  asyncMiddleware(deleteVideoChannelBanner)
)

videoChannelRouter.put('/:nameWithHost',
  authenticate,
  asyncMiddleware(videoChannelsNameWithHostValidator),
  ensureIsLocalChannel,
  ensureCanManageChannelOrAccount,
  videoChannelsUpdateValidator,
  asyncRetryTransactionMiddleware(updateVideoChannel)
)

videoChannelRouter.delete('/:nameWithHost',
  authenticate,
  asyncMiddleware(videoChannelsNameWithHostValidator),
  ensureIsLocalChannel,
  ensureCanManageChannelOrAccount,
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

videoChannelRouter.get('/:nameWithHost/followers',
  authenticate,
  asyncMiddleware(videoChannelsNameWithHostValidator),
  ensureCanManageChannelOrAccount,
  paginationValidator,
  videoChannelsFollowersSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listVideoChannelFollowers)
)

videoChannelRouter.post('/:nameWithHost/import-videos',
  authenticate,
  asyncMiddleware(videoChannelsNameWithHostValidator),
  asyncMiddleware(videoChannelImportVideosValidator),
  ensureIsLocalChannel,
  ensureCanManageChannelOrAccount,
  asyncMiddleware(ensureChannelOwnerCanUpload),
  asyncMiddleware(importVideosInChannel)
)

// ---------------------------------------------------------------------------

export {
  videoChannelRouter
}

// ---------------------------------------------------------------------------

async function listVideoChannels (req: express.Request, res: express.Response) {
  const serverActor = await getServerActor()

  const apiOptions = await Hooks.wrapObject({
    actorId: serverActor.id,
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort
  }, 'filter:api.video-channels.list.params')

  const resultList = await Hooks.wrapPromiseFun(
    VideoChannelModel.listForApi,
    apiOptions,
    'filter:api.video-channels.list.result'
  )

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function updateVideoChannelBanner (req: express.Request, res: express.Response) {
  const bannerPhysicalFile = req.files['bannerfile'][0]
  const videoChannel = res.locals.videoChannel
  const oldVideoChannelAuditKeys = new VideoChannelAuditView(videoChannel.toFormattedJSON())

  const banners = await updateLocalActorImageFiles(videoChannel, bannerPhysicalFile, ActorImageType.BANNER)

  auditLogger.update(getAuditIdFromRes(res), new VideoChannelAuditView(videoChannel.toFormattedJSON()), oldVideoChannelAuditKeys)

  return res.json({
    // TODO: remove, deprecated in 4.2
    banner: getBiggestActorImage(banners).toFormattedJSON(),
    banners: banners.map(b => b.toFormattedJSON())
  })
}

async function updateVideoChannelAvatar (req: express.Request, res: express.Response) {
  const avatarPhysicalFile = req.files['avatarfile'][0]
  const videoChannel = res.locals.videoChannel
  const oldVideoChannelAuditKeys = new VideoChannelAuditView(videoChannel.toFormattedJSON())

  const avatars = await updateLocalActorImageFiles(videoChannel, avatarPhysicalFile, ActorImageType.AVATAR)
  auditLogger.update(getAuditIdFromRes(res), new VideoChannelAuditView(videoChannel.toFormattedJSON()), oldVideoChannelAuditKeys)

  return res.json({
    // TODO: remove, deprecated in 4.2
    avatar: getBiggestActorImage(avatars).toFormattedJSON(),
    avatars: avatars.map(a => a.toFormattedJSON())
  })
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
  await JobQueue.Instance.createJob({ type: 'actor-keys', payload })

  auditLogger.create(getAuditIdFromRes(res), new VideoChannelAuditView(videoChannelCreated.toFormattedJSON()))
  logger.info('Video channel %s created.', videoChannelCreated.Actor.url)

  Hooks.runAction('action:api.video-channel.created', { videoChannel: videoChannelCreated, req, res })

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

      Hooks.runAction('action:api.video-channel.updated', { videoChannel: videoChannelInstanceUpdated, req, res })

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

    Hooks.runAction('action:api.video-channel.deleted', { videoChannel: videoChannelInstance, req, res })

    auditLogger.delete(getAuditIdFromRes(res), new VideoChannelAuditView(videoChannelInstance.toFormattedJSON()))
    logger.info('Video channel %s deleted.', videoChannelInstance.Actor.url)
  })

  return res.type('json').status(HttpStatusCode.NO_CONTENT_204).end()
}

async function getVideoChannel (req: express.Request, res: express.Response) {
  const id = res.locals.videoChannel.id
  const videoChannel = await Hooks.wrapObject(res.locals.videoChannel, 'filter:api.video-channel.get.result', { id })

  if (videoChannel.isOutdated()) {
    JobQueue.Instance.createJobAsync({ type: 'activitypub-refresher', payload: { type: 'actor', url: videoChannel.Actor.url } })
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
  const serverActor = await getServerActor()

  const videoChannelInstance = res.locals.videoChannel

  const displayOnlyForFollower = isUserAbleToSearchRemoteURI(res)
    ? null
    : {
      actorId: serverActor.id,
      orLocalVideos: true
    }

  const countVideos = getCountVideos(req)
  const query = pickCommonVideoQuery(req.query)

  const apiOptions = await Hooks.wrapObject({
    ...query,

    displayOnlyForFollower,
    nsfw: buildNSFWFilter(res, query.nsfw),
    videoChannelId: videoChannelInstance.id,
    user: res.locals.oauth ? res.locals.oauth.token.User : undefined,
    countVideos
  }, 'filter:api.video-channels.videos.list.params')

  const resultList = await Hooks.wrapPromiseFun(
    VideoModel.listForApi,
    apiOptions,
    'filter:api.video-channels.videos.list.result'
  )

  return res.json(getFormattedObjects(resultList.data, resultList.total, guessAdditionalAttributesFromQuery(query)))
}

async function listVideoChannelFollowers (req: express.Request, res: express.Response) {
  const channel = res.locals.videoChannel

  const resultList = await ActorFollowModel.listFollowersForApi({
    actorIds: [ channel.actorId ],
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    search: req.query.search,
    state: 'accepted'
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function importVideosInChannel (req: express.Request, res: express.Response) {
  const { externalChannelUrl } = req.body as VideosImportInChannelCreate

  await JobQueue.Instance.createJob({
    type: 'video-channel-import',
    payload: {
      externalChannelUrl,
      videoChannelId: res.locals.videoChannel.id,
      partOfChannelSyncId: res.locals.videoChannelSync?.id
    }
  })

  logger.info('Video import job for channel "%s" with url "%s" created.', res.locals.videoChannel.name, externalChannelUrl)

  return res.type('json').status(HttpStatusCode.NO_CONTENT_204).end()
}
