import { NSFWPolicyType } from '../videos/nsfw-policy.type'

export interface ServerConfig {
  serverVersion: string
  serverCommit?: string

  instance: {
    name: string
    shortDescription: string
    defaultClientRoute: string
    isNSFW: boolean
    defaultNSFWPolicy: NSFWPolicyType
    customizations: {
      javascript: string
      css: string
    }
  }

  email: {
    enabled: boolean
  }

  contactForm: {
    enabled: boolean
  }

  signup: {
    allowed: boolean,
    allowedForCurrentIP: boolean
    requiresEmailVerification: boolean
  }

  transcoding: {
    hls: {
      enabled: boolean
    }

    enabledResolutions: number[]
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

  avatar: {
    file: {
      size: {
        max: number
      }
      extensions: string[]
    }
  }

  video: {
    image: {
      size: {
        max: number
      }
      extensions: string[]
    },
    file: {
      extensions: string[]
    }
  }

  videoCaption: {
    file: {
      size: {
        max: number
      },
      extensions: string[]
    }
  }

  user: {
    videoQuota: number
    videoQuotaDaily: number
  }

  trending: {
    videos: {
      intervalDays: number
    }
  }
}
