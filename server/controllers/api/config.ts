import * as express from 'express'
import { omit } from 'lodash'
import { ServerConfig, UserRight } from '../../../shared'
import { About } from '../../../shared/models/server/about.model'
import { CustomConfig } from '../../../shared/models/server/custom-config.model'
import { isSignupAllowed, isSignupAllowedForCurrentIP } from '../../helpers/signup'
import { CONFIG, CONSTRAINTS_FIELDS, reloadConfig } from '../../initializers'
import { asyncMiddleware, authenticate, ensureUserHasRight } from '../../middlewares'
import { customConfigUpdateValidator } from '../../middlewares/validators/config'
import { ClientHtml } from '../../lib/client-html'
import { auditLoggerFactory, CustomConfigAuditView, getAuditIdFromRes } from '../../helpers/audit-logger'
import { remove, writeJSON } from 'fs-extra'

const packageJSON = require('../../../../package.json')
const configRouter = express.Router()

const auditLogger = auditLoggerFactory('config')

configRouter.get('/about', getAbout)
configRouter.get('/',
  asyncMiddleware(getConfig)
)

configRouter.get('/custom',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_CONFIGURATION),
  asyncMiddleware(getCustomConfig)
)
configRouter.put('/custom',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_CONFIGURATION),
  asyncMiddleware(customConfigUpdateValidator),
  asyncMiddleware(updateCustomConfig)
)
configRouter.delete('/custom',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_CONFIGURATION),
  asyncMiddleware(deleteCustomConfig)
)

async function getConfig (req: express.Request, res: express.Response, next: express.NextFunction) {
  const allowed = await isSignupAllowed()
  const allowedForCurrentIP = isSignupAllowedForCurrentIP(req.ip)

  const enabledResolutions = Object.keys(CONFIG.TRANSCODING.RESOLUTIONS)
   .filter(key => CONFIG.TRANSCODING.ENABLED === CONFIG.TRANSCODING.RESOLUTIONS[key] === true)
   .map(r => parseInt(r, 10))

  const json: ServerConfig = {
    instance: {
      name: CONFIG.INSTANCE.NAME,
      shortDescription: CONFIG.INSTANCE.SHORT_DESCRIPTION,
      defaultClientRoute: CONFIG.INSTANCE.DEFAULT_CLIENT_ROUTE,
      defaultNSFWPolicy: CONFIG.INSTANCE.DEFAULT_NSFW_POLICY,
      customizations: {
        javascript: CONFIG.INSTANCE.CUSTOMIZATIONS.JAVASCRIPT,
        css: CONFIG.INSTANCE.CUSTOMIZATIONS.CSS
      }
    },
    serverVersion: packageJSON.version,
    signup: {
      allowed,
      allowedForCurrentIP,
      requiresEmailVerification: CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION
    },
    transcoding: {
      enabledResolutions
    },
    import: {
      videos: {
        http: {
          enabled: CONFIG.IMPORT.VIDEOS.HTTP.ENABLED
        },
        torrent: {
          enabled: CONFIG.IMPORT.VIDEOS.TORRENT.ENABLED
        }
      }
    },
    avatar: {
      file: {
        size: {
          max: CONSTRAINTS_FIELDS.ACTORS.AVATAR.FILE_SIZE.max
        },
        extensions: CONSTRAINTS_FIELDS.ACTORS.AVATAR.EXTNAME
      }
    },
    video: {
      image: {
        extensions: CONSTRAINTS_FIELDS.VIDEOS.IMAGE.EXTNAME,
        size: {
          max: CONSTRAINTS_FIELDS.VIDEOS.IMAGE.FILE_SIZE.max
        }
      },
      file: {
        extensions: CONSTRAINTS_FIELDS.VIDEOS.EXTNAME
      }
    },
    videoCaption: {
      file: {
        size: {
          max: CONSTRAINTS_FIELDS.VIDEO_CAPTIONS.CAPTION_FILE.FILE_SIZE.max
        },
        extensions: CONSTRAINTS_FIELDS.VIDEO_CAPTIONS.CAPTION_FILE.EXTNAME
      }
    },
    user: {
      videoQuota: CONFIG.USER.VIDEO_QUOTA,
      videoQuotaDaily: CONFIG.USER.VIDEO_QUOTA_DAILY
    }
  }

  return res.json(json)
}

function getAbout (req: express.Request, res: express.Response, next: express.NextFunction) {
  const about: About = {
    instance: {
      name: CONFIG.INSTANCE.NAME,
      shortDescription: CONFIG.INSTANCE.SHORT_DESCRIPTION,
      description: CONFIG.INSTANCE.DESCRIPTION,
      terms: CONFIG.INSTANCE.TERMS
    }
  }

  return res.json(about).end()
}

async function getCustomConfig (req: express.Request, res: express.Response, next: express.NextFunction) {
  const data = customConfig()

  return res.json(data).end()
}

