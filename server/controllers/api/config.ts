import * as express from 'express'
import { snakeCase } from 'lodash'
import { ServerConfig, UserRight } from '../../../shared'
import { About } from '../../../shared/models/server/about.model'
import { CustomConfig } from '../../../shared/models/server/custom-config.model'
import { isSignupAllowed, isSignupAllowedForCurrentIP } from '../../helpers/signup'
import { CONSTRAINTS_FIELDS } from '../../initializers/constants'
import { asyncMiddleware, authenticate, ensureUserHasRight } from '../../middlewares'
import { customConfigUpdateValidator } from '../../middlewares/validators/config'
import { ClientHtml } from '../../lib/client-html'
import { auditLoggerFactory, CustomConfigAuditView, getAuditIdFromRes } from '../../helpers/audit-logger'
import { remove, writeJSON } from 'fs-extra'
import { getServerCommit } from '../../helpers/utils'
import { Emailer } from '../../lib/emailer'
import { isNumeric } from 'validator'
import { objectConverter } from '../../helpers/core-utils'
import { CONFIG, reloadConfig } from '../../initializers/config'

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

let serverCommit: string
async function getConfig (req: express.Request, res: express.Response) {
  const allowed = await isSignupAllowed()
  const allowedForCurrentIP = isSignupAllowedForCurrentIP(req.ip)

  if (serverCommit === undefined) serverCommit = await getServerCommit()

  const enabledResolutions = Object.keys(CONFIG.TRANSCODING.RESOLUTIONS)
   .filter(key => CONFIG.TRANSCODING.ENABLED === CONFIG.TRANSCODING.RESOLUTIONS[key] === true)
   .map(r => parseInt(r, 10))

  const json: ServerConfig = {
    instance: {
      name: CONFIG.INSTANCE.NAME,
      shortDescription: CONFIG.INSTANCE.SHORT_DESCRIPTION,
      defaultClientRoute: CONFIG.INSTANCE.DEFAULT_CLIENT_ROUTE,
      isNSFW: CONFIG.INSTANCE.IS_NSFW,
      defaultNSFWPolicy: CONFIG.INSTANCE.DEFAULT_NSFW_POLICY,
      customizations: {
        javascript: CONFIG.INSTANCE.CUSTOMIZATIONS.JAVASCRIPT,
        css: CONFIG.INSTANCE.CUSTOMIZATIONS.CSS
      }
    },
    email: {
      enabled: Emailer.isEnabled()
    },
    contactForm: {
      enabled: CONFIG.CONTACT_FORM.ENABLED
    },
    serverVersion: packageJSON.version,
    serverCommit,
    signup: {
      allowed,
      allowedForCurrentIP,
      requiresEmailVerification: CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION
    },
    transcoding: {
      hls: {
        enabled: CONFIG.TRANSCODING.HLS.ENABLED
      },
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
    autoBlacklist: {
      videos: {
        ofUsers: {
          enabled: CONFIG.AUTO_BLACKLIST.VIDEOS.OF_USERS.ENABLED
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
    },
    trending: {
      videos: {
        intervalDays: CONFIG.TRENDING.VIDEOS.INTERVAL_DAYS
      }
    },
    tracker: {
      enabled: CONFIG.TRACKER.ENABLED
    }
  }

  return res.json(json)
}

function getAbout (req: express.Request, res: express.Response) {
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

async function getCustomConfig (req: express.Request, res: express.Response) {
  const data = customConfig()

  return res.json(data).end()
}

async function deleteCustomConfig (req: express.Request, res: express.Response) {
  await remove(CONFIG.CUSTOM_FILE)

  auditLogger.delete(getAuditIdFromRes(res), new CustomConfigAuditView(customConfig()))

  reloadConfig()
  ClientHtml.invalidCache()

  const data = customConfig()

  return res.json(data).end()
}

async function updateCustomConfig (req: express.Request, res: express.Response) {
  const oldCustomConfigAuditKeys = new CustomConfigAuditView(customConfig())

  // camelCase to snake_case key + Force number conversion
  const toUpdateJSON = convertCustomConfigBody(req.body)

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
      isNSFW: CONFIG.INSTANCE.IS_NSFW,
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
    contactForm: {
      enabled: CONFIG.CONTACT_FORM.ENABLED
    },
    user: {
      videoQuota: CONFIG.USER.VIDEO_QUOTA,
      videoQuotaDaily: CONFIG.USER.VIDEO_QUOTA_DAILY
    },
    transcoding: {
      enabled: CONFIG.TRANSCODING.ENABLED,
      allowAdditionalExtensions: CONFIG.TRANSCODING.ALLOW_ADDITIONAL_EXTENSIONS,
      threads: CONFIG.TRANSCODING.THREADS,
      resolutions: {
        '240p': CONFIG.TRANSCODING.RESOLUTIONS[ '240p' ],
        '360p': CONFIG.TRANSCODING.RESOLUTIONS[ '360p' ],
        '480p': CONFIG.TRANSCODING.RESOLUTIONS[ '480p' ],
        '720p': CONFIG.TRANSCODING.RESOLUTIONS[ '720p' ],
        '1080p': CONFIG.TRANSCODING.RESOLUTIONS[ '1080p' ]
      },
      hls: {
        enabled: CONFIG.TRANSCODING.HLS.ENABLED
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
    },
    autoBlacklist: {
      videos: {
        ofUsers: {
          enabled: CONFIG.AUTO_BLACKLIST.VIDEOS.OF_USERS.ENABLED
        }
      }
    },
    followers: {
      instance: {
        enabled: CONFIG.FOLLOWERS.INSTANCE.ENABLED,
        manualApproval: CONFIG.FOLLOWERS.INSTANCE.MANUAL_APPROVAL
      }
    }
  }
}

function convertCustomConfigBody (body: CustomConfig) {
  function keyConverter (k: string) {
    // Transcoding resolutions exception
    if (/^\d{3,4}p$/.exec(k)) return k

    return snakeCase(k)
  }

  function valueConverter (v: any) {
    if (isNumeric(v + '')) return parseInt('' + v, 10)

    return v
  }

  return objectConverter(body, keyConverter, valueConverter)
}
