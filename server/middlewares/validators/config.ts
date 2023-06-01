import express from 'express'
import { body } from 'express-validator'
import { isIntOrNull } from '@server/helpers/custom-validators/misc'
import { CONFIG, isEmailEnabled } from '@server/initializers/config'
import { HttpStatusCode } from '@shared/models/http/http-error-codes'
import { CustomConfig } from '../../../shared/models/server/custom-config.model'
import { isThemeNameValid } from '../../helpers/custom-validators/plugins'
import { isUserNSFWPolicyValid, isUserVideoQuotaDailyValid, isUserVideoQuotaValid } from '../../helpers/custom-validators/users'
import { isThemeRegistered } from '../../lib/plugins/theme-utils'
import { areValidationErrors } from './shared'

const customConfigUpdateValidator = [
  body('instance.name').exists(),
  body('instance.shortDescription').exists(),
  body('instance.description').exists(),
  body('instance.terms').exists(),
  body('instance.defaultNSFWPolicy').custom(isUserNSFWPolicyValid),
  body('instance.defaultClientRoute').exists(),
  body('instance.customizations.css').exists(),
  body('instance.customizations.javascript').exists(),

  body('services.twitter.username').exists(),
  body('services.twitter.whitelisted').isBoolean(),

  body('cache.previews.size').isInt(),
  body('cache.captions.size').isInt(),
  body('cache.torrents.size').isInt(),
  body('cache.storyboards.size').isInt(),

  body('signup.enabled').isBoolean(),
  body('signup.limit').isInt(),
  body('signup.requiresEmailVerification').isBoolean(),
  body('signup.requiresApproval').isBoolean(),
  body('signup.minimumAge').isInt(),

  body('admin.email').isEmail(),
  body('contactForm.enabled').isBoolean(),

  body('user.history.videos.enabled').isBoolean(),
  body('user.videoQuota').custom(isUserVideoQuotaValid),
  body('user.videoQuotaDaily').custom(isUserVideoQuotaDailyValid),

  body('videoChannels.maxPerUser').isInt(),

  body('transcoding.enabled').isBoolean(),
  body('transcoding.allowAdditionalExtensions').isBoolean(),
  body('transcoding.threads').isInt(),
  body('transcoding.concurrency').isInt({ min: 1 }),
  body('transcoding.resolutions.0p').isBoolean(),
  body('transcoding.resolutions.144p').isBoolean(),
  body('transcoding.resolutions.240p').isBoolean(),
  body('transcoding.resolutions.360p').isBoolean(),
  body('transcoding.resolutions.480p').isBoolean(),
  body('transcoding.resolutions.720p').isBoolean(),
  body('transcoding.resolutions.1080p').isBoolean(),
  body('transcoding.resolutions.1440p').isBoolean(),
  body('transcoding.resolutions.2160p').isBoolean(),
  body('transcoding.remoteRunners.enabled').isBoolean(),

  body('transcoding.alwaysTranscodeOriginalResolution').isBoolean(),

  body('transcoding.webtorrent.enabled').isBoolean(),
  body('transcoding.hls.enabled').isBoolean(),

  body('videoStudio.enabled').isBoolean(),
  body('videoStudio.remoteRunners.enabled').isBoolean(),

  body('import.videos.concurrency').isInt({ min: 0 }),
  body('import.videos.http.enabled').isBoolean(),
  body('import.videos.torrent.enabled').isBoolean(),

  body('import.videoChannelSynchronization.enabled').isBoolean(),

  body('trending.videos.algorithms.default').exists(),
  body('trending.videos.algorithms.enabled').exists(),

  body('followers.instance.enabled').isBoolean(),
  body('followers.instance.manualApproval').isBoolean(),

  body('theme.default').custom(v => isThemeNameValid(v) && isThemeRegistered(v)),

  body('broadcastMessage.enabled').isBoolean(),
  body('broadcastMessage.message').exists(),
  body('broadcastMessage.level').exists(),
  body('broadcastMessage.dismissable').isBoolean(),

  body('live.enabled').isBoolean(),
  body('live.allowReplay').isBoolean(),
  body('live.maxDuration').isInt(),
  body('live.maxInstanceLives').custom(isIntOrNull),
  body('live.maxUserLives').custom(isIntOrNull),
  body('live.transcoding.enabled').isBoolean(),
  body('live.transcoding.threads').isInt(),
  body('live.transcoding.resolutions.144p').isBoolean(),
  body('live.transcoding.resolutions.240p').isBoolean(),
  body('live.transcoding.resolutions.360p').isBoolean(),
  body('live.transcoding.resolutions.480p').isBoolean(),
  body('live.transcoding.resolutions.720p').isBoolean(),
  body('live.transcoding.resolutions.1080p').isBoolean(),
  body('live.transcoding.resolutions.1440p').isBoolean(),
  body('live.transcoding.resolutions.2160p').isBoolean(),
  body('live.transcoding.alwaysTranscodeOriginalResolution').isBoolean(),
  body('live.transcoding.remoteRunners.enabled').isBoolean(),

  body('search.remoteUri.users').isBoolean(),
  body('search.remoteUri.anonymous').isBoolean(),
  body('search.searchIndex.enabled').isBoolean(),
  body('search.searchIndex.url').exists(),
  body('search.searchIndex.disableLocalSearch').isBoolean(),
  body('search.searchIndex.isDefaultSearch').isBoolean(),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!checkInvalidConfigIfEmailDisabled(req.body, res)) return
    if (!checkInvalidTranscodingConfig(req.body, res)) return
    if (!checkInvalidSynchronizationConfig(req.body, res)) return
    if (!checkInvalidLiveConfig(req.body, res)) return
    if (!checkInvalidVideoStudioConfig(req.body, res)) return

    return next()
  }
]

