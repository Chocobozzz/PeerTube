import { exists } from '@peertube/peertube-core-utils'
import { CustomConfig, VideoCommentPolicy, VideoPrivacy } from '@peertube/peertube-models'
import { AttributesOnly } from '@peertube/peertube-typescript-utils'
import { getBytes } from '@root-helpers/bytes'
import merge from 'lodash-es/merge'
import { Jsonify, PartialDeep } from 'type-fest'

export type RegistrationType = 'open' | 'closed' | 'approval'
export type EnabledDisabled = 'disabled' | 'enabled'
export type AuthType = 'local' | 'ldap' | 'saml' | 'oidc'

export class UsageType {
  registration: RegistrationType
  videoQuota: number
  remoteImport: EnabledDisabled
  live: EnabledDisabled
  globalSearch: EnabledDisabled
  defaultPrivacy: typeof VideoPrivacy.INTERNAL | typeof VideoPrivacy.PUBLIC
  defaultCommentPolicy: typeof VideoCommentPolicy.REQUIRES_APPROVAL
  p2p: EnabledDisabled
  federation: EnabledDisabled
  keepOriginalVideo: EnabledDisabled
  allowReplaceFile: EnabledDisabled
  preferDisplayName: EnabledDisabled
  transcription: EnabledDisabled
  authType: AuthType

  private unsafeExplanations: string[] = []
  private config: PartialDeep<CustomConfig> = {}
  private plugins: string[] = []

  private constructor (options: Required<Jsonify<UsageType>>) {
    for (const [ key, value ] of Object.entries(options)) {
      ;(this as any)[key] = value
    }
  }

  static initForCommunity () {
    const usageType = new UsageType({
      registration: 'approval',
      remoteImport: 'disabled',
      live: 'enabled',
      videoQuota: 5 * 1024 * 1024 * 1024, // Default to 5GB,
      globalSearch: 'enabled',

      defaultPrivacy: VideoPrivacy.PUBLIC,
      p2p: 'enabled',
      federation: 'enabled',
      keepOriginalVideo: 'disabled',
      allowReplaceFile: 'disabled',

      // Use current config
      defaultCommentPolicy: undefined,
      authType: undefined,
      preferDisplayName: undefined,
      transcription: undefined
    })

    usageType.compute()

    return usageType
  }

  static initForPrivateInstance () {
    const usageType = new UsageType({
      registration: 'closed',
      remoteImport: 'enabled',
      live: 'enabled',
      videoQuota: -1,
      globalSearch: 'disabled',

      defaultPrivacy: VideoPrivacy.INTERNAL,
      p2p: 'disabled',
      federation: 'disabled',
      keepOriginalVideo: 'enabled',
      allowReplaceFile: 'enabled',
      preferDisplayName: 'enabled',

      // Use current config
      defaultCommentPolicy: undefined,
      authType: undefined,
      transcription: undefined
    })

    usageType.compute()

    return usageType
  }

  static initForInstitution () {
    const usageType = new UsageType({
      registration: 'closed',
      remoteImport: 'enabled',
      live: 'enabled',
      videoQuota: -1,
      globalSearch: 'disabled',

      defaultPrivacy: VideoPrivacy.PUBLIC,
      p2p: 'disabled',
      keepOriginalVideo: 'enabled',
      allowReplaceFile: 'enabled',
      preferDisplayName: 'enabled',

      authType: 'local',
      transcription: 'enabled',

      defaultCommentPolicy: VideoCommentPolicy.REQUIRES_APPROVAL,

      // Use current config
      federation: undefined
    })

    usageType.compute()

    return usageType
  }

  private compute () {
    this.unsafeExplanations = []
    this.plugins = []
    this.config = {}

    this.computeRegistration()
    this.computeDefaultVideoPrivacy()
    this.computeVideoQuota()
    this.computeKeepOriginalVideo()
    this.computeReplaceVideoFile()
    this.computeVideoImport()
    this.computeStreamLives()
    this.computeP2P()
    this.computeGlobalSearch()
    this.computeDefaultVideoCommentPolicy()
    this.computeFederation()
    this.computeMiniatureSettings()
    this.computeTranscription()
    this.computeAuth()
  }

  getUnsafeExplanations () {
    return [ ...this.unsafeExplanations ]
  }

  getConfig () {
    return { ...this.config }
  }

  getPlugins () {
    return [ ...this.plugins ]
  }

  patch (obj: Partial<AttributesOnly<UsageType>>) {
    for (const [ key, value ] of Object.entries(obj)) {
      ;(this as any)[key] = value
    }

    this.compute()
  }

