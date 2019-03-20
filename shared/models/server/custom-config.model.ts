import { NSFWPolicyType } from '../videos/nsfw-policy.type'

export interface CustomConfig {
  instance: {
    name: string
    shortDescription: string
    description: string
    terms: string
    isNSFW: boolean
    defaultClientRoute: string
    defaultNSFWPolicy: NSFWPolicyType
    customizations: {
      javascript?: string
      css?: string
    }
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
    threads: number
    resolutions: {
      '240p': boolean
      '360p': boolean
      '480p': boolean
      '720p': boolean
      '1080p': boolean
    }
    hls: {
      enabled: boolean
    }
  }

  import: {
    videos: {
      http: {
        enabled: boolean
      },
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

}
