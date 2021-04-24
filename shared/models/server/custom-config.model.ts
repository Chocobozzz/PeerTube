import { NSFWPolicyType } from '../videos/nsfw-policy.type'
import { BroadcastMessageLevel } from './broadcast-message-level.type'

export type ConfigResolutions = {
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

    languages: string[]
    categories: number[]

    isNSFW: boolean
    defaultNSFWPolicy: NSFWPolicyType

    defaultClientRoute: string

    customizations: {
      javascript?: string
      css?: string
    }
  }

  theme: {
    default: string
  }

  services: {
    twitter: {
      username: string
      whitelisted: boolean
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
  }

  signup: {
    enabled: boolean
    limit: number
    requiresEmailVerification: boolean
    minimumAge: number
  }

  admin: {
    email: string
  }

  contactForm: {
    enabled: boolean
  }

  user: {
    videoQuota: number
    videoQuotaDaily: number
  }

  transcoding: {
    enabled: boolean

    allowAdditionalExtensions: boolean
    allowAudioFiles: boolean

    threads: number
    concurrency: number

    profile: string

    resolutions: ConfigResolutions & { '0p': boolean }

    webtorrent: {
      enabled: boolean
    }

    hls: {
      enabled: boolean
    }
  }

  live: {
    enabled: boolean

    allowReplay: boolean

    maxDuration: number
    maxInstanceLives: number
    maxUserLives: number

    transcoding: {
      enabled: boolean
      threads: number
      profile: string
      resolutions: ConfigResolutions
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
}
