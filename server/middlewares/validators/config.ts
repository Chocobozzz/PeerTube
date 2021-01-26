import * as express from 'express'
import { body } from 'express-validator'
import { isIntOrNull } from '@server/helpers/custom-validators/misc'
import { isEmailEnabled } from '@server/initializers/config'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'
import { CustomConfig } from '../../../shared/models/server/custom-config.model'
import { isThemeNameValid } from '../../helpers/custom-validators/plugins'
import { isUserNSFWPolicyValid, isUserVideoQuotaDailyValid, isUserVideoQuotaValid } from '../../helpers/custom-validators/users'
import { logger } from '../../helpers/logger'
import { isThemeRegistered } from '../../lib/plugins/theme-utils'
import { areValidationErrors } from './utils'

const customConfigUpdateValidator = [
  body('instance.name').exists().withMessage('Should have a valid instance name'),
  body('instance.shortDescription').exists().withMessage('Should have a valid instance short description'),
  body('instance.description').exists().withMessage('Should have a valid instance description'),
  body('instance.terms').exists().withMessage('Should have a valid instance terms'),
  body('instance.defaultNSFWPolicy').custom(isUserNSFWPolicyValid).withMessage('Should have a valid NSFW policy'),
  body('instance.defaultClientRoute').exists().withMessage('Should have a valid instance default client route'),
  body('instance.defaultTrendingRoute').exists().withMessage('Should have a valid instance default trending route'),
  body('instance.customizations.css').exists().withMessage('Should have a valid instance CSS customization'),
  body('instance.customizations.javascript').exists().withMessage('Should have a valid instance JavaScript customization'),

  body('services.twitter.username').exists().withMessage('Should have a valid twitter username'),
  body('services.twitter.whitelisted').isBoolean().withMessage('Should have a valid twitter whitelisted boolean'),

  body('cache.previews.size').isInt().withMessage('Should have a valid previews cache size'),
  body('cache.captions.size').isInt().withMessage('Should have a valid captions cache size'),

  body('signup.enabled').isBoolean().withMessage('Should have a valid signup enabled boolean'),
  body('signup.limit').isInt().withMessage('Should have a valid signup limit'),
  body('signup.requiresEmailVerification').isBoolean().withMessage('Should have a valid requiresEmailVerification boolean'),

  body('admin.email').isEmail().withMessage('Should have a valid administrator email'),
  body('contactForm.enabled').isBoolean().withMessage('Should have a valid contact form enabled boolean'),

  body('user.videoQuota').custom(isUserVideoQuotaValid).withMessage('Should have a valid video quota'),
  body('user.videoQuotaDaily').custom(isUserVideoQuotaDailyValid).withMessage('Should have a valid daily video quota'),

  body('transcoding.enabled').isBoolean().withMessage('Should have a valid transcoding enabled boolean'),
  body('transcoding.allowAdditionalExtensions').isBoolean().withMessage('Should have a valid additional extensions boolean'),
  body('transcoding.threads').isInt().withMessage('Should have a valid transcoding threads number'),
  body('transcoding.resolutions.0p').isBoolean().withMessage('Should have a valid transcoding 0p resolution enabled boolean'),
  body('transcoding.resolutions.240p').isBoolean().withMessage('Should have a valid transcoding 240p resolution enabled boolean'),
  body('transcoding.resolutions.360p').isBoolean().withMessage('Should have a valid transcoding 360p resolution enabled boolean'),
  body('transcoding.resolutions.480p').isBoolean().withMessage('Should have a valid transcoding 480p resolution enabled boolean'),
  body('transcoding.resolutions.720p').isBoolean().withMessage('Should have a valid transcoding 720p resolution enabled boolean'),
  body('transcoding.resolutions.1080p').isBoolean().withMessage('Should have a valid transcoding 1080p resolution enabled boolean'),
  body('transcoding.resolutions.1440p').isBoolean().withMessage('Should have a valid transcoding 1440p resolution enabled boolean'),
  body('transcoding.resolutions.2160p').isBoolean().withMessage('Should have a valid transcoding 2160p resolution enabled boolean'),

  body('transcoding.webtorrent.enabled').isBoolean().withMessage('Should have a valid webtorrent transcoding enabled boolean'),
  body('transcoding.hls.enabled').isBoolean().withMessage('Should have a valid hls transcoding enabled boolean'),

  body('import.videos.http.enabled').isBoolean().withMessage('Should have a valid import video http enabled boolean'),
  body('import.videos.torrent.enabled').isBoolean().withMessage('Should have a valid import video torrent enabled boolean'),

  body('followers.instance.enabled').isBoolean().withMessage('Should have a valid followers of instance boolean'),
  body('followers.instance.manualApproval').isBoolean().withMessage('Should have a valid manual approval boolean'),

  body('theme.default').custom(v => isThemeNameValid(v) && isThemeRegistered(v)).withMessage('Should have a valid theme'),

  body('broadcastMessage.enabled').isBoolean().withMessage('Should have a valid broadcast message enabled boolean'),
  body('broadcastMessage.message').exists().withMessage('Should have a valid broadcast message'),
  body('broadcastMessage.level').exists().withMessage('Should have a valid broadcast level'),
  body('broadcastMessage.dismissable').isBoolean().withMessage('Should have a valid broadcast dismissable boolean'),

  body('live.enabled').isBoolean().withMessage('Should have a valid live enabled boolean'),
  body('live.allowReplay').isBoolean().withMessage('Should have a valid live allow replay boolean'),
  body('live.maxDuration').isInt().withMessage('Should have a valid live max duration'),
  body('live.maxInstanceLives').custom(isIntOrNull).withMessage('Should have a valid max instance lives'),
  body('live.maxUserLives').custom(isIntOrNull).withMessage('Should have a valid max user lives'),
  body('live.transcoding.enabled').isBoolean().withMessage('Should have a valid live transcoding enabled boolean'),
  body('live.transcoding.threads').isInt().withMessage('Should have a valid live transcoding threads'),
  body('live.transcoding.resolutions.240p').isBoolean().withMessage('Should have a valid transcoding 240p resolution enabled boolean'),
  body('live.transcoding.resolutions.360p').isBoolean().withMessage('Should have a valid transcoding 360p resolution enabled boolean'),
  body('live.transcoding.resolutions.480p').isBoolean().withMessage('Should have a valid transcoding 480p resolution enabled boolean'),
  body('live.transcoding.resolutions.720p').isBoolean().withMessage('Should have a valid transcoding 720p resolution enabled boolean'),
  body('live.transcoding.resolutions.1080p').isBoolean().withMessage('Should have a valid transcoding 1080p resolution enabled boolean'),
  body('live.transcoding.resolutions.1440p').isBoolean().withMessage('Should have a valid transcoding 1440p resolution enabled boolean'),
  body('live.transcoding.resolutions.2160p').isBoolean().withMessage('Should have a valid transcoding 2160p resolution enabled boolean'),

  body('search.remoteUri.users').isBoolean().withMessage('Should have a remote URI search for users boolean'),
  body('search.remoteUri.anonymous').isBoolean().withMessage('Should have a valid remote URI search for anonymous boolean'),
  body('search.searchIndex.enabled').isBoolean().withMessage('Should have a valid search index enabled boolean'),
  body('search.searchIndex.url').exists().withMessage('Should have a valid search index URL'),
  body('search.searchIndex.disableLocalSearch').isBoolean().withMessage('Should have a valid search index disable local search boolean'),
  body('search.searchIndex.isDefaultSearch').isBoolean().withMessage('Should have a valid search index default enabled boolean'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking customConfigUpdateValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!checkInvalidConfigIfEmailDisabled(req.body, res)) return
    if (!checkInvalidTranscodingConfig(req.body, res)) return
    if (!checkInvalidLiveConfig(req.body, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  customConfigUpdateValidator
}

function checkInvalidConfigIfEmailDisabled (customConfig: CustomConfig, res: express.Response) {
  if (isEmailEnabled()) return true

  if (customConfig.signup.requiresEmailVerification === true) {
    res.status(HttpStatusCode.BAD_REQUEST_400)
       .send({ error: 'Emailer is disabled but you require signup email verification.' })
       .end()
    return false
  }

  return true
}

function checkInvalidTranscodingConfig (customConfig: CustomConfig, res: express.Response) {
  if (customConfig.transcoding.enabled === false) return true

  if (customConfig.transcoding.webtorrent.enabled === false && customConfig.transcoding.hls.enabled === false) {
    res.status(HttpStatusCode.BAD_REQUEST_400)
       .send({ error: 'You need to enable at least webtorrent transcoding or hls transcoding' })
       .end()
    return false
  }

  return true
}

function checkInvalidLiveConfig (customConfig: CustomConfig, res: express.Response) {
  if (customConfig.live.enabled === false) return true

  if (customConfig.live.allowReplay === true && customConfig.transcoding.enabled === false) {
    res.status(HttpStatusCode.BAD_REQUEST_400)
       .send({ error: 'You cannot allow live replay if transcoding is not enabled' })
       .end()
    return false
  }

  return true
}
