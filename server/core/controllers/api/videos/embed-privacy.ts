import {
  HttpStatusCode,
  UserRight,
  VideoChannelActivityAction,
  VideoEmbedPrivacy,
  VideoEmbedPrivacyAllowed,
  VideoEmbedPrivacyPolicy,
  VideoEmbedPrivacyUpdate
} from '@peertube/peertube-models'
import { getAuthUser } from '@server/helpers/express-utils.js'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { VIDEO_EMBED_PRIVACY_POLICIES } from '@server/initializers/constants.js'
import { federateVideoIfNeeded } from '@server/lib/activitypub/videos/index.js'
import { checkCanManageVideo } from '@server/middlewares/validators/shared/videos.js'
import { VideoChannelActivityModel } from '@server/models/video/video-channel-activity.js'
import { VideoEmbedPrivacyDomainModel } from '@server/models/video/video-embed-privacy-domain.js'
import { VideoPasswordModel } from '@server/models/video/video-password.js'
import { VideoModel } from '@server/models/video/video.js'
import express from 'express'
import { Transaction } from 'sequelize'
import { asyncMiddleware, authenticate, optionalAuthenticate } from '../../../middlewares/index.js'
import {
  getVideoEmbedPrivacyValidator,
  isVideoEmbedOnDomainAllowedValidator,
  updateVideoEmbedPrivacyValidator
} from '../../../middlewares/validators/index.js'

const lTags = loggerTagsFactory('api', 'video', 'embed-privacy')
const videoEmbedPrivacyRouter = express.Router()

videoEmbedPrivacyRouter.get(
  '/:videoId/embed-privacy',
  authenticate,
  asyncMiddleware(getVideoEmbedPrivacyValidator),
  asyncMiddleware(getVideoEmbedPrivacy)
)

videoEmbedPrivacyRouter.put(
  '/:videoId/embed-privacy',
  authenticate,
  asyncMiddleware(updateVideoEmbedPrivacyValidator),
  asyncMiddleware(updateVideoEmbedPrivacy)
)

videoEmbedPrivacyRouter.get(
  '/:videoId/embed-privacy/allowed',
  optionalAuthenticate,
  asyncMiddleware(isVideoEmbedOnDomainAllowedValidator),
  asyncMiddleware(isVideoEmbedOnDomainAllowed)
)

// ---------------------------------------------------------------------------

export {
  videoEmbedPrivacyRouter
}

// ---------------------------------------------------------------------------

async function getVideoEmbedPrivacy (req: express.Request, res: express.Response) {
  const video = res.locals.videoWithRights
  const domains = await VideoEmbedPrivacyDomainModel.list(video.id)

  return res.json(
    {
      policy: {
        id: video.embedPrivacyPolicy,
        label: VIDEO_EMBED_PRIVACY_POLICIES[video.embedPrivacyPolicy]
      },
      domains: domains.map(d => d.domain)
    } satisfies VideoEmbedPrivacy
  )
}

async function isVideoEmbedOnDomainAllowed (req: express.Request, res: express.Response) {
  const video = res.locals.videoWithBlacklist

  const domainAllowed = video.embedPrivacyPolicy === VideoEmbedPrivacyPolicy.ALL_ALLOWED
    ? true
    : await VideoEmbedPrivacyDomainModel.isDomainAllowed(video.id, req.query.domain)

  const user = getAuthUser(res)

  let userBypassAllowed = domainAllowed === true
    ? null
    : false

  if (domainAllowed === false && user) {
    userBypassAllowed = await checkCanManageVideo({
      user,
      video: await VideoModel.loadWithRights(video.id),
      right: UserRight.UPDATE_ANY_VIDEO,
      checkIsOwner: false,
      checkIsLocal: false,
      req,
      res: null
    })
  }

  return res.json({ domainAllowed, userBypassAllowed } satisfies VideoEmbedPrivacyAllowed)
}

async function updateVideoEmbedPrivacy (req: express.Request, res: express.Response) {
  const video = res.locals.videoFull
  const body = req.body as VideoEmbedPrivacyUpdate

  await VideoPasswordModel.sequelize.transaction(async (t: Transaction) => {
    video.embedPrivacyPolicy = body.policy

    await video.save({ transaction: t })

    await VideoEmbedPrivacyDomainModel.deleteAllDomains(video.id, t)
    await VideoEmbedPrivacyDomainModel.addDomains(body.domains, video.id, t)

    await VideoChannelActivityModel.addVideoActivity({
      action: VideoChannelActivityAction.UPDATE_EMBED_POLICY,
      user: res.locals.oauth.token.User,
      channel: video.VideoChannel,
      video,
      transaction: t
    })

    await federateVideoIfNeeded(video, false, t)
  })

  logger.info(`Video embed policy for video with name ${video.name} and uuid ${video.uuid} have been updated`, lTags(video.uuid))

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}
