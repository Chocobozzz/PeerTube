import { PlayerTheme } from '../player/player-theme.type.js'
import { VideoCommentPolicyType, VideoPrivacyType } from '../videos/index.js'
import { NSFWPolicyType } from '../videos/nsfw-policy.type.js'
import { BroadcastMessageLevel } from './broadcast-message-level.type.js'

export type ConfigResolutions = {
  '0p': boolean
  '144p': boolean
  '240p': boolean
  '360p': boolean
  '480p': boolean
  '720p': boolean
  '1080p': boolean
  '1440p': boolean
  '2160p': boolean
}

export interface CustomConfig {
  instance: {
    name: string
    shortDescription: string
    description: string
    terms: string
    codeOfConduct: string

    creationReason: string
    moderationInformation: string
    administrator: string
    maintenanceLifetime: string
    businessModel: string
    hardwareInformation: string

    defaultLanguage: string

    languages: string[]
    categories: number[]

    isNSFW: boolean
    defaultNSFWPolicy: NSFWPolicyType

    serverCountry: string

    support: {
      text: string
    }

    social: {
      externalLink: string
      mastodonLink: string
      blueskyLink: string
      xLink: string
    }

    defaultClientRoute: string

    customizations: {
      javascript?: string
      css?: string
    }
  }

  theme: {
    default: string

    customization: {
      primaryColor: string
      foregroundColor: string
      backgroundColor: string
      backgroundSecondaryColor: string
      menuForegroundColor: string
      menuBackgroundColor: string
      menuBorderRadius: string
      headerForegroundColor: string
      headerBackgroundColor: string
      inputBorderRadius: string
    }
  }

  services: {
    twitter: {
      username: string
    }
  }

  client: {
    header: {
      hideInstanceName: boolean
    }

    videos: {
      miniature: {
        preferAuthorDisplayName: boolean
      }
    }

    browseVideos: {
      defaultSort: string
      defaultScope: string
    }

    menu: {
      login: {
        redirectOnSingleExternalAuth: boolean
      }
    }
  }

  cache: {
    previews: {
      size: number
    }

    captions: {
      size: number
    }

    torrents: {
      size: number
    }

    storyboards: {
      size: number
    }
  }

  signup: {
    enabled: boolean
    limit: number
    requiresApproval: boolean
    requiresEmailVerification: boolean
    minimumAge: number
  }

  admin: {
    email: string
  }

  email: {
    body: {
      signature: string
    }

    subject: {
      prefix: string
    }
  }

  contactForm: {
    enabled: boolean
  }

  user: {
    history: {
      videos: {
        enabled: boolean
      }
    }
    videoQuota: number
    videoQuotaDaily: number
    defaultChannelName: string
  }

  videoChannels: {
    maxPerUser: number
  }

  transcoding: {
    enabled: boolean

    originalFile: {
      keep: boolean
    }

    allowAdditionalExtensions: boolean
    allowAudioFiles: boolean

    remoteRunners: {
      enabled: boolean
    }

    threads: number
    concurrency: number

    profile: string

    resolutions: ConfigResolutions

    alwaysTranscodeOriginalResolution: boolean

    fps: {
      max: number
    }

    webVideos: {
      enabled: boolean
    }

    hls: {
      enabled: boolean
      splitAudioAndVideo: boolean
    }

    audioLoudnorm?: {
      enabled: boolean
    }
  }

  live: {
    enabled: boolean

    allowReplay: boolean

    latencySetting: {
      enabled: boolean
    }

    maxDuration: number
    maxInstanceLives: number
    maxUserLives: number

    transcoding: {
      enabled: boolean
      remoteRunners: {
        enabled: boolean
      }
      threads: number
      profile: string

      resolutions: ConfigResolutions
      alwaysTranscodeOriginalResolution: boolean

      fps: {
        max: number
      }

      audioLoudnorm?: {
        enabled: boolean
      }
    }
  }

  videoStudio: {
    enabled: boolean

    remoteRunners: {
      enabled: boolean
    }
  }

  videoTranscription: {
    enabled: boolean

    remoteRunners: {
      enabled: boolean
    }
  }

  videoFile: {
    update: {
      enabled: boolean
    }
  }

  import: {
    videos: {
      concurrency: number

      http: {
        enabled: boolean
      }
      torrent: {
        enabled: boolean
      }
    }

    videoChannelSynchronization: {
      enabled: boolean
      maxPerUser: number
    }

    users: {
      enabled: boolean
    }
  }

  export: {
    users: {
      enabled: boolean
      maxUserVideoQuota: number
      exportExpiration: number
    }
  }

  trending: {
    videos: {
      algorithms: {
        enabled: string[]
        default: string
      }
    }
  }

  autoBlacklist: {
    videos: {
      ofUsers: {
        enabled: boolean
      }
    }
  }

  followers: {
    instance: {
      enabled: boolean
      manualApproval: boolean
    }

    channels: {
      enabled: boolean
    }
  }

  followings: {
    instance: {
      autoFollowBack: {
        enabled: boolean
      }

      autoFollowIndex: {
        enabled: boolean
        indexUrl: string
      }
    }
  }

  broadcastMessage: {
    enabled: boolean
    message: string
    level: BroadcastMessageLevel
    dismissable: boolean
  }

  search: {
    remoteUri: {
      users: boolean
      anonymous: boolean
    }

    searchIndex: {
      enabled: boolean
      url: string
      disableLocalSearch: boolean
      isDefaultSearch: boolean
    }
  }

  storyboards: {
    enabled: boolean
    remoteRunners: {
      enabled: boolean
    }
  }

  defaults: {
    publish: {
      downloadEnabled: boolean
      commentsPolicy: VideoCommentPolicyType
      privacy: VideoPrivacyType
      licence: number
    }

    p2p: {
      webapp: {
        enabled: boolean
      }

      embed: {
        enabled: boolean
      }
    }

    player: {
      theme: PlayerTheme
      autoPlay: boolean
    }
  }

  videoComments: {
    acceptRemoteComments: boolean
  }
}
