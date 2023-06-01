import { merge } from 'lodash'
import { About, CustomConfig, HttpStatusCode, ServerConfig } from '@shared/models'
import { DeepPartial } from '@shared/typescript-utils'
import { AbstractCommand, OverrideCommandOptions } from '../shared/abstract-command'

export class ConfigCommand extends AbstractCommand {

  static getCustomConfigResolutions (enabled: boolean, with0p = false) {
    return {
      '0p': enabled && with0p,
      '144p': enabled,
      '240p': enabled,
      '360p': enabled,
      '480p': enabled,
      '720p': enabled,
      '1080p': enabled,
      '1440p': enabled,
      '2160p': enabled
    }
  }

  // ---------------------------------------------------------------------------

  static getEmailOverrideConfig (emailPort: number) {
    return {
      smtp: {
        hostname: '127.0.0.1',
        port: emailPort
      }
    }
  }

  // ---------------------------------------------------------------------------

  enableSignup (requiresApproval: boolean, limit = -1) {
    return this.updateExistingSubConfig({
      newConfig: {
        signup: {
          enabled: true,
          requiresApproval,
          limit
        }
      }
    })
  }

  // ---------------------------------------------------------------------------

  disableImports () {
    return this.setImportsEnabled(false)
  }

  enableImports () {
    return this.setImportsEnabled(true)
  }

  private setImportsEnabled (enabled: boolean) {
    return this.updateExistingSubConfig({
      newConfig: {
        import: {
          videos: {
            http: {
              enabled
            },

            torrent: {
              enabled
            }
          }
        }
      }
    })
  }

  // ---------------------------------------------------------------------------

  enableChannelSync () {
    return this.setChannelSyncEnabled(true)
  }

  disableChannelSync () {
    return this.setChannelSyncEnabled(false)
  }

  private setChannelSyncEnabled (enabled: boolean) {
    return this.updateExistingSubConfig({
      newConfig: {
        import: {
          videoChannelSynchronization: {
            enabled
          }
        }
      }
    })
  }

  // ---------------------------------------------------------------------------

  enableLive (options: {
    allowReplay?: boolean
    transcoding?: boolean
    resolutions?: 'min' | 'max' // Default max
  } = {}) {
    const { allowReplay, transcoding, resolutions = 'max' } = options

    return this.updateExistingSubConfig({
      newConfig: {
        live: {
          enabled: true,
          allowReplay: allowReplay ?? true,
          transcoding: {
            enabled: transcoding ?? true,
            resolutions: ConfigCommand.getCustomConfigResolutions(resolutions === 'max')
          }
        }
      }
    })
  }

  disableTranscoding () {
    return this.updateExistingSubConfig({
      newConfig: {
        transcoding: {
          enabled: false
        },
        videoStudio: {
          enabled: false
        }
      }
    })
  }

  // TODO: convert args to object
  enableTranscoding (webtorrent = true, hls = true, with0p = false) {
    return this.updateExistingSubConfig({
      newConfig: {
        transcoding: {
          enabled: true,

          allowAudioFiles: true,
          allowAdditionalExtensions: true,

          resolutions: ConfigCommand.getCustomConfigResolutions(true, with0p),

          webtorrent: {
            enabled: webtorrent
          },
          hls: {
            enabled: hls
          }
        }
      }
    })
  }

  // TODO: convert args to object
  enableMinimumTranscoding (webtorrent = true, hls = true) {
    return this.updateExistingSubConfig({
      newConfig: {
        transcoding: {
          enabled: true,

          allowAudioFiles: true,
          allowAdditionalExtensions: true,

          resolutions: {
            ...ConfigCommand.getCustomConfigResolutions(false),

            '240p': true
          },

          webtorrent: {
            enabled: webtorrent
          },
          hls: {
            enabled: hls
          }
        }
      }
    })
  }

  enableRemoteTranscoding () {
    return this.updateExistingSubConfig({
      newConfig: {
        transcoding: {
          remoteRunners: {
            enabled: true
          }
        },
        live: {
          transcoding: {
            remoteRunners: {
              enabled: true
            }
          }
        }
      }
    })
  }

  enableRemoteStudio () {
    return this.updateExistingSubConfig({
      newConfig: {
        videoStudio: {
          remoteRunners: {
            enabled: true
          }
        }
      }
    })
  }

  // ---------------------------------------------------------------------------

  enableStudio () {
    return this.updateExistingSubConfig({
      newConfig: {
        videoStudio: {
          enabled: true
        }
      }
    })
  }

  // ---------------------------------------------------------------------------

