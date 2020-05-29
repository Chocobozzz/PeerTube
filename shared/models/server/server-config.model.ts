import { ClientScript } from '../plugins/plugin-package-json.model'
import { NSFWPolicyType } from '../videos/nsfw-policy.type'
import { BroadcastMessageLevel } from './broadcast-message-level.type'

export interface ServerConfigPlugin {
  name: string
  version: string
  description: string
  clientScripts: { [name: string]: ClientScript }
}

export interface ServerConfigTheme extends ServerConfigPlugin {
  css: string[]
}

export interface RegisteredExternalAuthConfig {
  npmName: string
  name: string
  version: string
  authName: string
  authDisplayName: string
}

export interface RegisteredIdAndPassAuthConfig {
  npmName: string
  name: string
  version: string
  authName: string
  weight: number
}

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

  plugin: {
    registered: ServerConfigPlugin[]

    registeredExternalAuths: RegisteredExternalAuthConfig[]

    registeredIdAndPassAuths: RegisteredIdAndPassAuthConfig[]
  }

  theme: {
    registered: ServerConfigTheme[]
    default: string
  }

  email: {
    enabled: boolean
  }

  contactForm: {
    enabled: boolean
  }

  signup: {
    allowed: boolean
    allowedForCurrentIP: boolean
    requiresEmailVerification: boolean
  }

  transcoding: {
    hls: {
      enabled: boolean
    }

    webtorrent: {
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
    }
    file: {
      extensions: string[]
    }
  }

  videoCaption: {
    file: {
      size: {
        max: number
      }
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

  tracker: {
    enabled: boolean
  }

  followings: {
    instance: {
      autoFollowIndex: {
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
}
