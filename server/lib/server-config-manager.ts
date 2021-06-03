import { getServerCommit } from '@server/helpers/utils'
import { CONFIG, isEmailEnabled } from '@server/initializers/config'
import { CONSTRAINTS_FIELDS, DEFAULT_THEME_NAME, PEERTUBE_VERSION } from '@server/initializers/constants'
import { isSignupAllowed, isSignupAllowedForCurrentIP } from '@server/lib/signup'
import { ActorCustomPageModel } from '@server/models/account/actor-custom-page'
import { HTMLServerConfig, RegisteredExternalAuthConfig, RegisteredIdAndPassAuthConfig, ServerConfig } from '@shared/models'
import { Hooks } from './plugins/hooks'
import { PluginManager } from './plugins/plugin-manager'
import { getThemeOrDefault } from './plugins/theme-utils'
import { VideoTranscodingProfilesManager } from './transcoding/video-transcoding-profiles'

/**
 *
 * Used to send the server config to clients (using REST/API or plugins API)
 * We need a singleton class to manage config state depending on external events (to build menu entries etc)
 *
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

  async getHTMLServerConfig (): Promise<HTMLServerConfig> {
    if (this.serverCommit === undefined) this.serverCommit = await getServerCommit()

    const defaultTheme = getThemeOrDefault(CONFIG.THEME.DEFAULT, DEFAULT_THEME_NAME)

    return {
      instance: {
        name: CONFIG.INSTANCE.NAME,
        shortDescription: CONFIG.INSTANCE.SHORT_DESCRIPTION,
        isNSFW: CONFIG.INSTANCE.IS_NSFW,
        defaultNSFWPolicy: CONFIG.INSTANCE.DEFAULT_NSFW_POLICY,
        defaultClientRoute: CONFIG.INSTANCE.DEFAULT_CLIENT_ROUTE,
        customizations: {
          javascript: CONFIG.INSTANCE.CUSTOMIZATIONS.JAVASCRIPT,
          css: CONFIG.INSTANCE.CUSTOMIZATIONS.CSS
        }
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
        default: defaultTheme
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
        hls: {
          enabled: CONFIG.TRANSCODING.HLS.ENABLED
        },
        webtorrent: {
          enabled: CONFIG.TRANSCODING.WEBTORRENT.ENABLED
        },
        enabledResolutions: this.getEnabledResolutions('vod'),
        profile: CONFIG.TRANSCODING.PROFILE,
        availableProfiles: VideoTranscodingProfilesManager.Instance.getAvailableProfiles('vod')
      },
      live: {
        enabled: CONFIG.LIVE.ENABLED,

        allowReplay: CONFIG.LIVE.ALLOW_REPLAY,
        maxDuration: CONFIG.LIVE.MAX_DURATION,
        maxInstanceLives: CONFIG.LIVE.MAX_INSTANCE_LIVES,
        maxUserLives: CONFIG.LIVE.MAX_USER_LIVES,

        transcoding: {
          enabled: CONFIG.LIVE.TRANSCODING.ENABLED,
          enabledResolutions: this.getEnabledResolutions('live'),
          profile: CONFIG.LIVE.TRANSCODING.PROFILE,
          availableProfiles: VideoTranscodingProfilesManager.Instance.getAvailableProfiles('live')
        },

        rtmp: {
          port: CONFIG.LIVE.RTMP.PORT
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

      broadcastMessage: {
        enabled: CONFIG.BROADCAST_MESSAGE.ENABLED,
        message: CONFIG.BROADCAST_MESSAGE.MESSAGE,
        level: CONFIG.BROADCAST_MESSAGE.LEVEL,
        dismissable: CONFIG.BROADCAST_MESSAGE.DISMISSABLE
      },

      homepage: {
        enabled: this.homepageEnabled
      }
    }
  }

  async getServerConfig (ip?: string): Promise<ServerConfig> {
    const { allowed } = await Hooks.wrapPromiseFun(
      isSignupAllowed,
      {
        ip
      },
      'filter:api.user.signup.allowed.result'
    )

    const allowedForCurrentIP = isSignupAllowedForCurrentIP(ip)

    const signup = {
      allowed,
      allowedForCurrentIP,
      minimumAge: CONFIG.SIGNUP.MINIMUM_AGE,
      requiresEmailVerification: CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION
    }

    const htmlConfig = await this.getHTMLServerConfig()

    return { ...htmlConfig, signup }
  }

  getRegisteredThemes () {
    return PluginManager.Instance.getRegisteredThemes()
                        .map(t => ({
                          name: t.name,
                          version: t.version,
                          description: t.description,
                          css: t.css,
                          clientScripts: t.clientScripts
                        }))
  }

  getRegisteredPlugins () {
    return PluginManager.Instance.getRegisteredPlugins()
                        .map(p => ({
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
                 .map(r => parseInt(r, 10))
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

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  ServerConfigManager
}
