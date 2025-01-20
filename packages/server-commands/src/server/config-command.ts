import { About, ActorImageType, ActorImageType_Type, CustomConfig, HttpStatusCode, ServerConfig } from '@peertube/peertube-models'
import { DeepPartial } from '@peertube/peertube-typescript-utils'
import merge from 'lodash-es/merge.js'
import { AbstractCommand, OverrideCommandOptions } from '../shared/abstract-command.js'

export class ConfigCommand extends AbstractCommand {

  private savedConfig: CustomConfig

  static getConfigResolutions (enabled: boolean, with0p = false) {
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

  static getCustomConfigResolutions (enabled: number[]) {
    return {
      '0p': enabled.includes(0),
      '144p': enabled.includes(144),
      '240p': enabled.includes(240),
      '360p': enabled.includes(360),
      '480p': enabled.includes(480),
      '720p': enabled.includes(720),
      '1080p': enabled.includes(1080),
      '1440p': enabled.includes(1440),
      '2160p': enabled.includes(2160)
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
    resolutions?: 'min' | 'max' | number[] // default 'min'
    transcoding?: boolean
    maxDuration?: number
    alwaysTranscodeOriginalResolution?: boolean
  } = {}) {
    const { allowReplay, transcoding, maxDuration, resolutions = 'min', alwaysTranscodeOriginalResolution } = options

    return this.updateExistingConfig({
      newConfig: {
        live: {
          enabled: true,
          allowReplay,
          maxDuration,
          transcoding: {
            enabled: transcoding,

            alwaysTranscodeOriginalResolution,

            resolutions: Array.isArray(resolutions)
              ? ConfigCommand.getCustomConfigResolutions(resolutions)
              : ConfigCommand.getConfigResolutions(resolutions === 'max')
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

  async enableTranscoding (options: {
    webVideo?: boolean
    hls?: boolean
    keepOriginal?: boolean
    splitAudioAndVideo?: boolean

    resolutions?: 'min' | 'max' | number[]

    with0p?: boolean

    alwaysTranscodeOriginalResolution?: boolean

    maxFPS?: number
  } = {}) {
    const {
      webVideo,
      hls,
      with0p,
      keepOriginal,
      splitAudioAndVideo,
      alwaysTranscodeOriginalResolution,
      maxFPS
    } = options

    let resolutions: ReturnType<typeof ConfigCommand.getCustomConfigResolutions>

    if (Array.isArray(options.resolutions)) {
      resolutions = ConfigCommand.getCustomConfigResolutions(options.resolutions)
    } else if (typeof options.resolutions === 'string') {
      resolutions = ConfigCommand.getConfigResolutions(options.resolutions === 'max', with0p)
    } else if (with0p !== undefined) {
      const existing = await this.getCustomConfig({ ...options, expectedStatus: HttpStatusCode.OK_200 })

      resolutions = existing.transcoding.resolutions
      resolutions['0p'] = with0p === true
    }

    return this.updateExistingConfig({
      newConfig: {
        transcoding: {
          enabled: true,
          originalFile: {
            keep: keepOriginal
          },

          allowAudioFiles: true,
          allowAdditionalExtensions: true,

          resolutions,

          alwaysTranscodeOriginalResolution,

          webVideos: {
            enabled: webVideo
          },
          hls: {
            enabled: hls,
            splitAudioAndVideo
          },
          fps: {
            max: maxFPS
          }
        }
      }
    })
  }

  setTranscodingConcurrency (concurrency: number) {
    return this.updateExistingConfig({
      newConfig: {
        transcoding: {
          concurrency
        }
      }
    })
  }

  enableMinimumTranscoding (options: {
    webVideo?: boolean // default true
    hls?: boolean // default true
    splitAudioAndVideo?: boolean // default false
    keepOriginal?: boolean // default false
  } = {}) {
    const { webVideo = true, hls = true, keepOriginal = false, splitAudioAndVideo = false } = options

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
            ...ConfigCommand.getConfigResolutions(false),

            '240p': true
          },

          webVideos: {
            enabled: webVideo
          },
          hls: {
            enabled: hls,
            splitAudioAndVideo
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

  enableTranscription ({ remote = false }: { remote?: boolean } = {}) {
    return this.setTranscriptionEnabled(true, remote)
  }

  disableTranscription () {
    return this.setTranscriptionEnabled(false, false)
  }

  private setTranscriptionEnabled (enabled: boolean, remoteEnabled: boolean) {
    return this.updateExistingConfig({
      newConfig: {
        videoTranscription: {
          enabled,
          remoteRunners: {
            enabled: remoteEnabled
          }
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

  // ---------------------------------------------------------------------------

  async save () {
    this.savedConfig = await this.getCustomConfig()
  }

  rollback () {
    return this.updateCustomConfig({ newCustomConfig: this.savedConfig })
  }
}