  getConfig (options: OverrideCommandOptions = {}) {
    const path = '/api/v1/config'

    return this.getRequestBody<ServerConfig>({
      ...options,

      path,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  async getIndexHTMLConfig (options: OverrideCommandOptions = {}) {
    const text = await this.getRequestText({
      ...options,

      path: '/',
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })

    const match = text.match('<script type="application/javascript">window.PeerTubeServerConfig = (".+?")</script>')

    // We parse the string twice, first to extract the string and then to extract the JSON
    return JSON.parse(JSON.parse(match[1])) as ServerConfig
  }

  getAbout (options: OverrideCommandOptions = {}) {
    const path = '/api/v1/config/about'

    return this.getRequestBody<About>({
      ...options,

      path,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  getCustomConfig (options: OverrideCommandOptions = {}) {
    const path = '/api/v1/config/custom'

    return this.getRequestBody<CustomConfig>({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  updateCustomConfig (options: OverrideCommandOptions & {
    newCustomConfig: CustomConfig
  }) {
    const path = '/api/v1/config/custom'

    return this.putBodyRequest({
      ...options,

      path,
      fields: options.newCustomConfig,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  deleteCustomConfig (options: OverrideCommandOptions = {}) {
    const path = '/api/v1/config/custom'

    return this.deleteRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  async updateExistingSubConfig (options: OverrideCommandOptions & {
    newConfig: DeepPartial<CustomConfig>
  }) {
    const existing = await this.getCustomConfig({ ...options, expectedStatus: HttpStatusCode.OK_200 })

    return this.updateCustomConfig({ ...options, newCustomConfig: merge({}, existing, options.newConfig) })
  }

  updateCustomSubConfig (options: OverrideCommandOptions & {
    newConfig: DeepPartial<CustomConfig>
  }) {
    const newCustomConfig: CustomConfig = {
      instance: {
        name: 'PeerTube updated',
        shortDescription: 'my short description',
        description: 'my super description',
        terms: 'my super terms',
        codeOfConduct: 'my super coc',

        creationReason: 'my super creation reason',
        moderationInformation: 'my super moderation information',
        administrator: 'Kuja',
        maintenanceLifetime: 'forever',
        businessModel: 'my super business model',
        hardwareInformation: '2vCore 3GB RAM',

        languages: [ 'en', 'es' ],
        categories: [ 1, 2 ],

        isNSFW: true,
        defaultNSFWPolicy: 'blur',

        defaultClientRoute: '/videos/recently-added',

        customizations: {
          javascript: 'alert("coucou")',
          css: 'body { background-color: red; }'
        }
      },
      theme: {
        default: 'default'
      },
      services: {
        twitter: {
          username: '@MySuperUsername',
          whitelisted: true
        }
      },
      client: {
        videos: {
          miniature: {
            preferAuthorDisplayName: false
          }
        },
        menu: {
          login: {
            redirectOnSingleExternalAuth: false
          }
        }
      },
      cache: {
        previews: {
          size: 2
        },
        captions: {
          size: 3
        },
        torrents: {
          size: 4
        },
        storyboards: {
          size: 5
        }
      },
      signup: {
        enabled: false,
        limit: 5,
        requiresApproval: true,
        requiresEmailVerification: false,
        minimumAge: 16
      },
      admin: {
        email: 'superadmin1@example.com'
      },
      contactForm: {
        enabled: true
      },
      user: {
        history: {
          videos: {
            enabled: true
          }
        },
        videoQuota: 5242881,
        videoQuotaDaily: 318742
      },
      videoChannels: {
        maxPerUser: 20
      },
      transcoding: {
        enabled: true,
        remoteRunners: {
          enabled: false
        },
        allowAdditionalExtensions: true,
        allowAudioFiles: true,
        threads: 1,
        concurrency: 3,
        profile: 'default',
        resolutions: {
          '0p': false,
          '144p': false,
          '240p': false,
          '360p': true,
          '480p': true,
          '720p': false,
          '1080p': false,
          '1440p': false,
          '2160p': false
        },
        alwaysTranscodeOriginalResolution: true,
        webtorrent: {
          enabled: true
        },
        hls: {
          enabled: false
        }
      },
      live: {
        enabled: true,
        allowReplay: false,
        latencySetting: {
          enabled: false
        },
        maxDuration: -1,
        maxInstanceLives: -1,
        maxUserLives: 50,
        transcoding: {
          enabled: true,
          remoteRunners: {
            enabled: false
          },
          threads: 4,
          profile: 'default',
          resolutions: {
            '144p': true,
            '240p': true,
            '360p': true,
            '480p': true,
            '720p': true,
            '1080p': true,
            '1440p': true,
            '2160p': true
          },
          alwaysTranscodeOriginalResolution: true
        }
      },
      videoStudio: {
        enabled: false,
        remoteRunners: {
          enabled: false
        }
      },
      import: {
        videos: {
          concurrency: 3,
          http: {
            enabled: false
          },
          torrent: {
            enabled: false
          }
        },
        videoChannelSynchronization: {
          enabled: false,
          maxPerUser: 10
        }
      },
      trending: {
        videos: {
          algorithms: {
            enabled: [ 'hot', 'most-viewed', 'most-liked' ],
            default: 'hot'
          }
        }
      },
      autoBlacklist: {
        videos: {
          ofUsers: {
            enabled: false
          }
        }
      },
      followers: {
        instance: {
          enabled: true,
          manualApproval: false
        }
      },
      followings: {
        instance: {
          autoFollowBack: {
            enabled: false
          },
          autoFollowIndex: {
            indexUrl: 'https://instances.joinpeertube.org/api/v1/instances/hosts',
            enabled: false
          }
        }
      },
      broadcastMessage: {
        enabled: true,
        level: 'warning',
        message: 'hello',
        dismissable: true
      },
      search: {
        remoteUri: {
          users: true,
          anonymous: true
        },
        searchIndex: {
          enabled: true,
          url: 'https://search.joinpeertube.org',
          disableLocalSearch: true,
          isDefaultSearch: true
        }
      }
    }

    merge(newCustomConfig, options.newConfig)

    return this.updateCustomConfig({ ...options, newCustomConfig })
  }
}
