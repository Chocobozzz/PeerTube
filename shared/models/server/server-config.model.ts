import { NSFWPolicyType } from '../videos/nsfw-policy.type'

export interface ServerConfig {
  serverVersion: string

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
    allowed: boolean,
    allowedForCurrentIP: boolean
  }

  transcoding: {
    enabledResolutions: number[]
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

  user: {
    videoQuota: number
  }
}
