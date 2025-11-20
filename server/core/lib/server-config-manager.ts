import { findAppropriateImage, maxBy } from '@peertube/peertube-core-utils'
import {
  ActorImageType,
  HTMLServerConfig,
  LogoType,
  RegisteredExternalAuthConfig,
  RegisteredIdAndPassAuthConfig,
  ServerConfig,
  VideoResolutionType
} from '@peertube/peertube-models'
import { getServerCommit } from '@server/helpers/version.js'
import { CONFIG, isEmailEnabled } from '@server/initializers/config.js'
import { CONSTRAINTS_FIELDS, DEFAULT_THEME_NAME, PEERTUBE_VERSION, WEBSERVER } from '@server/initializers/constants.js'
import { isSignupAllowed, isSignupAllowedForCurrentIP } from '@server/lib/signup.js'
import { ActorCustomPageModel } from '@server/models/account/actor-custom-page.js'
import { ActorImageModel } from '@server/models/actor/actor-image.js'
import { getServerActor } from '@server/models/application/application.js'
import { UploadImageModel } from '@server/models/application/upload-image.js'
import { PluginModel } from '@server/models/server/plugin.js'
import { MActorImage, MActorUploadImages, MUploadImage } from '@server/types/models/index.js'
import { Hooks } from './plugins/hooks.js'
import { PluginManager } from './plugins/plugin-manager.js'
import { getThemeOrDefault } from './plugins/theme-utils.js'
import { VideoTranscodingProfilesManager } from './transcoding/default-transcoding-profiles.js'
import { logoTypeToUploadImageEnum } from './upload-image.js'

/**
 * Used to send the server config to clients (using REST/API or plugins API)
 * We need a singleton class to manage config state depending on external events (to build menu entries etc)
 */

class ServerConfigManager {
  private static instance: ServerConfigManager

  private serverCommit: string

  private homepageEnabled = false

  private constructor () {}

  async init () {
    const instanceHomepage = await ActorCustomPageModel.loadInstanceHomepage()

    this.updateHomepageState(instanceHomepage?.content)
  }

  updateHomepageState (content: string) {
    this.homepageEnabled = !!content
  }

  isHomepageEnabled () {
    return this.homepageEnabled
  }

