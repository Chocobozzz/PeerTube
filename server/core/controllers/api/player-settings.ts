import { PlayerChannelSettingsUpdate, PlayerVideoSettingsUpdate } from '@peertube/peertube-models'
import { sendUpdateChannelPlayerSettings, sendUpdateVideoPlayerSettings } from '@server/lib/activitypub/send/send-update.js'
import { upsertPlayerSettings } from '@server/lib/player-settings.js'
import {
  getChannelPlayerSettingsValidator,
  getVideoPlayerSettingsValidator,
  updatePlayerSettingsValidatorFactory,
  updateVideoPlayerSettingsValidator
} from '@server/middlewares/validators/player-settings.js'
import { PlayerSettingModel } from '@server/models/video/player-setting.js'
import express from 'express'
import {
  apiRateLimiter,
  asyncMiddleware,
  authenticate,
  optionalAuthenticate,
  videoChannelsHandleValidatorFactory
} from '../../middlewares/index.js'

const playerSettingsRouter = express.Router()

playerSettingsRouter.use(apiRateLimiter)

playerSettingsRouter.get(
  '/videos/:videoId',
  optionalAuthenticate,
  asyncMiddleware(getVideoPlayerSettingsValidator),
  asyncMiddleware(getVideoPlayerSettings)
)

playerSettingsRouter.put(
  '/videos/:videoId',
  authenticate,
  asyncMiddleware(updateVideoPlayerSettingsValidator),
  updatePlayerSettingsValidatorFactory('video'),
  asyncMiddleware(updateVideoPlayerSettings)
)

playerSettingsRouter.get(
  '/video-channels/:handle',
  optionalAuthenticate,
  asyncMiddleware(videoChannelsHandleValidatorFactory({ checkIsLocal: false, checkCanManage: false, checkIsOwner: false })),
  asyncMiddleware(getChannelPlayerSettingsValidator),
  asyncMiddleware(getChannelPlayerSettings)
)

playerSettingsRouter.put(
  '/video-channels/:handle',
  authenticate,
  asyncMiddleware(videoChannelsHandleValidatorFactory({ checkIsLocal: true, checkCanManage: true, checkIsOwner: false })),
  updatePlayerSettingsValidatorFactory('channel'),
  asyncMiddleware(updateChannelPlayerSettings)
)

// ---------------------------------------------------------------------------

export {
  playerSettingsRouter
}

// ---------------------------------------------------------------------------

async function getVideoPlayerSettings (req: express.Request, res: express.Response) {
  const video = res.locals.onlyVideo || res.locals.videoAll

  const { videoSetting, channelSetting } = await PlayerSettingModel.loadByVideoIdOrChannelId({
    channelId: video.channelId,
    videoId: video.id
  })

  if (req.query.raw === true) {
    return res.json(PlayerSettingModel.formatVideoPlayerRawSetting(videoSetting))
  }

  return res.json(PlayerSettingModel.formatVideoPlayerSetting({ videoSetting, channelSetting }))
}

async function getChannelPlayerSettings (req: express.Request, res: express.Response) {
  const channel = res.locals.videoChannel

  const channelSetting = await PlayerSettingModel.loadByChannelId(channel.id)

  if (req.query.raw === true) {
    return res.json(PlayerSettingModel.formatChannelPlayerRawSetting(channelSetting))
  }

  return res.json(PlayerSettingModel.formatChannelPlayerSetting({ channelSetting }))
}

// ---------------------------------------------------------------------------

async function updateVideoPlayerSettings (req: express.Request, res: express.Response) {
  const body: PlayerVideoSettingsUpdate = req.body
  const video = res.locals.videoAll

  const setting = await upsertPlayerSettings({ user: res.locals.oauth.token.User, settings: body, channel: undefined, video })

  await sendUpdateVideoPlayerSettings(video, setting, undefined)

  return res.json(PlayerSettingModel.formatVideoPlayerRawSetting(setting))
}

async function updateChannelPlayerSettings (req: express.Request, res: express.Response) {
  const body: PlayerChannelSettingsUpdate = req.body
  const channel = res.locals.videoChannel

  const settings = await upsertPlayerSettings({ user: res.locals.oauth.token.User, settings: body, channel, video: undefined })

  await sendUpdateChannelPlayerSettings(channel, settings, undefined)

  return res.json(PlayerSettingModel.formatChannelPlayerRawSetting(settings))
}