function ensureConfigIsEditable (req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!CONFIG.WEBADMIN.CONFIGURATION.EDITION.ALLOWED) {
    return res.fail({
      status: HttpStatusCode.METHOD_NOT_ALLOWED_405,
      message: 'Server configuration is static and cannot be edited'
    })
  }

  return next()
}

// ---------------------------------------------------------------------------

export {
  customConfigUpdateValidator,
  ensureConfigIsEditable
}

function checkInvalidConfigIfEmailDisabled (customConfig: CustomConfig, res: express.Response) {
  if (isEmailEnabled()) return true

  if (customConfig.signup.requiresEmailVerification === true) {
    res.fail({ message: 'Emailer is disabled but you require signup email verification.' })
    return false
  }

  return true
}

function checkInvalidTranscodingConfig (customConfig: CustomConfig, res: express.Response) {
  if (customConfig.transcoding.enabled === false) return true

  if (customConfig.transcoding.webtorrent.enabled === false && customConfig.transcoding.hls.enabled === false) {
    res.fail({ message: 'You need to enable at least webtorrent transcoding or hls transcoding' })
    return false
  }

  return true
}

function checkInvalidSynchronizationConfig (customConfig: CustomConfig, res: express.Response) {
  if (customConfig.import.videoChannelSynchronization.enabled && !customConfig.import.videos.http.enabled) {
    res.fail({ message: 'You need to enable HTTP video import in order to enable channel synchronization' })
    return false
  }
  return true
}

function checkInvalidLiveConfig (customConfig: CustomConfig, res: express.Response) {
  if (customConfig.live.enabled === false) return true

  if (customConfig.live.allowReplay === true && customConfig.transcoding.enabled === false) {
    res.fail({ message: 'You cannot allow live replay if transcoding is not enabled' })
    return false
  }

  return true
}

function checkInvalidVideoStudioConfig (customConfig: CustomConfig, res: express.Response) {
  if (customConfig.videoStudio.enabled === false) return true

  if (customConfig.videoStudio.enabled === true && customConfig.transcoding.enabled === false) {
    res.fail({ message: 'You cannot enable video studio if transcoding is not enabled' })
    return false
  }

  return true
}