async function deleteCustomConfig (req: express.Request, res: express.Response, next: express.NextFunction) {
  await remove(CONFIG.CUSTOM_FILE)

  auditLogger.delete(getAuditIdFromRes(res), new CustomConfigAuditView(customConfig()))

  reloadConfig()
  ClientHtml.invalidCache()

  const data = customConfig()

  return res.json(data).end()
}

async function updateCustomConfig (req: express.Request, res: express.Response, next: express.NextFunction) {
  const toUpdate: CustomConfig = req.body
  const oldCustomConfigAuditKeys = new CustomConfigAuditView(customConfig())

  // Force number conversion
  toUpdate.cache.previews.size = parseInt('' + toUpdate.cache.previews.size, 10)
  toUpdate.cache.captions.size = parseInt('' + toUpdate.cache.captions.size, 10)
  toUpdate.signup.limit = parseInt('' + toUpdate.signup.limit, 10)
  toUpdate.user.videoQuota = parseInt('' + toUpdate.user.videoQuota, 10)
  toUpdate.user.videoQuotaDaily = parseInt('' + toUpdate.user.videoQuotaDaily, 10)
  toUpdate.transcoding.threads = parseInt('' + toUpdate.transcoding.threads, 10)

  // camelCase to snake_case key
  const toUpdateJSON = omit(
    toUpdate,
    'user.videoQuota',
    'instance.defaultClientRoute',
    'instance.shortDescription',
    'cache.videoCaptions',
    'signup.requiresEmailVerification'
  )
  toUpdateJSON.user['video_quota'] = toUpdate.user.videoQuota
  toUpdateJSON.user['video_quota_daily'] = toUpdate.user.videoQuotaDaily
  toUpdateJSON.instance['default_client_route'] = toUpdate.instance.defaultClientRoute
  toUpdateJSON.instance['short_description'] = toUpdate.instance.shortDescription
  toUpdateJSON.instance['default_nsfw_policy'] = toUpdate.instance.defaultNSFWPolicy
  toUpdateJSON.signup['requires_email_verification'] = toUpdate.signup.requiresEmailVerification

  await writeJSON(CONFIG.CUSTOM_FILE, toUpdateJSON, { spaces: 2 })

  reloadConfig()
  ClientHtml.invalidCache()

  const data = customConfig()

  auditLogger.update(
    getAuditIdFromRes(res),
    new CustomConfigAuditView(data),
    oldCustomConfigAuditKeys
  )

  return res.json(data).end()
}

// ---------------------------------------------------------------------------

export {
  configRouter
}

// ---------------------------------------------------------------------------

function customConfig (): CustomConfig {
  return {
    instance: {
      name: CONFIG.INSTANCE.NAME,
      shortDescription: CONFIG.INSTANCE.SHORT_DESCRIPTION,
      description: CONFIG.INSTANCE.DESCRIPTION,
      terms: CONFIG.INSTANCE.TERMS,
      defaultClientRoute: CONFIG.INSTANCE.DEFAULT_CLIENT_ROUTE,
      defaultNSFWPolicy: CONFIG.INSTANCE.DEFAULT_NSFW_POLICY,
      customizations: {
        css: CONFIG.INSTANCE.CUSTOMIZATIONS.CSS,
        javascript: CONFIG.INSTANCE.CUSTOMIZATIONS.JAVASCRIPT
      }
    },
    services: {
      twitter: {
        username: CONFIG.SERVICES.TWITTER.USERNAME,
        whitelisted: CONFIG.SERVICES.TWITTER.WHITELISTED
      }
    },
    cache: {
      previews: {
        size: CONFIG.CACHE.PREVIEWS.SIZE
      },
      captions: {
        size: CONFIG.CACHE.VIDEO_CAPTIONS.SIZE
      }
    },
    signup: {
      enabled: CONFIG.SIGNUP.ENABLED,
      limit: CONFIG.SIGNUP.LIMIT,
      requiresEmailVerification: CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION
    },
    admin: {
      email: CONFIG.ADMIN.EMAIL
    },
    user: {
      videoQuota: CONFIG.USER.VIDEO_QUOTA,
      videoQuotaDaily: CONFIG.USER.VIDEO_QUOTA_DAILY
    },
    transcoding: {
      enabled: CONFIG.TRANSCODING.ENABLED,
      threads: CONFIG.TRANSCODING.THREADS,
      resolutions: {
        '240p': CONFIG.TRANSCODING.RESOLUTIONS[ '240p' ],
        '360p': CONFIG.TRANSCODING.RESOLUTIONS[ '360p' ],
        '480p': CONFIG.TRANSCODING.RESOLUTIONS[ '480p' ],
        '720p': CONFIG.TRANSCODING.RESOLUTIONS[ '720p' ],
        '1080p': CONFIG.TRANSCODING.RESOLUTIONS[ '1080p' ]
      }
    },
    import: {
      videos: {
        http: {
          enabled: CONFIG.IMPORT.VIDEOS.HTTP.ENABLED
        },
        torrent: {
          enabled: CONFIG.IMPORT.VIDEOS.TORRENT.ENABLED
        }
      }
    }
  }
}
