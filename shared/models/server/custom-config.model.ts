import { NSFWPolicyType } from '../videos/nsfw-policy.type'
import { BroadcastMessageLevel } from './broadcast-message-level.type'

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
    defaultClientRoute: string
    defaultNSFWPolicy: NSFWPolicyType
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
  }

  signup: {
    enabled: boolean
    limit: number
    requiresEmailVerification: boolean
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
    resolutions: {
      '0p': boolean
      '240p': boolean
      '360p': boolean
      '480p': boolean
      '720p': boolean
      '1080p': boolean
      '2160p': boolean
    }

    webtorrent: {
      enabled: boolean
    }

    hls: {
      enabled: boolean
    }
  }

  import: {
    videos: {
      http: {
        enabled: boolean
      }
      torrent: {
        enabled: boolean
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
