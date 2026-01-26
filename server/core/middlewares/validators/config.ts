import { CustomConfig, HttpStatusCode } from '@peertube/peertube-models'
import { isConfigLogoTypeValid } from '@server/helpers/custom-validators/config.js'
import { isIntOrNull } from '@server/helpers/custom-validators/misc.js'
import { isPlayerThemeValid } from '@server/helpers/custom-validators/player-settings.js'
import { isNumberArray, isStringArray } from '@server/helpers/custom-validators/search.js'
import { isVideoCommentsPolicyValid, isVideoLicenceValid, isVideoPrivacyValid } from '@server/helpers/custom-validators/videos.js'
import { guessLanguageFromReq } from '@server/helpers/i18n.js'
import { CONFIG, isEmailEnabled } from '@server/initializers/config.js'
import express from 'express'
import { body, param } from 'express-validator'
import { getBrowseVideosDefaultScopeError, getBrowseVideosDefaultSortError } from '../../helpers/custom-validators/browse-videos.js'
import { isThemeNameValid } from '../../helpers/custom-validators/plugins.js'
import { isUserNSFWPolicyValid, isUserVideoQuotaDailyValid, isUserVideoQuotaValid } from '../../helpers/custom-validators/users.js'
import { isThemeRegistered } from '../../lib/plugins/theme-utils.js'
import { areValidationErrors, updateActorImageValidatorFactory } from './shared/index.js'

export const customConfigUpdateValidator = [
  body('instance.name').exists(),
  body('instance.shortDescription').exists(),
  body('instance.description').exists(),
  body('instance.terms').exists(),

  body('instance.codeOfConduct').exists(),
  body('instance.creationReason').exists(),
  body('instance.moderationInformation').exists(),
  body('instance.administrator').exists(),
  body('instance.maintenanceLifetime').exists(),
  body('instance.businessModel').exists(),
  body('instance.hardwareInformation').exists(),
  body('instance.serverCountry').exists(),
  body('instance.support.text').exists(),
  body('instance.social.externalLink').exists(),
  body('instance.social.mastodonLink').exists(),
  body('instance.social.blueskyLink').exists(),
  body('instance.defaultLanguage').exists(),
  body('instance.social.xLink').exists(),

  body('instance.isNSFW').isBoolean(),
  body('instance.languages').custom(isStringArray),
  body('instance.categories').custom(isNumberArray),
  body('instance.defaultNSFWPolicy').custom(isUserNSFWPolicyValid),
  body('instance.defaultClientRoute').exists(),
  body('instance.customizations.css').exists(),
  body('instance.customizations.javascript').exists(),

  body('services.twitter.username').exists(),

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
  body('transcoding.originalFile.keep').isBoolean(),
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
  body('transcoding.fps.max').custom(isIntOrNull),

  body('transcoding.webVideos.enabled').isBoolean(),
  body('transcoding.hls.enabled').isBoolean(),

  body('videoStudio.enabled').isBoolean(),
  body('videoStudio.remoteRunners.enabled').isBoolean(),

  body('videoFile.update.enabled').isBoolean(),

  body('import.videos.concurrency').isInt({ min: 0 }),
  body('import.videos.http.enabled').isBoolean(),
  body('import.videos.torrent.enabled').isBoolean(),

  body('import.videoChannelSynchronization.enabled').isBoolean(),
  body('import.users.enabled').isBoolean(),

  body('export.users.enabled').isBoolean(),
  body('export.users.maxUserVideoQuota').exists(),
  body('export.users.exportExpiration').exists(),

  body('trending.videos.algorithms.default').exists(),
  body('trending.videos.algorithms.enabled').exists(),

  body('followers.instance.enabled').isBoolean(),
  body('followers.instance.manualApproval').isBoolean(),
  body('followers.channels.enabled').isBoolean(),

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
  body('live.transcoding.fps.max').custom(isIntOrNull),
  body('live.transcoding.remoteRunners.enabled').isBoolean(),

  body('search.remoteUri.users').isBoolean(),
  body('search.remoteUri.anonymous').isBoolean(),
  body('search.searchIndex.enabled').isBoolean(),
  body('search.searchIndex.url').exists(),
  body('search.searchIndex.disableLocalSearch').isBoolean(),
  body('search.searchIndex.isDefaultSearch').isBoolean(),

  body('defaults.publish.commentsPolicy').custom(isVideoCommentsPolicyValid),
  body('defaults.publish.privacy').custom(isVideoPrivacyValid),
  body('defaults.publish.licence').optional().custom(isVideoLicenceValid),
  body('defaults.p2p.webapp.enabled').isBoolean(),
  body('defaults.p2p.embed.enabled').isBoolean(),
  body('defaults.player.autoPlay').isBoolean(),
  body('defaults.player.theme').custom(isPlayerThemeValid),

  body('email.body.signature').exists(),
  body('email.subject.prefix').exists(),

  body('videoComments.acceptRemoteComments').isBoolean(),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!checkInvalidConfigIfEmailDisabled(req.body, req, res)) return
    if (!checkInvalidTranscodingConfig(req.body, req, res)) return
    if (!checkInvalidSynchronizationConfig(req.body, req, res)) return
    if (!checkInvalidLiveConfig(req.body, req, res)) return
    if (!checkInvalidVideoStudioConfig(req.body, req, res)) return
    if (!checkInvalidSearchConfig(req.body, req, res)) return
    if (!checkInvalidBrowseVideosConfig(req.body, req, res)) return

    return next()
  }
]

