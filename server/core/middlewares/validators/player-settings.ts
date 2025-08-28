import { UserRight } from '@peertube/peertube-models'
import { isBooleanValid, toBooleanOrNull } from '@server/helpers/custom-validators/misc.js'
import { isPlayerChannelThemeSettingValid, isPlayerVideoThemeSettingValid } from '@server/helpers/custom-validators/player-settings.js'
import express from 'express'
import { body, query } from 'express-validator'
import { checkUserCanManageAccount } from './shared/users.js'
import { areValidationErrors, isValidVideoIdParam } from './shared/utils.js'
import { checkCanSeeVideo, checkUserCanManageVideo, doesVideoExist } from './shared/videos.js'

export const getVideoPlayerSettingsValidator = [
  isValidVideoIdParam('videoId'),

  query('raw')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    const raw = req.query.raw === true

    if (!await doesVideoExist(req.params.videoId, res, raw ? 'all' : 'only-video-and-blacklist')) return

    const video = res.locals.onlyVideo || res.locals.videoAll
    if (!await checkCanSeeVideo({ req, res, video, paramId: req.params.videoId })) return

    if (raw === true) {
      const user = res.locals.oauth?.token.User

      if (!checkUserCanManageVideo({ user, video: res.locals.videoAll, right: UserRight.UPDATE_ANY_VIDEO, req, res })) return
    }

    return next()
  }
]

export const getChannelPlayerSettingsValidator = [
  query('raw')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (req.query.raw === true) {
      const account = res.locals.videoChannel.Account
      const user = res.locals.oauth?.token.User

      if (!checkUserCanManageAccount({ account, user, req, res, specialRight: UserRight.MANAGE_ANY_VIDEO_CHANNEL })) return false
    }

    return next()
  }
]

export const updateVideoPlayerSettingsValidator = [
  isValidVideoIdParam('videoId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (!await doesVideoExist(req.params.videoId, res, 'all')) return

    const user = res.locals.oauth.token.User
    if (!checkUserCanManageVideo({ user, video: res.locals.videoAll, right: UserRight.UPDATE_ANY_VIDEO, req, res })) return

    return next()
  }
]

export const updatePlayerSettingsValidatorFactory = (type: 'video' | 'channel') => [
  body('theme')
    .custom(v => {
      return type === 'video'
        ? isPlayerVideoThemeSettingValid(v)
        : isPlayerChannelThemeSettingValid(v)
    }),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]