  private computeRegistration () {
    if (!exists(this.registration)) return

    if (this.registration === 'open') {
      this.addExplanation($localize`:bullet point of "PeerTube will\:":<strong>Allow</strong> any user <strong>to register</strong>`)

      this.addConfig({
        signup: {
          enabled: true,
          requiresApproval: false
        }
      })
    } else if (this.registration === 'approval') {
      this.addExplanation(
        $localize`:bullet point of "PeerTube will\:":Allow users to <strong>apply for registration</strong> on your platform`
      )

      this.addConfig({
        signup: {
          enabled: true,
          requiresApproval: true
        }
      })
    } else if (this.registration === 'closed') {
      this.addExplanation($localize`:bullet point of "PeerTube will\:":<strong>Disable</strong> user <strong>registration</strong>`)

      this.addConfig({
        signup: {
          enabled: false
        }
      })
    }

    if (this.registration === 'approval' || this.registration === 'open') {
      this.addExplanation(
        $localize`:bullet point of "PeerTube will\:":Require <strong>moderator approval</strong> for videos published by your community`
      )

      this.addConfig({
        autoBlacklist: {
          videos: {
            ofUsers: {
              enabled: true
            }
          }
        }
      })
    }
  }

  private computeVideoQuota () {
    if (!exists(this.videoQuota)) return

    this.addConfig({
      user: {
        videoQuota: this.videoQuota
      }
    })

    if (this.videoQuota === 0) {
      this.addExplanation(
        // eslint-disable-next-line max-len
        $localize`:bullet point of "PeerTube will\:":<strong>Prevent</strong> new users <strong>from uploading videos</strong> (can be changed by moderators)`
      )
    } else if (this.videoQuota === -1) {
      this.addExplanation(
        $localize`:bullet point of "PeerTube will\:":<strong>Not limit the amount of videos</strong> new users can upload`
      )
    } else {
      this.addExplanation(
        $localize`:bullet point of "PeerTube will\:":Set <strong>video quota to ${
          getBytes(this.videoQuota, 0)
        }</strong> for new users (can be changed by moderators)`
      )
    }
  }

  private computeVideoImport () {
    if (!exists(this.remoteImport)) return

    this.addConfig({
      import: {
        videos: {
          http: {
            enabled: this.remoteImport === 'enabled'
          }
        },
        videoChannelSynchronization: {
          enabled: this.remoteImport === 'enabled'
        }
      }
    })

    if (this.remoteImport === 'enabled') {
      this.addExplanation(
        // eslint-disable-next-line max-len
        $localize`:bullet point of "PeerTube will\:":<strong>Allow</strong> your users <strong>to import and synchronize</strong> videos from remote platforms (YouTube, Vimeo...)`
      )
    } else {
      this.addExplanation(
        // eslint-disable-next-line max-len
        $localize`:bullet point of "PeerTube will\:":<strong>Prevent</strong> your users <strong>from importing videos</strong> from remote platforms`
      )
    }
  }

  private computeStreamLives () {
    if (!exists(this.live)) return

    this.addConfig({
      live: {
        enabled: this.live === 'enabled'
      }
    })

    if (this.live === 'enabled') {
      this.plugins.push('peertube-plugin-livechat')

      this.addExplanation(
        // eslint-disable-next-line max-len
        $localize`:bullet point of "PeerTube will\:":<strong>Allow</strong> your users <strong>to stream lives</strong> and chat with their viewers using the <strong>Livechat</strong> plugin`
      )
    } else {
      this.addExplanation(
        $localize`:bullet point of "PeerTube will\:":<strong>Prevent</strong> your users from running <strong>live streams</strong>`
      )
    }
  }

  private computeDefaultVideoPrivacy () {
    if (!exists(this.defaultPrivacy)) return

    this.addConfig({
      defaults: {
        publish: {
          privacy: this.defaultPrivacy
        }
      }
    })

    if (this.defaultPrivacy === VideoPrivacy.INTERNAL) {
      this.addExplanation(
        $localize`:bullet point of "PeerTube will\:":Set the <strong>default video privacy</strong> to <strong>Internal</strong>`
      )
    } else if (this.defaultPrivacy === VideoPrivacy.PUBLIC) {
      this.addExplanation(
        $localize`:bullet point of "PeerTube will\:":Set the <strong>default video privacy</strong> to <strong>Public</strong>`
      )
    }
  }

  private computeDefaultVideoCommentPolicy () {
    if (!exists(this.defaultCommentPolicy)) return

    this.addConfig({
      defaults: {
        publish: {
          commentsPolicy: this.defaultCommentPolicy
        }
      }
    })

    this.addExplanation($localize`:bullet point of "PeerTube will\:":<strong>Require approval</strong> by default of new video comment`)
  }

