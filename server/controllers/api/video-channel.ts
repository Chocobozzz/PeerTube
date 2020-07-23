import * as express from 'express'
import { getFormattedObjects } from '../../helpers/utils'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  commonVideosFiltersValidator,
  optionalAuthenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort,
  videoChannelsAddValidator,
  videoChannelsRemoveValidator,
  videoChannelsSortValidator,
  videoChannelsUpdateValidator,
  videoPlaylistsSortValidator
} from '../../middlewares'
import { VideoChannelModel } from '../../models/video/video-channel'
import { videoChannelsNameWithHostValidator, videosSortValidator, videoChannelsOwnSearchValidator } from '../../middlewares/validators'
import { sendUpdateActor } from '../../lib/activitypub/send'
import { VideoChannelCreate, VideoChannelUpdate } from '../../../shared'
import { createLocalVideoChannel, federateAllVideosOfChannel } from '../../lib/video-channel'
import { buildNSFWFilter, createReqFiles, getCountVideos, isUserAbleToSearchRemoteURI } from '../../helpers/express-utils'
import { setAsyncActorKeys } from '../../lib/activitypub/actor'
import { AccountModel } from '../../models/account/account'
import { MIMETYPES } from '../../initializers/constants'
import { logger } from '../../helpers/logger'
import { VideoModel } from '../../models/video/video'
import { updateAvatarValidator } from '../../middlewares/validators/avatar'
import { updateActorAvatarFile } from '../../lib/avatar'
import { auditLoggerFactory, getAuditIdFromRes, VideoChannelAuditView } from '../../helpers/audit-logger'
import { resetSequelizeInstance } from '../../helpers/database-utils'
import { JobQueue } from '../../lib/job-queue'
import { VideoPlaylistModel } from '../../models/video/video-playlist'
import { commonVideoPlaylistFiltersValidator } from '../../middlewares/validators/videos/video-playlists'
import { CONFIG } from '../../initializers/config'
import { sequelizeTypescript } from '../../initializers/database'
import { MChannelAccountDefault } from '@server/types/models'
import { getServerActor } from '@server/models/application/application'

const auditLogger = auditLoggerFactory('channels')
const reqAvatarFile = createReqFiles([ 'avatarfile' ], MIMETYPES.IMAGE.MIMETYPE_EXT, { avatarfile: CONFIG.STORAGE.TMP_DIR })

const videoChannelRouter = express.Router()

videoChannelRouter.get('/',
  paginationValidator,
  videoChannelsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  videoChannelsOwnSearchValidator,
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
  setDefaultSort,
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

async function updateVideoChannelAvatar (req: express.Request, res: express.Response) {
  const avatarPhysicalFile = req.files['avatarfile'][0]
  const videoChannel = res.locals.videoChannel
  const oldVideoChannelAuditKeys = new VideoChannelAuditView(videoChannel.toFormattedJSON())

  const avatar = await updateActorAvatarFile(avatarPhysicalFile, videoChannel)

  auditLogger.update(getAuditIdFromRes(res), new VideoChannelAuditView(videoChannel.toFormattedJSON()), oldVideoChannelAuditKeys)

  return res
    .json({
      avatar: avatar.toFormattedJSON()
    })
    .end()
}

async function addVideoChannel (req: express.Request, res: express.Response) {
  const videoChannelInfo: VideoChannelCreate = req.body

  const videoChannelCreated = await sequelizeTypescript.transaction(async t => {
    const account = await AccountModel.load(res.locals.oauth.token.User.Account.id, t)

    return createLocalVideoChannel(videoChannelInfo, account, t)
  })

  setAsyncActorKeys(videoChannelCreated.Actor)
    .catch(err => logger.error('Cannot set async actor keys for account %s.', videoChannelCreated.Actor.url, { err }))

  auditLogger.create(getAuditIdFromRes(res), new VideoChannelAuditView(videoChannelCreated.toFormattedJSON()))
  logger.info('Video channel %s created.', videoChannelCreated.Actor.url)

  return res.json({
    videoChannel: {
      id: videoChannelCreated.id
    }
  }).end()
}

async function updateVideoChannel (req: express.Request, res: express.Response) {
  const videoChannelInstance = res.locals.videoChannel
  const videoChannelFieldsSave = videoChannelInstance.toJSON()
  const oldVideoChannelAuditKeys = new VideoChannelAuditView(videoChannelInstance.toFormattedJSON())
  const videoChannelInfoToUpdate = req.body as VideoChannelUpdate
  let doBulkVideoUpdate = false

  try {
    await sequelizeTypescript.transaction(async t => {
      const sequelizeOptions = {
        transaction: t
      }

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

      const videoChannelInstanceUpdated = await videoChannelInstance.save(sequelizeOptions) as MChannelAccountDefault
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

  res.type('json').status(204).end()

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

  return res.type('json').status(204).end()
}

async function getVideoChannel (req: express.Request, res: express.Response) {
  const videoChannelWithVideos = await VideoChannelModel.loadAndPopulateAccountAndVideos(res.locals.videoChannel.id)

  if (videoChannelWithVideos.isOutdated()) {
    JobQueue.Instance.createJob({ type: 'activitypub-refresher', payload: { type: 'actor', url: videoChannelWithVideos.Actor.url } })
  }

  return res.json(videoChannelWithVideos.toFormattedJSON())
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

  const resultList = await VideoModel.listForApi({
    followerActorId,
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    includeLocalVideos: true,
    categoryOneOf: req.query.categoryOneOf,
    licenceOneOf: req.query.licenceOneOf,
    languageOneOf: req.query.languageOneOf,
    tagsOneOf: req.query.tagsOneOf,
    tagsAllOf: req.query.tagsAllOf,
    filter: req.query.filter,
    nsfw: buildNSFWFilter(res, req.query.nsfw),
    withFiles: false,
    videoChannelId: videoChannelInstance.id,
    user: res.locals.oauth ? res.locals.oauth.token.User : undefined,
    countVideos
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}
