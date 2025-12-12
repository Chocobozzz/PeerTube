import { About, ActorImageType, ActorImageType_Type, CustomConfig, HttpStatusCode, LogoType, UserRight } from '@peertube/peertube-models'
import { createReqFiles } from '@server/helpers/express-utils.js'
import { MIMETYPES } from '@server/initializers/constants.js'
import { deleteLocalActorImageFile, updateLocalActorImageFiles } from '@server/lib/local-actor.js'
import { ServerConfigManager } from '@server/lib/server-config-manager.js'
import { deleteUploadImages, logoTypeToUploadImageEnum, replaceUploadImage } from '@server/lib/upload-image.js'
import { ActorImageModel } from '@server/models/actor/actor-image.js'
import { getServerActor } from '@server/models/application/application.js'
import { ModelCache } from '@server/models/shared/model-cache.js'
import express from 'express'
import { remove, writeJSON } from 'fs-extra/esm'
import snakeCase from 'lodash-es/snakeCase.js'
import validator from 'validator'
import { CustomConfigAuditView, auditLoggerFactory, getAuditIdFromRes } from '../../helpers/audit-logger.js'
import { objectConverter } from '../../helpers/core-utils.js'
import { CONFIG, reloadConfig } from '../../initializers/config.js'
import { ClientHtml } from '../../lib/html/client-html.js'
import {
  apiRateLimiter,
  asyncMiddleware,
  authenticate,
  ensureUserHasRight,
  openapiOperationDoc,
  updateAvatarValidator,
  updateBannerValidator
} from '../../middlewares/index.js'
import {
  customConfigUpdateValidator,
  ensureConfigIsEditable,
  updateInstanceLogoValidator,
  updateOrDeleteLogoValidator
} from '../../middlewares/validators/config.js'

const configRouter = express.Router()

configRouter.use(apiRateLimiter)

const auditLogger = auditLoggerFactory('config')

configRouter.get('/', openapiOperationDoc({ operationId: 'getConfig' }), asyncMiddleware(getConfig))

configRouter.get('/about', openapiOperationDoc({ operationId: 'getAbout' }), asyncMiddleware(getAbout))

configRouter.get(
  '/custom',
  openapiOperationDoc({ operationId: 'getCustomConfig' }),
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_CONFIGURATION),
  getCustomConfig
)

configRouter.put(
  '/custom',
  openapiOperationDoc({ operationId: 'putCustomConfig' }),
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_CONFIGURATION),
  ensureConfigIsEditable,
  customConfigUpdateValidator,
  asyncMiddleware(updateCustomConfig)
)

configRouter.delete(
  '/custom',
  openapiOperationDoc({ operationId: 'delCustomConfig' }),
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_CONFIGURATION),
  ensureConfigIsEditable,
  asyncMiddleware(deleteCustomConfig)
)

// ---------------------------------------------------------------------------

configRouter.post(
  '/instance-banner/pick',
  authenticate,
  createReqFiles([ 'bannerfile' ], MIMETYPES.IMAGE.MIMETYPE_EXT),
  ensureUserHasRight(UserRight.MANAGE_CONFIGURATION),
  updateBannerValidator,
  asyncMiddleware(updateInstanceImageFactory(ActorImageType.BANNER))
)

configRouter.delete(
  '/instance-banner',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_CONFIGURATION),
  asyncMiddleware(deleteInstanceImageFactory(ActorImageType.BANNER))
)

// ---------------------------------------------------------------------------

configRouter.post(
  '/instance-avatar/pick',
  authenticate,
  createReqFiles([ 'avatarfile' ], MIMETYPES.IMAGE.MIMETYPE_EXT),
  ensureUserHasRight(UserRight.MANAGE_CONFIGURATION),
  updateAvatarValidator,
  asyncMiddleware(updateInstanceImageFactory(ActorImageType.AVATAR))
)

configRouter.delete(
  '/instance-avatar',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_CONFIGURATION),
  asyncMiddleware(deleteInstanceImageFactory(ActorImageType.AVATAR))
)

// ---------------------------------------------------------------------------