  private computeP2P () {
    if (!exists(this.p2p)) return

    this.addConfig({
      defaults: {
        p2p: {
          embed: {
            enabled: this.p2p === 'enabled'
          },
          webapp: {
            enabled: this.p2p === 'enabled'
          }
        }
      }
    })

    if (this.p2p === 'enabled') {
      this.addExplanation(
        $localize`:bullet point of "PeerTube will\:":<strong>Enable P2P streaming</strong> by default for anonymous and new users`
      )
    } else {
      this.addExplanation(
        $localize`:bullet point of "PeerTube will\:":<strong>Disable P2P streaming</strong> by default for anonymous and new users`
      )
    }
  }

  private computeFederation () {
    if (!exists(this.federation)) return

    this.addConfig({
      followers: {
        instance: {
          enabled: this.federation === 'enabled'
        },
        channels: {
          enabled: this.federation === 'enabled'
        }
      }
    })

    if (this.federation === 'enabled') {
      this.addExplanation(
        // eslint-disable-next-line max-len
        $localize`:bullet point of "PeerTube will\:":<strong>Allow</strong> external platforms/users to <strong>subscribe</strong> to your content`
      )
    } else {
      this.addExplanation(
        // eslint-disable-next-line max-len
        $localize`:bullet point of "PeerTube will\:":<strong>Prevent</strong> external platforms/users to <strong>subscribe to your content</strong>`
      )
    }
  }

  private computeKeepOriginalVideo () {
    if (!exists(this.keepOriginalVideo)) return

    this.addConfig({
      transcoding: {
        originalFile: {
          keep: this.keepOriginalVideo === 'enabled'
        }
      }
    })

    if (this.keepOriginalVideo === 'enabled') {
      this.addExplanation($localize`:bullet point of "PeerTube will\:":<strong>Save a copy</strong> of the uploaded video file`)
    }
  }

  private computeReplaceVideoFile () {
    if (!exists(this.allowReplaceFile)) return

    this.addConfig({
      videoFile: {
        update: {
          enabled: this.allowReplaceFile === 'enabled'
        }
      }
    })

    if (this.allowReplaceFile === 'enabled') {
      this.addExplanation(
        // eslint-disable-next-line max-len
        $localize`:bullet point of "PeerTube will\:":<strong>Allow</strong> your users <strong>to replace a video</strong> that has already been published`
      )
    }
  }

  private computeMiniatureSettings () {
    if (!exists(this.preferDisplayName)) return

    this.addConfig({
      client: {
        videos: {
          miniature: {
            preferAuthorDisplayName: this.preferDisplayName === 'enabled'
          }
        }
      }
    })
  }

  private computeGlobalSearch () {
    if (!exists(this.globalSearch)) return

    this.addConfig({
      search: {
        searchIndex: {
          enabled: this.globalSearch === 'enabled',
          isDefaultSearch: this.globalSearch === 'enabled',
          url: 'https://sepiasearch.org'
        }
      }
    })

    if (this.globalSearch === 'enabled') {
      this.addExplanation(
        // eslint-disable-next-line max-len
        $localize`:bullet point of "PeerTube will\:":Set <a href="https://sepiasearch.org" target="_blank">SepiaSearch</a> as <strong>default search engine</strong>`
      )
    }
  }

  private computeTranscription () {
    if (!exists(this.transcription)) return

    this.addConfig({
      videoTranscription: {
        enabled: this.transcription === 'enabled'
      }
    })

    if (this.transcription === 'enabled') {
      this.addExplanation(
        // eslint-disable-next-line max-len
        $localize`:bullet point of "PeerTube will\:":<strong>Enable automatic transcription</strong> of videos to create subtitles and improve accessibility`
      )
    }
  }

  private computeAuth () {
    if (!exists(this.authType)) return

    const configStr =
      // eslint-disable-next-line max-len
      $localize`:bullet point of "PeerTube will\:": The plugin <strong>must be configured</strong> after the pre-configuration wizard confirmation.`

    if (this.authType === 'ldap') {
      this.addExplanation(
        $localize`:bullet point of "PeerTube will\:":Install the <strong>LDAP</strong> authentication plugin.` + configStr
      )

      this.plugins.push('peertube-plugin-auth-ldap')
    } else if (this.authType === 'saml') {
      this.addExplanation(
        $localize`:bullet point of "PeerTube will\:":Install the <strong>SAML 2.0</strong> authentication plugin.` + configStr
      )

      this.plugins.push('peertube-plugin-auth-saml2')
    } else if (this.authType === 'oidc') {
      this.addExplanation(
        $localize`:bullet point of "PeerTube will\:":Install the <strong>OpenID Connect</strong> authentication plugin.` + configStr
      )

      this.plugins.push('peertube-plugin-auth-openid-connect')
    }
  }

  private addConfig (newConfig: PartialDeep<CustomConfig>) {
    return this.config = merge(this.config, newConfig)
  }

  private addExplanation (explanation: string) {
    this.unsafeExplanations.push(explanation)
  }
}
