import { UserRight, VideoEmbedPrivacyPolicy, VideoEmbedPrivacyUpdate } from '@peertube/peertube-models'
import { isHostValid } from '@server/helpers/custom-validators/servers.js'
import { areVideoEmbedPrivacyDomainsValid, isVideoEmbedPrivacyPolicyValid } from '@server/helpers/custom-validators/video-embed-privacy.js'
import express from 'express'
import { body, query } from 'express-validator'
import { areValidationErrors, checkCanManageVideo, doesVideoExist, isValidVideoIdParam } from '../shared/index.js'

export const isVideoEmbedOnDomainAllowedValidator = [
  isValidVideoIdParam('videoId'),

  query('domain')
    .custom(isHostValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, 'only-video-and-blacklist')) return

    return next()
  }
]

export const getVideoEmbedPrivacyValidator = [
  isValidVideoIdParam('videoId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res)) return

    if (
      !await checkCanManageVideo({
        user: res.locals.oauth.token.User,
        video: res.locals.videoAll,
        right: UserRight.UPDATE_ANY_VIDEO,
        checkIsOwner: false,
        checkIsLocal: true,
        req,
        res
      })
    ) return

    return next()
  }
]

export const updateVideoEmbedPrivacyValidator = [
  isValidVideoIdParam('videoId'),

  body('policy')
    .custom(isVideoEmbedPrivacyPolicyValid),

  body('domains')
    .custom(areVideoEmbedPrivacyDomainsValid)
    .withMessage('Domains should be a valid array of hosts'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res)) return

    if (
      !await checkCanManageVideo({
        user: res.locals.oauth.token.User,
        video: res.locals.videoAll,
        right: UserRight.UPDATE_ANY_VIDEO,
        checkIsOwner: false,
        checkIsLocal: true,
        req,
        res
      })
    ) return

    const body: VideoEmbedPrivacyUpdate = req.body
    if (body.policy === VideoEmbedPrivacyPolicy.ALL_ALLOWED && body.domains.length !== 0) {
      return res.fail({
        message: req.t('Domains should be empty when policy is in "all allowed" mode')
      })
    }

    return next()
  }
]

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------