configRouter.post(
  '/instance-logo/:logoType/pick',
  authenticate,
  createReqFiles([ 'logofile' ], MIMETYPES.IMAGE.MIMETYPE_EXT),
  ensureUserHasRight(UserRight.MANAGE_CONFIGURATION),
  updateOrDeleteLogoValidator,
  updateInstanceLogoValidator,
  asyncMiddleware(updateInstanceLogo)
)

configRouter.delete(
  '/instance-logo/:logoType',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_CONFIGURATION),
  updateOrDeleteLogoValidator,
  asyncMiddleware(deleteInstanceLogo)
)

// ---------------------------------------------------------------------------

async function getConfig (req: express.Request, res: express.Response) {
  const json = await ServerConfigManager.Instance.getServerConfig(req.ip)

  return res.json(json)
}

async function getAbout (req: express.Request, res: express.Response) {
  const serverActor = await getServerActor()

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
      categories: CONFIG.INSTANCE.CATEGORIES,

      banners: serverActor.Banners.map(b => b.toFormattedJSON()),
      avatars: serverActor.Avatars.map(a => a.toFormattedJSON())
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

  await reloadConfig()
  ClientHtml.invalidateCache()

  const data = customConfig()

  return res.json(data)
}

async function updateCustomConfig (req: express.Request, res: express.Response) {
  const oldCustomConfigAuditKeys = new CustomConfigAuditView(customConfig())

  // camelCase to snake_case key + Force number conversion
  const toUpdateJSON = convertCustomConfigBody(req.body)

  await writeJSON(CONFIG.CUSTOM_FILE, toUpdateJSON, { spaces: 2 })

  await reloadConfig()
  ClientHtml.invalidateCache()

  const data = customConfig()

  auditLogger.update(
    getAuditIdFromRes(res),
    new CustomConfigAuditView(data),
    oldCustomConfigAuditKeys
  )

  return res.json(data)
}

// ---------------------------------------------------------------------------

function updateInstanceImageFactory (imageType: ActorImageType_Type) {
  return async (req: express.Request, res: express.Response) => {
    const field = imageType === ActorImageType.BANNER
      ? 'bannerfile'
      : 'avatarfile'

    const imagePhysicalFile = req.files[field][0]

    const serverActor = await getServerActor()

    await updateLocalActorImageFiles({
      accountOrChannel: serverActor.Account,
      imagePhysicalFile,
      type: imageType,
      sendActorUpdate: false
    })

    await updateServerActorImages(imageType)

    ClientHtml.invalidateCache()
    ModelCache.Instance.clearCache('server-account')

    return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
  }
}

function deleteInstanceImageFactory (imageType: ActorImageType_Type) {
  return async (req: express.Request, res: express.Response) => {
    const serverActor = await getServerActor()

    await deleteLocalActorImageFile(serverActor.Account, imageType)

    await updateServerActorImages(imageType)

    ClientHtml.invalidateCache()
    ModelCache.Instance.clearCache('server-account')

    return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
  }
}

async function updateServerActorImages (imageType: ActorImageType_Type) {
  const serverActor = await getServerActor()
  const updatedImages = await ActorImageModel.listByActor(serverActor, imageType) // Reload images from DB

  if (imageType === ActorImageType.BANNER) serverActor.Banners = updatedImages
  else serverActor.Avatars = updatedImages

  return serverActor
}

// ---------------------------------------------------------------------------