  async getHTMLServerConfig (): Promise<HTMLServerConfig> {
    if (this.serverCommit === undefined) this.serverCommit = await getServerCommit()

    const serverActor = await getServerActor()

    const defaultTheme = getThemeOrDefault(CONFIG.THEME.DEFAULT, DEFAULT_THEME_NAME)

    return {
      client: {
        newFeaturesInfo: CONFIG.CLIENT.NEW_FEATURES_INFO,
        header: {
          hideInstanceName: CONFIG.CLIENT.HEADER.HIDE_INSTANCE_NAME
        },
        videos: {
          miniature: {
            preferAuthorDisplayName: CONFIG.CLIENT.VIDEOS.MINIATURE.PREFER_AUTHOR_DISPLAY_NAME
          },
          resumableUpload: {
            maxChunkSize: CONFIG.CLIENT.VIDEOS.RESUMABLE_UPLOAD.MAX_CHUNK_SIZE
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
        },
        openInApp: {
          android: {
            intent: {
              enabled: CONFIG.CLIENT.OPEN_IN_APP.ANDROID.INTENT.ENABLED,
              host: CONFIG.CLIENT.OPEN_IN_APP.ANDROID.INTENT.HOST,
              scheme: CONFIG.CLIENT.OPEN_IN_APP.ANDROID.INTENT.SCHEME,
              fallbackUrl: CONFIG.CLIENT.OPEN_IN_APP.ANDROID.INTENT.FALLBACK_URL
            }
          },
          ios: {
            enabled: CONFIG.CLIENT.OPEN_IN_APP.IOS.ENABLED,
            host: CONFIG.CLIENT.OPEN_IN_APP.IOS.HOST,
            scheme: CONFIG.CLIENT.OPEN_IN_APP.IOS.SCHEME,
            fallbackUrl: CONFIG.CLIENT.OPEN_IN_APP.IOS.FALLBACK_URL
          }
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

      webadmin: {
        configuration: {
          edition: {
            allowed: CONFIG.WEBADMIN.CONFIGURATION.EDITION.ALLOWED
          }
        }
      },

      instance: {
        name: CONFIG.INSTANCE.NAME,
        shortDescription: CONFIG.INSTANCE.SHORT_DESCRIPTION,
        isNSFW: CONFIG.INSTANCE.IS_NSFW,
        defaultNSFWPolicy: CONFIG.INSTANCE.DEFAULT_NSFW_POLICY,
        defaultClientRoute: CONFIG.INSTANCE.DEFAULT_CLIENT_ROUTE,
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
        customizations: {
          javascript: CONFIG.INSTANCE.CUSTOMIZATIONS.JAVASCRIPT,
          css: CONFIG.INSTANCE.CUSTOMIZATIONS.CSS
        },

        defaultLanguage: CONFIG.INSTANCE.DEFAULT_LANGUAGE,

        avatars: serverActor.Avatars.map(a => a.toFormattedJSON()),
        banners: serverActor.Banners.map(b => b.toFormattedJSON()),

        logo: [
          ...this.getFaviconLogos(serverActor),
          ...this.getMobileHeaderLogos(serverActor),
          ...this.getDesktopHeaderLogos(serverActor),
          ...this.getOpenGraphLogos(serverActor)
        ]
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
      plugin: {
        registered: this.getRegisteredPlugins(),
        registeredExternalAuths: this.getExternalAuthsPlugins(),
        registeredIdAndPassAuths: this.getIdAndPassAuthPlugins()
      },
      theme: {
        registered: this.getRegisteredThemes(),
        builtIn: this.getBuiltInThemes(),
        default: defaultTheme,
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
      email: {
        enabled: isEmailEnabled()
      },
      contactForm: {
        enabled: CONFIG.CONTACT_FORM.ENABLED
      },
      serverVersion: PEERTUBE_VERSION,
      serverCommit: this.serverCommit,
      transcoding: {
        remoteRunners: {
          enabled: CONFIG.TRANSCODING.ENABLED && CONFIG.TRANSCODING.REMOTE_RUNNERS.ENABLED
        },
        hls: {
          enabled: CONFIG.TRANSCODING.ENABLED && CONFIG.TRANSCODING.HLS.ENABLED
        },
        web_videos: {
          enabled: CONFIG.TRANSCODING.ENABLED && CONFIG.TRANSCODING.WEB_VIDEOS.ENABLED
        },
        enabledResolutions: this.getEnabledResolutions('vod'),
        profile: CONFIG.TRANSCODING.PROFILE,
        availableProfiles: VideoTranscodingProfilesManager.Instance.getAvailableProfiles('vod')
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
            enabled: CONFIG.LIVE.TRANSCODING.ENABLED && CONFIG.LIVE.TRANSCODING.REMOTE_RUNNERS.ENABLED
          },
          enabledResolutions: this.getEnabledResolutions('live'),
          profile: CONFIG.LIVE.TRANSCODING.PROFILE,
          availableProfiles: VideoTranscodingProfilesManager.Instance.getAvailableProfiles('live')
        },

        rtmp: {
          port: CONFIG.LIVE.RTMP.PORT
        }
      },
      videoStudio: {
        enabled: CONFIG.VIDEO_STUDIO.ENABLED,
        remoteRunners: {
          enabled: CONFIG.VIDEO_STUDIO.REMOTE_RUNNERS.ENABLED
        }
      },
      videoFile: {
        update: {
          enabled: CONFIG.VIDEO_FILE.UPDATE.ENABLED
        }
      },
      videoTranscription: {
        enabled: CONFIG.VIDEO_TRANSCRIPTION.ENABLED,
        remoteRunners: {
          enabled: CONFIG.VIDEO_TRANSCRIPTION.ENABLED && CONFIG.VIDEO_TRANSCRIPTION.REMOTE_RUNNERS.ENABLED
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
        },
        videoChannelSynchronization: {
          enabled: CONFIG.IMPORT.VIDEO_CHANNEL_SYNCHRONIZATION.ENABLED
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
            max: CONSTRAINTS_FIELDS.ACTORS.IMAGE.FILE_SIZE.max
          },
          extensions: CONSTRAINTS_FIELDS.ACTORS.IMAGE.EXTNAME
        }
      },
      banner: {
        file: {
          size: {
            max: CONSTRAINTS_FIELDS.ACTORS.IMAGE.FILE_SIZE.max
          },
          extensions: CONSTRAINTS_FIELDS.ACTORS.IMAGE.EXTNAME
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
      videoChannels: {
        maxPerUser: CONFIG.VIDEO_CHANNELS.MAX_PER_USER
      },
      trending: {
        videos: {
          intervalDays: CONFIG.TRENDING.VIDEOS.INTERVAL_DAYS,
          algorithms: {
            enabled: CONFIG.TRENDING.VIDEOS.ALGORITHMS.ENABLED,
            default: CONFIG.TRENDING.VIDEOS.ALGORITHMS.DEFAULT
          }
        }
      },
      tracker: {
        enabled: CONFIG.TRACKER.ENABLED
      },

      followings: {
        instance: {
          autoFollowIndex: {
            indexUrl: CONFIG.FOLLOWINGS.INSTANCE.AUTO_FOLLOW_INDEX.INDEX_URL
          }
        }
      },

      federation: {
        enabled: CONFIG.FEDERATION.ENABLED
      },

      broadcastMessage: {
        enabled: CONFIG.BROADCAST_MESSAGE.ENABLED,
        message: CONFIG.BROADCAST_MESSAGE.MESSAGE,
        level: CONFIG.BROADCAST_MESSAGE.LEVEL,
        dismissable: CONFIG.BROADCAST_MESSAGE.DISMISSABLE
      },

      homepage: {
        enabled: this.homepageEnabled
      },

      openTelemetry: {
        metrics: {
          enabled: CONFIG.OPEN_TELEMETRY.METRICS.ENABLED,
          playbackStatsInterval: CONFIG.OPEN_TELEMETRY.METRICS.PLAYBACK_STATS_INTERVAL
        }
      },

      views: {
        videos: {
          remote: {
            maxAge: CONFIG.VIEWS.VIDEOS.REMOTE.MAX_AGE
          },

          local: {
            maxAge: CONFIG.VIEWS.VIDEOS.LOCAL.MAX_AGE
          },

          watchingInterval: {
            anonymous: CONFIG.VIEWS.VIDEOS.WATCHING_INTERVAL.ANONYMOUS,
            users: CONFIG.VIEWS.VIDEOS.WATCHING_INTERVAL.USERS
          }
        }
      },

      storyboards: {
        enabled: CONFIG.STORYBOARDS.ENABLED,
        remoteRunners: {
          enabled: CONFIG.STORYBOARDS.REMOTE_RUNNERS.ENABLED
        }
      },

      webrtc: {
        stunServers: CONFIG.WEBRTC.STUN_SERVERS
      },

      nsfwFlagsSettings: {
        enabled: CONFIG.NSFW_FLAGS_SETTINGS.ENABLED
      },

      fieldsConstraints: {
        users: {
          password: {
            minLength: CONSTRAINTS_FIELDS.USERS.PASSWORD.min,
            maxLength: CONSTRAINTS_FIELDS.USERS.PASSWORD.max
          }
        }
      }
    }
  }

  async getServerConfig (ip?: string): Promise<ServerConfig> {
    const { allowed } = await Hooks.wrapPromiseFun(
      isSignupAllowed,
      {
        ip,
        signupMode: CONFIG.SIGNUP.REQUIRES_APPROVAL
          ? 'request-registration'
          : 'direct-registration'
      },
      CONFIG.SIGNUP.REQUIRES_APPROVAL
        ? 'filter:api.user.request-signup.allowed.result'
        : 'filter:api.user.signup.allowed.result'
    )

    const allowedForCurrentIP = isSignupAllowedForCurrentIP(ip)

    const signup = {
      allowed,
      allowedForCurrentIP,
      minimumAge: CONFIG.SIGNUP.MINIMUM_AGE,
      requiresApproval: CONFIG.SIGNUP.REQUIRES_APPROVAL,
      requiresEmailVerification: CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION
    } satisfies ServerConfig['signup']

    const htmlConfig = await this.getHTMLServerConfig()

    return { ...htmlConfig, signup }
  }

  getRegisteredThemes () {
    return PluginManager.Instance.getRegisteredThemes()
      .map(t => ({
        npmName: PluginModel.buildNpmName(t.name, t.type),
        name: t.name,
        version: t.version,
        description: t.description,
        css: t.css,
        clientScripts: t.clientScripts
      }))
  }

  getBuiltInThemes () {
    return [
      {
        name: 'peertube-core-dark-brown' as 'peertube-core-dark-brown'
      },
      {
        name: 'peertube-core-light-beige' as 'peertube-core-light-beige'
      }
    ]
  }

  getRegisteredPlugins () {
    return PluginManager.Instance.getRegisteredPlugins()
      .map(p => ({
        npmName: PluginModel.buildNpmName(p.name, p.type),
        name: p.name,
        version: p.version,
        description: p.description,
        clientScripts: p.clientScripts
      }))
  }

  getEnabledResolutions (type: 'vod' | 'live') {
    const transcoding = type === 'vod'
      ? CONFIG.TRANSCODING
      : CONFIG.LIVE.TRANSCODING

    return Object.keys(transcoding.RESOLUTIONS)
      .filter(key => transcoding.ENABLED && transcoding.RESOLUTIONS[key] === true)
      .map(r => parseInt(r, 10) as VideoResolutionType)
  }

  private getIdAndPassAuthPlugins () {
    const result: RegisteredIdAndPassAuthConfig[] = []

    for (const p of PluginManager.Instance.getIdAndPassAuths()) {
      for (const auth of p.idAndPassAuths) {
        result.push({
          npmName: p.npmName,
          name: p.name,
          version: p.version,
          authName: auth.authName,
          weight: auth.getWeight()
        })
      }
    }

    return result
  }

  private getExternalAuthsPlugins () {
    const result: RegisteredExternalAuthConfig[] = []

    for (const p of PluginManager.Instance.getExternalAuths()) {
      for (const auth of p.externalAuths) {
        result.push({
          npmName: p.npmName,
          name: p.name,
          version: p.version,
          authName: auth.authName,
          authDisplayName: auth.authDisplayName()
        })
      }
    }

    return result
  }

  // ---------------------------------------------------------------------------
  // Logo
  // ---------------------------------------------------------------------------

  getFavicon (serverActor: MActorUploadImages) {
    return findAppropriateImage(this.getFaviconLogos(serverActor), 32)
  }

  getDefaultOpenGraph (serverActor: MActorUploadImages) {
    return maxBy(this.getOpenGraphLogos(serverActor), 'width')
  }

  getLogoUrl (serverActor: MActorUploadImages, width: 192 | 512) {
    const customLogo = this.getLogo(serverActor, width)

    if (customLogo) {
      return WEBSERVER.URL + customLogo.getStaticPath()
    }

    return `${WEBSERVER.URL}/client/assets/images/icons/icon-${width}x${width}.png`
  }

  getLogo (serverActor: MActorUploadImages, width: 192 | 512) {
    if (serverActor.Avatars.length > 0) {
      return findAppropriateImage(serverActor.Avatars, width)
    }

    return undefined
  }

  private getFaviconLogos (serverActor: MActorUploadImages) {
    return this.getLogoWithFallbacks({
      serverActor,
      logoType: 'favicon',

      defaultLogo: {
        fileUrl: WEBSERVER.URL + '/client/assets/images/favicon.png',
        width: 32,
        height: 32
      }
    })
  }

  private getMobileHeaderLogos (serverActor: MActorUploadImages) {
    return this.getLogoWithFallbacks({
      serverActor,
      logoType: 'header-square',

      defaultLogo: {
        fileUrl: WEBSERVER.URL + '/client/assets/images/logo.svg',
        width: 34,
        height: 34
      }
    })
  }

  private getDesktopHeaderLogos (serverActor: MActorUploadImages) {
    return this.getLogoWithFallbacks({
      serverActor,
      logoType: 'header-wide',

      defaultLogo: {
        fileUrl: WEBSERVER.URL + '/client/assets/images/logo.svg',
        width: 34,
        height: 34
      }
    })
  }

  private getOpenGraphLogos (serverActor: MActorUploadImages) {
    return this.getLogoWithFallbacks({
      serverActor,
      logoType: 'opengraph',

      defaultLogo: undefined
    })
  }

  private getLogoWithFallbacks (options: {
    serverActor: MActorUploadImages
    logoType: LogoType

    defaultLogo: {
      fileUrl: string
      width: number
      height: number
    }
  }) {
    const { serverActor, logoType, defaultLogo } = options

    const uploadImageType = logoTypeToUploadImageEnum(logoType)

    const uploaded = serverActor.UploadImages
      .filter(i => i.type === uploadImageType)
      .map(i => this.formatUploadImageForLogo(i, logoType, false))

    if (uploaded.length !== 0) return uploaded

    // Avatar fallback?
    if (serverActor.hasImage(ActorImageType.AVATAR)) {
      return serverActor.Avatars.map(a => this.formatActorImageForLogo(a, logoType, true))
    }

    // Default mobile header logo?
    if (!defaultLogo) return []

    return [ { ...defaultLogo, type: logoType, isFallback: true } ]
  }

  private formatUploadImageForLogo (logo: MUploadImage, type: LogoType, isFallback: boolean) {
    return {
      height: logo.height,
      width: logo.width,
      type,
      fileUrl: UploadImageModel.getImageUrl(logo),
      isFallback
    }
  }

  private formatActorImageForLogo (logo: MActorImage, type: LogoType, isFallback: boolean) {
    return {
      height: logo.height,
      width: logo.width,
      type,
      fileUrl: ActorImageModel.getImageUrl(logo),
      isFallback
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  ServerConfigManager
}
