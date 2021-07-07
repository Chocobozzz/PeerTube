import { ServerConfigManager } from '@server/lib/server-config-manager'
import * as express from 'express'
import { remove, writeJSON } from 'fs-extra'
import { snakeCase } from 'lodash'
import validator from 'validator'
import { UserRight } from '../../../shared'
import { About } from '../../../shared/models/server/about.model'
import { CustomConfig } from '../../../shared/models/server/custom-config.model'
import { auditLoggerFactory, CustomConfigAuditView, getAuditIdFromRes } from '../../helpers/audit-logger'
import { objectConverter } from '../../helpers/core-utils'
import { CONFIG, reloadConfig } from '../../initializers/config'
import { ClientHtml } from '../../lib/client-html'
import { asyncMiddleware, authenticate, ensureUserHasRight, openapiOperationDoc } from '../../middlewares'
import { customConfigUpdateValidator } from '../../middlewares/validators/config'

const configRouter = express.Router()

const auditLogger = auditLoggerFactory('config')

configRouter.get('/',
  openapiOperationDoc({ operationId: 'getConfig' }),
  asyncMiddleware(getConfig)
)

configRouter.get('/about',
  openapiOperationDoc({ operationId: 'getAbout' }),
  getAbout
)

configRouter.get('/custom',
  openapiOperationDoc({ operationId: 'getCustomConfig' }),
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_CONFIGURATION),
  getCustomConfig
)

configRouter.put('/custom',
  openapiOperationDoc({ operationId: 'putCustomConfig' }),
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_CONFIGURATION),
  customConfigUpdateValidator,
  asyncMiddleware(updateCustomConfig)
)

configRouter.delete('/custom',
  openapiOperationDoc({ operationId: 'delCustomConfig' }),
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_CONFIGURATION),
  asyncMiddleware(deleteCustomConfig)
)

async function getConfig (req: express.Request, res: express.Response) {
  const json = await ServerConfigManager.Instance.getServerConfig(req.ip)

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

  return res.json(about)
}

function getCustomConfig (req: express.Request, res: express.Response) {
  const data = customConfig()

  return res.json(data)
}

async function deleteCustomConfig (req: express.Request, res: express.Response) {
  await remove(CONFIG.CUSTOM_FILE)

  auditLogger.delete(getAuditIdFromRes(res), new CustomConfigAuditView(customConfig()))

  reloadConfig()
  ClientHtml.invalidCache()

  const data = customConfig()

  return res.json(data)
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

  return res.json(data)
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
      defaultNSFWPolicy: CONFIG.INSTANCE.DEFAULT_NSFW_POLICY,

      defaultClientRoute: CONFIG.INSTANCE.DEFAULT_CLIENT_ROUTE,

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
      },
      torrents: {
        size: CONFIG.CACHE.TORRENTS.SIZE
      }
    },
    signup: {
      enabled: CONFIG.SIGNUP.ENABLED,
      limit: CONFIG.SIGNUP.LIMIT,
      requiresEmailVerification: CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION,
      minimumAge: CONFIG.SIGNUP.MINIMUM_AGE
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
      concurrency: CONFIG.TRANSCODING.CONCURRENCY,
      profile: CONFIG.TRANSCODING.PROFILE,
      resolutions: {
        '0p': CONFIG.TRANSCODING.RESOLUTIONS['0p'],
        '240p': CONFIG.TRANSCODING.RESOLUTIONS['240p'],
        '360p': CONFIG.TRANSCODING.RESOLUTIONS['360p'],
        '480p': CONFIG.TRANSCODING.RESOLUTIONS['480p'],
        '720p': CONFIG.TRANSCODING.RESOLUTIONS['720p'],
        '1080p': CONFIG.TRANSCODING.RESOLUTIONS['1080p'],
        '1440p': CONFIG.TRANSCODING.RESOLUTIONS['1440p'],
        '2160p': CONFIG.TRANSCODING.RESOLUTIONS['2160p']
      },
      webtorrent: {
        enabled: CONFIG.TRANSCODING.WEBTORRENT.ENABLED
      },
      hls: {
        enabled: CONFIG.TRANSCODING.HLS.ENABLED
      }
    },
    live: {
      enabled: CONFIG.LIVE.ENABLED,
      allowReplay: CONFIG.LIVE.ALLOW_REPLAY,
      maxDuration: CONFIG.LIVE.MAX_DURATION,
      maxInstanceLives: CONFIG.LIVE.MAX_INSTANCE_LIVES,
      maxUserLives: CONFIG.LIVE.MAX_USER_LIVES,
      transcoding: {
        enabled: CONFIG.LIVE.TRANSCODING.ENABLED,
        threads: CONFIG.LIVE.TRANSCODING.THREADS,
        profile: CONFIG.LIVE.TRANSCODING.PROFILE,
        resolutions: {
          '240p': CONFIG.LIVE.TRANSCODING.RESOLUTIONS['240p'],
          '360p': CONFIG.LIVE.TRANSCODING.RESOLUTIONS['360p'],
          '480p': CONFIG.LIVE.TRANSCODING.RESOLUTIONS['480p'],
          '720p': CONFIG.LIVE.TRANSCODING.RESOLUTIONS['720p'],
          '1080p': CONFIG.LIVE.TRANSCODING.RESOLUTIONS['1080p'],
          '1440p': CONFIG.LIVE.TRANSCODING.RESOLUTIONS['1440p'],
          '2160p': CONFIG.LIVE.TRANSCODING.RESOLUTIONS['2160p']
        }
      }
    },
    import: {
      videos: {
        concurrency: CONFIG.IMPORT.VIDEOS.CONCURRENCY,
        http: {
          enabled: CONFIG.IMPORT.VIDEOS.HTTP.ENABLED
        },
        torrent: {
          enabled: CONFIG.IMPORT.VIDEOS.TORRENT.ENABLED
        }
      }
    },
    trending: {
      videos: {
        algorithms: {
          enabled: CONFIG.TRENDING.VIDEOS.ALGORITHMS.ENABLED,
          default: CONFIG.TRENDING.VIDEOS.ALGORITHMS.DEFAULT
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
    },
    broadcastMessage: {
      enabled: CONFIG.BROADCAST_MESSAGE.ENABLED,
      message: CONFIG.BROADCAST_MESSAGE.MESSAGE,
      level: CONFIG.BROADCAST_MESSAGE.LEVEL,
      dismissable: CONFIG.BROADCAST_MESSAGE.DISMISSABLE
    },
    search: {
      remoteUri: {
        users: CONFIG.SEARCH.REMOTE_URI.USERS,
        anonymous: CONFIG.SEARCH.REMOTE_URI.ANONYMOUS
      },
      searchIndex: {
        enabled: CONFIG.SEARCH.SEARCH_INDEX.ENABLED,
        url: CONFIG.SEARCH.SEARCH_INDEX.URL,
        disableLocalSearch: CONFIG.SEARCH.SEARCH_INDEX.DISABLE_LOCAL_SEARCH,
        isDefaultSearch: CONFIG.SEARCH.SEARCH_INDEX.IS_DEFAULT_SEARCH
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
    if (validator.isNumeric(v + '')) return parseInt('' + v, 10)

    return v
  }

  return objectConverter(body, keyConverter, valueConverter)
}
