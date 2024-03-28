import { About, ActorImageType, ActorImageType_Type, CustomConfig, HttpStatusCode, ServerConfig } from '@peertube/peertube-models'
import { DeepPartial } from '@peertube/peertube-typescript-utils'
import merge from 'lodash-es/merge.js'
import { AbstractCommand, OverrideCommandOptions } from '../shared/abstract-command.js'

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

  static getDisableRatesLimitOverrideConfig () {
    return {
      rates_limit: {
        api: {
          max: 5000
        }
      }
    }
  }

  // ---------------------------------------------------------------------------

  enableSignup (requiresApproval: boolean, limit = -1) {
    return this.updateExistingConfig({
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

  disableVideoImports () {
    return this.setVideoImportsEnabled(false)
  }

  enableVideoImports () {
    return this.setVideoImportsEnabled(true)
  }

  private setVideoImportsEnabled (enabled: boolean) {
    return this.updateExistingConfig({
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

  disableFileUpdate () {
    return this.setFileUpdateEnabled(false)
  }

  enableFileUpdate () {
    return this.setFileUpdateEnabled(true)
  }

  private setFileUpdateEnabled (enabled: boolean) {
    return this.updateExistingConfig({
      newConfig: {
        videoFile: {
          update: {
            enabled
          }
        }
      }
    })
  }

  // ---------------------------------------------------------------------------

  keepSourceFile () {
    return this.updateExistingConfig({
      newConfig: {
        transcoding: {
          originalFile: {
            keep: true
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
    return this.updateExistingConfig({
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

  enableAutoBlacklist () {
    return this.setAutoblacklistEnabled(true)
  }

  disableAutoBlacklist () {
    return this.setAutoblacklistEnabled(false)
  }

  private setAutoblacklistEnabled (enabled: boolean) {
    return this.updateExistingConfig({
      newConfig: {
        autoBlacklist: {
          videos: {
            ofUsers: {
              enabled
            }
          }
        }
      }
    })
  }

  // ---------------------------------------------------------------------------

  enableUserImport () {
    return this.setUserImportEnabled(true)
  }

  disableUserImport () {
    return this.setUserImportEnabled(false)
  }

  private setUserImportEnabled (enabled: boolean) {
    return this.updateExistingConfig({
      newConfig: {
        import: {
          users: {
            enabled
          }
        }
      }
    })
  }

  // ---------------------------------------------------------------------------

  enableUserExport () {
    return this.setUserExportEnabled(true)
  }

  disableUserExport () {
    return this.setUserExportEnabled(false)
  }

  private setUserExportEnabled (enabled: boolean) {
    return this.updateExistingConfig({
      newConfig: {
        export: {
          users: {
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

    return this.updateExistingConfig({
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
    return this.updateExistingConfig({
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

  enableTranscoding (options: {
    webVideo?: boolean // default true
    hls?: boolean // default true
    with0p?: boolean // default false
    keepOriginal?: boolean // default false
  } = {}) {
    const { webVideo = true, hls = true, with0p = false, keepOriginal = false } = options

    return this.updateExistingConfig({
      newConfig: {
        transcoding: {
          enabled: true,
          originalFile: {
            keep: keepOriginal
          },

          allowAudioFiles: true,
          allowAdditionalExtensions: true,

          resolutions: ConfigCommand.getCustomConfigResolutions(true, with0p),

          webVideos: {
            enabled: webVideo
          },
          hls: {
            enabled: hls
          }
        }
      }
    })
  }

  enableMinimumTranscoding (options: {
    webVideo?: boolean // default true
    hls?: boolean // default true
    keepOriginal?: boolean // default false
  } = {}) {
    const { webVideo = true, hls = true, keepOriginal = false } = options

    return this.updateExistingConfig({
      newConfig: {
        transcoding: {
          enabled: true,
          originalFile: {
            keep: keepOriginal
          },

          allowAudioFiles: true,
          allowAdditionalExtensions: true,

          resolutions: {
            ...ConfigCommand.getCustomConfigResolutions(false),

            '240p': true
          },

          webVideos: {
            enabled: webVideo
          },
          hls: {
            enabled: hls
          }
        }
      }
    })
  }

  enableRemoteTranscoding () {
    return this.updateExistingConfig({
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
    return this.updateExistingConfig({
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
    return this.updateExistingConfig({
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

  // ---------------------------------------------------------------------------

  updateInstanceImage (options: OverrideCommandOptions & {
    fixture: string
    type: ActorImageType_Type
  }) {
    const { fixture, type } = options

    const path = type === ActorImageType.BANNER
      ? `/api/v1/config/instance-banner/pick`
      : `/api/v1/config/instance-avatar/pick`

    return this.updateImageRequest({
      ...options,

      path,
      fixture,
      fieldname: type === ActorImageType.BANNER
        ? 'bannerfile'
        : 'avatarfile',

      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  deleteInstanceImage (options: OverrideCommandOptions & {
    type: ActorImageType_Type
  }) {
    const suffix = options.type === ActorImageType.BANNER
      ? 'instance-banner'
      : 'instance-avatar'

    const path = `/api/v1/config/${suffix}`

    return this.deleteRequest({
      ...options,

      path,

      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  // ---------------------------------------------------------------------------

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

  async updateExistingConfig (options: OverrideCommandOptions & {
    newConfig: DeepPartial<CustomConfig>
  }) {
    const existing = await this.getCustomConfig({ ...options, expectedStatus: HttpStatusCode.OK_200 })

    return this.updateCustomConfig({ ...options, newCustomConfig: merge({}, existing, options.newConfig) })
  }
}
