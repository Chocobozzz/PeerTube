import { merge } from 'lodash'
import { About, CustomConfig, HttpStatusCode, ServerConfig } from '@shared/models'
import { DeepPartial } from '@shared/typescript-utils'
import { AbstractCommand, OverrideCommandOptions } from '../shared/abstract-command'

export class ConfigCommand extends AbstractCommand {

  static getCustomConfigResolutions (enabled: boolean) {
    return {
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

  disableImports () {
    return this.setImportsEnabled(false)
  }

  enableImports () {
    return this.setImportsEnabled(true)
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

  enableChannelSync () {
    return this.setChannelSyncEnabled(true)
  }

  disableChannelSync () {
    return this.setChannelSyncEnabled(false)
  }

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

  enableTranscoding (webtorrent = true, hls = true) {
    return this.updateExistingSubConfig({
      newConfig: {
        transcoding: {
          enabled: true,

          allowAudioFiles: true,
          allowAdditionalExtensions: true,

          resolutions: ConfigCommand.getCustomConfigResolutions(true),

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

  enableMinimumTranscoding (webtorrent = true, hls = true) {
    return this.updateExistingSubConfig({
      newConfig: {
        transcoding: {
          enabled: true,
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

  enableStudio () {
    return this.updateExistingSubConfig({
      newConfig: {
        videoStudio: {
          enabled: true
        }
      }
    })
  }

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
        }
      },
      signup: {
        enabled: false,
        limit: 5,
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
        videoQuota: 5242881,
        videoQuotaDaily: 318742
      },
      videoChannels: {
        maxPerUser: 20
      },
      transcoding: {
        enabled: true,
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
        enabled: false
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
