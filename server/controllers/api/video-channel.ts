import * as express from 'express'
import { getFormattedObjects, getServerActor } from '../../helpers/utils'
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
  videoChannelsUpdateValidator
} from '../../middlewares'
import { VideoChannelModel } from '../../models/video/video-channel'
import { videoChannelsNameWithHostValidator, videosSortValidator } from '../../middlewares/validators'
import { sendUpdateActor } from '../../lib/activitypub/send'
import { VideoChannelCreate, VideoChannelUpdate } from '../../../shared'
import { createVideoChannel } from '../../lib/video-channel'
import { buildNSFWFilter, createReqFiles, isUserAbleToSearchRemoteURI } from '../../helpers/express-utils'
import { setAsyncActorKeys } from '../../lib/activitypub'
import { AccountModel } from '../../models/account/account'
import { CONFIG, IMAGE_MIMETYPE_EXT, sequelizeTypescript } from '../../initializers'
import { logger } from '../../helpers/logger'
import { VideoModel } from '../../models/video/video'
import { updateAvatarValidator } from '../../middlewares/validators/avatar'
import { updateActorAvatarFile } from '../../lib/avatar'
import { auditLoggerFactory, VideoChannelAuditView } from '../../helpers/audit-logger'
import { resetSequelizeInstance } from '../../helpers/database-utils'

const auditLogger = auditLoggerFactory('channels')
const reqAvatarFile = createReqFiles([ 'avatarfile' ], IMAGE_MIMETYPE_EXT, { avatarfile: CONFIG.STORAGE.AVATARS_DIR })

const videoChannelRouter = express.Router()

videoChannelRouter.get('/',
  paginationValidator,
  videoChannelsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listVideoChannels)
)

videoChannelRouter.post('/',
  authenticate,
  videoChannelsAddValidator,
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

async function listVideoChannels (req: express.Request, res: express.Response, next: express.NextFunction) {
  const serverActor = await getServerActor()
  const resultList = await VideoChannelModel.listForApi(serverActor.id, req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function updateVideoChannelAvatar (req: express.Request, res: express.Response, next: express.NextFunction) {
  const avatarPhysicalFile = req.files[ 'avatarfile' ][ 0 ]
  const videoChannel = res.locals.videoChannel as VideoChannelModel
  const oldVideoChannelAuditKeys = new VideoChannelAuditView(videoChannel.toFormattedJSON())

  const avatar = await updateActorAvatarFile(avatarPhysicalFile, videoChannel.Actor, videoChannel)

  auditLogger.update(
    res.locals.oauth.token.User.Account.Actor.getIdentifier(),
    new VideoChannelAuditView(videoChannel.toFormattedJSON()),
    oldVideoChannelAuditKeys
  )

  return res
    .json({
      avatar: avatar.toFormattedJSON()
    })
    .end()
}

async function addVideoChannel (req: express.Request, res: express.Response) {
  const videoChannelInfo: VideoChannelCreate = req.body
  const account: AccountModel = res.locals.oauth.token.User.Account

  const videoChannelCreated: VideoChannelModel = await sequelizeTypescript.transaction(async t => {
    return createVideoChannel(videoChannelInfo, account, t)
  })

  setAsyncActorKeys(videoChannelCreated.Actor)
    .catch(err => logger.error('Cannot set async actor keys for account %s.', videoChannelCreated.Actor.uuid, { err }))

  auditLogger.create(
    res.locals.oauth.token.User.Account.Actor.getIdentifier(),
    new VideoChannelAuditView(videoChannelCreated.toFormattedJSON())
  )
  logger.info('Video channel with uuid %s created.', videoChannelCreated.Actor.uuid)

  return res.json({
    videoChannel: {
      id: videoChannelCreated.id,
      uuid: videoChannelCreated.Actor.uuid
    }
  }).end()
}

async function updateVideoChannel (req: express.Request, res: express.Response) {
  const videoChannelInstance = res.locals.videoChannel as VideoChannelModel
  const videoChannelFieldsSave = videoChannelInstance.toJSON()
  const oldVideoChannelAuditKeys = new VideoChannelAuditView(videoChannelInstance.toFormattedJSON())
  const videoChannelInfoToUpdate = req.body as VideoChannelUpdate

  try {
    await sequelizeTypescript.transaction(async t => {
      const sequelizeOptions = {
        transaction: t
      }

      if (videoChannelInfoToUpdate.displayName !== undefined) videoChannelInstance.set('name', videoChannelInfoToUpdate.displayName)
      if (videoChannelInfoToUpdate.description !== undefined) videoChannelInstance.set('description', videoChannelInfoToUpdate.description)
      if (videoChannelInfoToUpdate.support !== undefined) videoChannelInstance.set('support', videoChannelInfoToUpdate.support)

      const videoChannelInstanceUpdated = await videoChannelInstance.save(sequelizeOptions)
      await sendUpdateActor(videoChannelInstanceUpdated, t)

      auditLogger.update(
        res.locals.oauth.token.User.Account.Actor.getIdentifier(),
        new VideoChannelAuditView(videoChannelInstanceUpdated.toFormattedJSON()),
        oldVideoChannelAuditKeys
      )
      logger.info('Video channel with name %s and uuid %s updated.', videoChannelInstance.name, videoChannelInstance.Actor.uuid)
    })
  } catch (err) {
    logger.debug('Cannot update the video channel.', { err })

    // Force fields we want to update
    // If the transaction is retried, sequelize will think the object has not changed
    // So it will skip the SQL request, even if the last one was ROLLBACKed!
    resetSequelizeInstance(videoChannelInstance, videoChannelFieldsSave)

    throw err
  }

  return res.type('json').status(204).end()
}

async function removeVideoChannel (req: express.Request, res: express.Response) {
  const videoChannelInstance: VideoChannelModel = res.locals.videoChannel

  await sequelizeTypescript.transaction(async t => {
    await videoChannelInstance.destroy({ transaction: t })

    auditLogger.delete(
      res.locals.oauth.token.User.Account.Actor.getIdentifier(),
      new VideoChannelAuditView(videoChannelInstance.toFormattedJSON())
    )
    logger.info('Video channel with name %s and uuid %s deleted.', videoChannelInstance.name, videoChannelInstance.Actor.uuid)
  })

  return res.type('json').status(204).end()
}

async function getVideoChannel (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoChannelWithVideos = await VideoChannelModel.loadAndPopulateAccountAndVideos(res.locals.videoChannel.id)

  return res.json(videoChannelWithVideos.toFormattedJSON())
}

async function listVideoChannelVideos (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoChannelInstance: VideoChannelModel = res.locals.videoChannel
  const actorId = isUserAbleToSearchRemoteURI(res) ? null : undefined

  const resultList = await VideoModel.listForApi({
    actorId,
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
    withFiles: false,
    videoChannelId: videoChannelInstance.id
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}
