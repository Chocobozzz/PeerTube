import * as express from 'express'
import { snakeCase } from 'lodash'
import { ServerConfig, UserRight } from '../../../shared'
import { About } from '../../../shared/models/server/about.model'
import { CustomConfig } from '../../../shared/models/server/custom-config.model'
import { isSignupAllowed, isSignupAllowedForCurrentIP } from '../../helpers/signup'
import { CONSTRAINTS_FIELDS, DEFAULT_THEME_NAME, PEERTUBE_VERSION } from '../../initializers/constants'
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
import { PluginManager } from '../../lib/plugins/plugin-manager'
import { getThemeOrDefault } from '../../lib/plugins/theme-utils'
import { Hooks } from '@server/lib/plugins/hooks'

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
  const { allowed } = await Hooks.wrapPromiseFun(
    isSignupAllowed,
    {},
    'filter:api.user.signup.allowed.result'
  )

  const allowedForCurrentIP = isSignupAllowedForCurrentIP(req.ip)
  const defaultTheme = getThemeOrDefault(CONFIG.THEME.DEFAULT, DEFAULT_THEME_NAME)

  if (serverCommit === undefined) serverCommit = await getServerCommit()

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
    plugin: {
      registered: getRegisteredPlugins()
    },
    theme: {
      registered: getRegisteredThemes(),
      default: defaultTheme
    },
    email: {
      enabled: Emailer.isEnabled()
    },
    contactForm: {
      enabled: CONFIG.CONTACT_FORM.ENABLED
    },
    serverVersion: PEERTUBE_VERSION,
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
      webtorrent: {
        enabled: CONFIG.TRANSCODING.WEBTORRENT.ENABLED
      },
      enabledResolutions: getEnabledResolutions()
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
      terms: CONFIG.INSTANCE.TERMS,
      codeOfConduct: CONFIG.INSTANCE.CODE_OF_CONDUCT,

      hardwareInformation: CONFIG.INSTANCE.HARDWARE_INFORMATION,

      creationReason: CONFIG.INSTANCE.CREATION_REASON,
      moderationInformation: CONFIG.INSTANCE.MODERATION_INFORMATION,
      administrator: CONFIG.INSTANCE.ADMINISTRATOR,
      maintenanceLifetime: CONFIG.INSTANCE.MAINTENANCE_LIFETIME,
      businessModel: CONFIG.INSTANCE.BUSINESS_MODEL,

      languages: CONFIG.INSTANCE.LANGUAGES,
      categories: CONFIG.INSTANCE.CATEGORIES
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
      codeOfConduct: CONFIG.INSTANCE.CODE_OF_CONDUCT,

      creationReason: CONFIG.INSTANCE.CREATION_REASON,
      moderationInformation: CONFIG.INSTANCE.MODERATION_INFORMATION,
      administrator: CONFIG.INSTANCE.ADMINISTRATOR,
      maintenanceLifetime: CONFIG.INSTANCE.MAINTENANCE_LIFETIME,
      businessModel: CONFIG.INSTANCE.BUSINESS_MODEL,
      hardwareInformation: CONFIG.INSTANCE.HARDWARE_INFORMATION,

      languages: CONFIG.INSTANCE.LANGUAGES,
      categories: CONFIG.INSTANCE.CATEGORIES,

      isNSFW: CONFIG.INSTANCE.IS_NSFW,
      defaultClientRoute: CONFIG.INSTANCE.DEFAULT_CLIENT_ROUTE,
      defaultNSFWPolicy: CONFIG.INSTANCE.DEFAULT_NSFW_POLICY,
      customizations: {
        css: CONFIG.INSTANCE.CUSTOMIZATIONS.CSS,
        javascript: CONFIG.INSTANCE.CUSTOMIZATIONS.JAVASCRIPT
      }
    },
    theme: {
      default: CONFIG.THEME.DEFAULT
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
      allowAudioFiles: CONFIG.TRANSCODING.ALLOW_AUDIO_FILES,
      threads: CONFIG.TRANSCODING.THREADS,
      resolutions: {
        '0p': CONFIG.TRANSCODING.RESOLUTIONS[ '0p' ],
        '240p': CONFIG.TRANSCODING.RESOLUTIONS[ '240p' ],
        '360p': CONFIG.TRANSCODING.RESOLUTIONS[ '360p' ],
        '480p': CONFIG.TRANSCODING.RESOLUTIONS[ '480p' ],
        '720p': CONFIG.TRANSCODING.RESOLUTIONS[ '720p' ],
        '1080p': CONFIG.TRANSCODING.RESOLUTIONS[ '1080p' ],
        '2160p': CONFIG.TRANSCODING.RESOLUTIONS[ '2160p' ]
      },
      webtorrent: {
        enabled: CONFIG.TRANSCODING.WEBTORRENT.ENABLED
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
    },
    followings: {
      instance: {
        autoFollowBack: {
          enabled: CONFIG.FOLLOWINGS.INSTANCE.AUTO_FOLLOW_BACK.ENABLED
        },

        autoFollowIndex: {
          enabled: CONFIG.FOLLOWINGS.INSTANCE.AUTO_FOLLOW_INDEX.ENABLED,
          indexUrl: CONFIG.FOLLOWINGS.INSTANCE.AUTO_FOLLOW_INDEX.INDEX_URL
        }
      }
    }
  }
}

function convertCustomConfigBody (body: CustomConfig) {
  function keyConverter (k: string) {
    // Transcoding resolutions exception
    if (/^\d{3,4}p$/.exec(k)) return k
    if (k === '0p') return k

    return snakeCase(k)
  }

  function valueConverter (v: any) {
    if (isNumeric(v + '')) return parseInt('' + v, 10)

    return v
  }

  return objectConverter(body, keyConverter, valueConverter)
}

function getRegisteredThemes () {
  return PluginManager.Instance.getRegisteredThemes()
                      .map(t => ({
                        name: t.name,
                        version: t.version,
                        description: t.description,
                        css: t.css,
                        clientScripts: t.clientScripts
                      }))
}

function getEnabledResolutions () {
  return Object.keys(CONFIG.TRANSCODING.RESOLUTIONS)
               .filter(key => CONFIG.TRANSCODING.ENABLED && CONFIG.TRANSCODING.RESOLUTIONS[ key ] === true)
               .map(r => parseInt(r, 10))
}

function getRegisteredPlugins () {
  return PluginManager.Instance.getRegisteredPlugins()
                      .map(p => ({
                        name: p.name,
                        version: p.version,
                        description: p.description,
                        clientScripts: p.clientScripts
                      }))
}
