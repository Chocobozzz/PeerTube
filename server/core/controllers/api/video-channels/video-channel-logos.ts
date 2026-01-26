import { ActorImageType, HttpStatusCode, VideoChannelActivityAction } from '@peertube/peertube-models'
import { VideoChannelActivityModel } from '@server/models/video/video-channel-activity.js'
import express from 'express'
import { auditLoggerFactory, getAuditIdFromRes, VideoChannelAuditView } from '../../../helpers/audit-logger.js'
import { createReqFiles } from '../../../helpers/express-utils.js'
import { MIMETYPES } from '../../../initializers/constants.js'
import { deleteLocalActorImageFile, updateLocalActorImageFiles } from '../../../lib/local-actor.js'
import { asyncMiddleware, authenticate } from '../../../middlewares/index.js'
import { updateAvatarValidator, updateBannerValidator } from '../../../middlewares/validators/actor-image.js'
import { videoChannelsHandleValidatorFactory } from '../../../middlewares/validators/index.js'

const auditLogger = auditLoggerFactory('channels')
const reqAvatarFile = createReqFiles([ 'avatarfile' ], MIMETYPES.IMAGE.MIMETYPE_EXT)
const reqBannerFile = createReqFiles([ 'bannerfile' ], MIMETYPES.IMAGE.MIMETYPE_EXT)

const videoChannelLogosRouter = express.Router()

videoChannelLogosRouter.post(
  '/:handle/avatar/pick',
  authenticate,
  reqAvatarFile,
  asyncMiddleware(videoChannelsHandleValidatorFactory({ checkIsLocal: true, checkCanManage: true, checkIsOwner: false })),
  updateAvatarValidator,
  asyncMiddleware(updateVideoChannelAvatar)
)

videoChannelLogosRouter.post(
  '/:handle/banner/pick',
  authenticate,
  reqBannerFile,
  asyncMiddleware(videoChannelsHandleValidatorFactory({ checkIsLocal: true, checkCanManage: true, checkIsOwner: false })),
  updateBannerValidator,
  asyncMiddleware(updateVideoChannelBanner)
)

videoChannelLogosRouter.delete(
  '/:handle/avatar',
  authenticate,
  asyncMiddleware(videoChannelsHandleValidatorFactory({ checkIsLocal: true, checkCanManage: true, checkIsOwner: false })),
  asyncMiddleware(deleteVideoChannelAvatar)
)

videoChannelLogosRouter.delete(
  '/:handle/banner',
  authenticate,
  asyncMiddleware(videoChannelsHandleValidatorFactory({ checkIsLocal: true, checkCanManage: true, checkIsOwner: false })),
  asyncMiddleware(deleteVideoChannelBanner)
)

// ---------------------------------------------------------------------------

export {
  videoChannelLogosRouter
}

// ---------------------------------------------------------------------------

async function updateVideoChannelBanner (req: express.Request, res: express.Response) {
  const bannerPhysicalFile = req.files['bannerfile'][0]
  const videoChannel = res.locals.videoChannel
  const oldVideoChannelAuditKeys = new VideoChannelAuditView(videoChannel.toFormattedJSON())

  const banners = await updateLocalActorImageFiles({
    accountOrChannel: videoChannel,
    imagePhysicalFile: bannerPhysicalFile,
    type: ActorImageType.BANNER,
    sendActorUpdate: true
  })

  await VideoChannelActivityModel.addChannelActivity({
    action: VideoChannelActivityAction.UPDATE,
    user: res.locals.oauth.token.User,
    channel: videoChannel,
    transaction: undefined
  })

  auditLogger.update(getAuditIdFromRes(res), new VideoChannelAuditView(videoChannel.toFormattedJSON()), oldVideoChannelAuditKeys)

  return res.json({
    banners: banners.map(b => b.toFormattedJSON())
  })
}

async function updateVideoChannelAvatar (req: express.Request, res: express.Response) {
  const avatarPhysicalFile = req.files['avatarfile'][0]
  const videoChannel = res.locals.videoChannel
  const oldVideoChannelAuditKeys = new VideoChannelAuditView(videoChannel.toFormattedJSON())

  const avatars = await updateLocalActorImageFiles({
    accountOrChannel: videoChannel,
    imagePhysicalFile: avatarPhysicalFile,
    type: ActorImageType.AVATAR,
    sendActorUpdate: true
  })

  await VideoChannelActivityModel.addChannelActivity({
    action: VideoChannelActivityAction.UPDATE,
    user: res.locals.oauth.token.User,
    channel: videoChannel,
    transaction: undefined
  })

  auditLogger.update(getAuditIdFromRes(res), new VideoChannelAuditView(videoChannel.toFormattedJSON()), oldVideoChannelAuditKeys)

  return res.json({
    avatars: avatars.map(a => a.toFormattedJSON())
  })
}

async function deleteVideoChannelAvatar (req: express.Request, res: express.Response) {
  const videoChannel = res.locals.videoChannel

  await deleteLocalActorImageFile(videoChannel, ActorImageType.AVATAR)

  await VideoChannelActivityModel.addChannelActivity({
    action: VideoChannelActivityAction.UPDATE,
    user: res.locals.oauth.token.User,
    channel: videoChannel,
    transaction: undefined
  })

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function deleteVideoChannelBanner (req: express.Request, res: express.Response) {
  const videoChannel = res.locals.videoChannel

  await deleteLocalActorImageFile(videoChannel, ActorImageType.BANNER)

  await VideoChannelActivityModel.addChannelActivity({
    action: VideoChannelActivityAction.UPDATE,
    user: res.locals.oauth.token.User,
    channel: videoChannel,
    transaction: undefined
  })

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}
