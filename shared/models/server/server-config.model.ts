import { NSFWPolicyType } from '../videos/nsfw-policy.type'
import { concurrency } from 'sharp';

export interface ServerConfig {
  serverVersion: string
  serverCommit?: string

  instance: {
    name: string
    shortDescription: string
    defaultClientRoute: string
    defaultNSFWPolicy: NSFWPolicyType
    customizations: {
      javascript: string
      css: string
    }
  }

  signup: {
    allowed: boolean
    allowedForCurrentIP: boolean
    requiresEmailVerification: boolean
  }

  transcoding: {
    enabledResolutions: number[]
    concurrency: number
    niceness: number
    ttl: number
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

  avatar: {
    file: {
      size: {
        max: number
      },
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
}