export function ensureConfigIsEditable (req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!CONFIG.WEBADMIN.CONFIGURATION.EDITION.ALLOWED) {
    return res.fail({
      status: HttpStatusCode.METHOD_NOT_ALLOWED_405,
      message: req.t('Server configuration is static and cannot be edited')
    })
  }

  return next()
}

export const updateOrDeleteLogoValidator = [
  param('logoType')
    .custom(isConfigLogoTypeValid),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

export const updateInstanceLogoValidator = updateActorImageValidatorFactory('logofile')

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function checkInvalidConfigIfEmailDisabled (customConfig: CustomConfig, req: express.Request, res: express.Response) {
  if (isEmailEnabled()) return true

  if (customConfig.signup.requiresEmailVerification === true) {
    res.fail({ message: req.t('SMTP is not configured but you require signup email verification.') })
    return false
  }

  return true
}

function checkInvalidTranscodingConfig (customConfig: CustomConfig, req: express.Request, res: express.Response) {
  if (customConfig.transcoding.enabled === false) return true

  if (customConfig.transcoding.webVideos.enabled === false && customConfig.transcoding.hls.enabled === false) {
    res.fail({ message: req.t('You need to enable at least web_videos transcoding or hls transcoding') })
    return false
  }

  return true
}

function checkInvalidSynchronizationConfig (customConfig: CustomConfig, req: express.Request, res: express.Response) {
  if (customConfig.import.videoChannelSynchronization.enabled && !customConfig.import.videos.http.enabled) {
    res.fail({ message: req.t('You need to enable HTTP video import in order to enable channel synchronization') })
    return false
  }
  return true
}

function checkInvalidLiveConfig (customConfig: CustomConfig, req: express.Request, res: express.Response) {
  if (customConfig.live.enabled === false) return true

  if (customConfig.live.allowReplay === true && customConfig.transcoding.enabled === false) {
    res.fail({ message: req.t('You cannot allow live replay if transcoding is not enabled') })
    return false
  }

  return true
}

function checkInvalidVideoStudioConfig (customConfig: CustomConfig, req: express.Request, res: express.Response) {
  if (customConfig.videoStudio.enabled === false) return true

  if (customConfig.videoStudio.enabled === true && customConfig.transcoding.enabled === false) {
    res.fail({ message: req.t('You cannot enable video studio if transcoding is not enabled') })
    return false
  }

  return true
}

function checkInvalidSearchConfig (customConfig: CustomConfig, req: express.Request, res: express.Response) {
  if (customConfig.search.searchIndex.enabled === false) return true

  if (customConfig.search.searchIndex.enabled === true && customConfig.search.remoteUri.users === false) {
    res.fail({ message: req.t('You cannot enable search index without enabling remote URI search for users.') })
    return false
  }

  return true
}

function checkInvalidBrowseVideosConfig (customConfig: CustomConfig, req: express.Request, res: express.Response) {
  const sortError = getBrowseVideosDefaultSortError(
    customConfig.client.browseVideos.defaultSort,
    customConfig.trending.videos.algorithms.enabled,
    guessLanguageFromReq(req, res)
  )
  if (sortError) {
    res.fail({ message: sortError })
    return false
  }

  const scopeError = getBrowseVideosDefaultScopeError(customConfig.client.browseVideos.defaultScope, guessLanguageFromReq(req, res))
  if (scopeError) {
    res.fail({ message: scopeError })
    return false
  }

  return true
}