async function updateInstanceLogo (req: express.Request, res: express.Response) {
  const imagePhysicalFile = req.files['logofile'][0]

  await replaceUploadImage({
    actor: await getServerActor(),
    imagePhysicalFile,
    type: logoTypeToUploadImageEnum(req.params.logoType as LogoType)
  })

  ClientHtml.invalidateCache()
  ModelCache.Instance.clearCache('server-account')

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function deleteInstanceLogo (req: express.Request, res: express.Response) {
  await deleteUploadImages({
    actor: await getServerActor(),
    type: logoTypeToUploadImageEnum(req.params.logoType as LogoType)
  })

  ClientHtml.invalidateCache()
  ModelCache.Instance.clearCache('server-account')

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
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

      defaultLanguage: CONFIG.INSTANCE.DEFAULT_LANGUAGE,

      languages: CONFIG.INSTANCE.LANGUAGES,
      categories: CONFIG.INSTANCE.CATEGORIES,

      isNSFW: CONFIG.INSTANCE.IS_NSFW,
      defaultNSFWPolicy: CONFIG.INSTANCE.DEFAULT_NSFW_POLICY,

      serverCountry: CONFIG.INSTANCE.SERVER_COUNTRY,

      support: {
        text: CONFIG.INSTANCE.SUPPORT.TEXT
      },

      social: {
        blueskyLink: CONFIG.INSTANCE.SOCIAL.BLUESKY,
        mastodonLink: CONFIG.INSTANCE.SOCIAL.MASTODON_LINK,
        xLink: CONFIG.INSTANCE.SOCIAL.X_LINK,
        externalLink: CONFIG.INSTANCE.SOCIAL.EXTERNAL_LINK
      },

      defaultClientRoute: CONFIG.INSTANCE.DEFAULT_CLIENT_ROUTE,

      customizations: {
        css: CONFIG.INSTANCE.CUSTOMIZATIONS.CSS,
        javascript: CONFIG.INSTANCE.CUSTOMIZATIONS.JAVASCRIPT
      }
    },
    theme: {
      default: CONFIG.THEME.DEFAULT,

      customization: {
        primaryColor: CONFIG.THEME.CUSTOMIZATION.PRIMARY_COLOR,
        foregroundColor: CONFIG.THEME.CUSTOMIZATION.FOREGROUND_COLOR,
        backgroundColor: CONFIG.THEME.CUSTOMIZATION.BACKGROUND_COLOR,
        backgroundSecondaryColor: CONFIG.THEME.CUSTOMIZATION.BACKGROUND_SECONDARY_COLOR,
        menuForegroundColor: CONFIG.THEME.CUSTOMIZATION.MENU_FOREGROUND_COLOR,
        menuBackgroundColor: CONFIG.THEME.CUSTOMIZATION.MENU_BACKGROUND_COLOR,
        menuBorderRadius: CONFIG.THEME.CUSTOMIZATION.MENU_BORDER_RADIUS,
        headerForegroundColor: CONFIG.THEME.CUSTOMIZATION.HEADER_FOREGROUND_COLOR,
        headerBackgroundColor: CONFIG.THEME.CUSTOMIZATION.HEADER_BACKGROUND_COLOR,
        inputBorderRadius: CONFIG.THEME.CUSTOMIZATION.INPUT_BORDER_RADIUS
      }
    },
    services: {
      twitter: {
        username: CONFIG.SERVICES.TWITTER.USERNAME
      }
    },
    client: {
      header: {
        hideInstanceName: CONFIG.CLIENT.HEADER.HIDE_INSTANCE_NAME
      },
      videos: {
        miniature: {
          preferAuthorDisplayName: CONFIG.CLIENT.VIDEOS.MINIATURE.PREFER_AUTHOR_DISPLAY_NAME
        }
      },
      browseVideos: {
        defaultSort: CONFIG.CLIENT.BROWSE_VIDEOS.DEFAULT_SORT,
        defaultScope: CONFIG.CLIENT.BROWSE_VIDEOS.DEFAULT_SCOPE
      },
      menu: {
        login: {
          redirectOnSingleExternalAuth: CONFIG.CLIENT.MENU.LOGIN.REDIRECT_ON_SINGLE_EXTERNAL_AUTH
        }
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
      },
      storyboards: {
        size: CONFIG.CACHE.STORYBOARDS.SIZE
      }
    },
    signup: {
      enabled: CONFIG.SIGNUP.ENABLED,
      limit: CONFIG.SIGNUP.LIMIT,
      requiresApproval: CONFIG.SIGNUP.REQUIRES_APPROVAL,
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
      history: {
        videos: {
          enabled: CONFIG.USER.HISTORY.VIDEOS.ENABLED
        }
      },
      videoQuota: CONFIG.USER.VIDEO_QUOTA,
      videoQuotaDaily: CONFIG.USER.VIDEO_QUOTA_DAILY,
      defaultChannelName: CONFIG.USER.DEFAULT_CHANNEL_NAME
    },
    videoChannels: {
      maxPerUser: CONFIG.VIDEO_CHANNELS.MAX_PER_USER
    },
    transcoding: {
      enabled: CONFIG.TRANSCODING.ENABLED,
      originalFile: {
        keep: CONFIG.TRANSCODING.ORIGINAL_FILE.KEEP
      },
      audioLoudnorm: {
        enabled: CONFIG.TRANSCODING.AUDIO_LOUDNORM.ENABLED
      },
      remoteRunners: {
        enabled: CONFIG.TRANSCODING.REMOTE_RUNNERS.ENABLED
      },
      allowAdditionalExtensions: CONFIG.TRANSCODING.ALLOW_ADDITIONAL_EXTENSIONS,
      allowAudioFiles: CONFIG.TRANSCODING.ALLOW_AUDIO_FILES,
      threads: CONFIG.TRANSCODING.THREADS,
      concurrency: CONFIG.TRANSCODING.CONCURRENCY,
      profile: CONFIG.TRANSCODING.PROFILE,
      resolutions: {
        '0p': CONFIG.TRANSCODING.RESOLUTIONS['0p'],
        '144p': CONFIG.TRANSCODING.RESOLUTIONS['144p'],
        '240p': CONFIG.TRANSCODING.RESOLUTIONS['240p'],
        '360p': CONFIG.TRANSCODING.RESOLUTIONS['360p'],
        '480p': CONFIG.TRANSCODING.RESOLUTIONS['480p'],
        '720p': CONFIG.TRANSCODING.RESOLUTIONS['720p'],
        '1080p': CONFIG.TRANSCODING.RESOLUTIONS['1080p'],
        '1440p': CONFIG.TRANSCODING.RESOLUTIONS['1440p'],
        '2160p': CONFIG.TRANSCODING.RESOLUTIONS['2160p']
      },
      alwaysTranscodeOriginalResolution: CONFIG.TRANSCODING.ALWAYS_TRANSCODE_ORIGINAL_RESOLUTION,
      fps: {
        max: CONFIG.TRANSCODING.FPS.MAX
      },
      webVideos: {
        enabled: CONFIG.TRANSCODING.WEB_VIDEOS.ENABLED
      },
      hls: {
        enabled: CONFIG.TRANSCODING.HLS.ENABLED,
        splitAudioAndVideo: CONFIG.TRANSCODING.HLS.SPLIT_AUDIO_AND_VIDEO
      }
    },
    live: {
      enabled: CONFIG.LIVE.ENABLED,
      allowReplay: CONFIG.LIVE.ALLOW_REPLAY,
      latencySetting: {
        enabled: CONFIG.LIVE.LATENCY_SETTING.ENABLED
      },
      maxDuration: CONFIG.LIVE.MAX_DURATION,
      maxInstanceLives: CONFIG.LIVE.MAX_INSTANCE_LIVES,
      maxUserLives: CONFIG.LIVE.MAX_USER_LIVES,
      transcoding: {
        enabled: CONFIG.LIVE.TRANSCODING.ENABLED,
        remoteRunners: {
          enabled: CONFIG.LIVE.TRANSCODING.REMOTE_RUNNERS.ENABLED
        },
        audioLoudnorm: {
          enabled: CONFIG.LIVE.TRANSCODING.AUDIO_LOUDNORM.ENABLED
        },
        threads: CONFIG.LIVE.TRANSCODING.THREADS,
        profile: CONFIG.LIVE.TRANSCODING.PROFILE,
        resolutions: {
          '0p': CONFIG.LIVE.TRANSCODING.RESOLUTIONS['0p'],
          '144p': CONFIG.LIVE.TRANSCODING.RESOLUTIONS['144p'],
          '240p': CONFIG.LIVE.TRANSCODING.RESOLUTIONS['240p'],
          '360p': CONFIG.LIVE.TRANSCODING.RESOLUTIONS['360p'],
          '480p': CONFIG.LIVE.TRANSCODING.RESOLUTIONS['480p'],
          '720p': CONFIG.LIVE.TRANSCODING.RESOLUTIONS['720p'],
          '1080p': CONFIG.LIVE.TRANSCODING.RESOLUTIONS['1080p'],
          '1440p': CONFIG.LIVE.TRANSCODING.RESOLUTIONS['1440p'],
          '2160p': CONFIG.LIVE.TRANSCODING.RESOLUTIONS['2160p']
        },
        alwaysTranscodeOriginalResolution: CONFIG.LIVE.TRANSCODING.ALWAYS_TRANSCODE_ORIGINAL_RESOLUTION,
        fps: {
          max: CONFIG.LIVE.TRANSCODING.FPS.MAX
        }
      }
    },
    videoStudio: {
      enabled: CONFIG.VIDEO_STUDIO.ENABLED,
      remoteRunners: {
        enabled: CONFIG.VIDEO_STUDIO.REMOTE_RUNNERS.ENABLED
      }
    },
    videoTranscription: {
      enabled: CONFIG.VIDEO_TRANSCRIPTION.ENABLED,
      remoteRunners: {
        enabled: CONFIG.VIDEO_TRANSCRIPTION.REMOTE_RUNNERS.ENABLED
      }
    },
    videoFile: {
      update: {
        enabled: CONFIG.VIDEO_FILE.UPDATE.ENABLED
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
      },
      videoChannelSynchronization: {
        enabled: CONFIG.IMPORT.VIDEO_CHANNEL_SYNCHRONIZATION.ENABLED,
        maxPerUser: CONFIG.IMPORT.VIDEO_CHANNEL_SYNCHRONIZATION.MAX_PER_USER
      },
      users: {
        enabled: CONFIG.IMPORT.USERS.ENABLED
      }
    },
    export: {
      users: {
        enabled: CONFIG.EXPORT.USERS.ENABLED,
        exportExpiration: CONFIG.EXPORT.USERS.EXPORT_EXPIRATION,
        maxUserVideoQuota: CONFIG.EXPORT.USERS.MAX_USER_VIDEO_QUOTA
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
      },
      channels: {
        enabled: CONFIG.FOLLOWERS.CHANNELS.ENABLED
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
    },
    storyboards: {
      enabled: CONFIG.STORYBOARDS.ENABLED,
      remoteRunners: {
        enabled: CONFIG.STORYBOARDS.REMOTE_RUNNERS.ENABLED
      }
    },
    defaults: {
      publish: {
        downloadEnabled: CONFIG.DEFAULTS.PUBLISH.DOWNLOAD_ENABLED,
        commentsPolicy: CONFIG.DEFAULTS.PUBLISH.COMMENTS_POLICY,
        privacy: CONFIG.DEFAULTS.PUBLISH.PRIVACY,
        licence: CONFIG.DEFAULTS.PUBLISH.LICENCE
      },
      p2p: {
        webapp: {
          enabled: CONFIG.DEFAULTS.P2P.WEBAPP.ENABLED
        },

        embed: {
          enabled: CONFIG.DEFAULTS.P2P.EMBED.ENABLED
        }
      },
      player: {
        theme: CONFIG.DEFAULTS.PLAYER.THEME,
        autoPlay: CONFIG.DEFAULTS.PLAYER.AUTO_PLAY
      }
    },

    email: {
      body: {
        signature: CONFIG.EMAIL.BODY.SIGNATURE
      },
      subject: {
        prefix: CONFIG.EMAIL.SUBJECT.PREFIX
      }
    },

    videoComments: {
      acceptRemoteComments: CONFIG.VIDEO_COMMENTS.ACCEPT_REMOTE_COMMENTS
    }
  }
}

function convertCustomConfigBody (body: CustomConfig) {
  function keyConverter (k: string) {
    // Transcoding resolutions exception
    if (/^\d{3,4}p$/.exec(k)) return k
    if (k === '0p') return k
    if (k === 'p2p') return k

    return snakeCase(k)
  }

  function valueConverter (v: any) {
    if (validator.isNumeric(v + '')) return parseInt('' + v, 10)

    return v
  }

  return objectConverter(body, keyConverter, valueConverter)
}
