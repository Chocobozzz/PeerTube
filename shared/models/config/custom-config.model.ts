export interface CustomConfig {
  instance: {
    name: string
    description: string
    terms: string
  }

  cache: {
    previews: {
      size: number
    }
  }

  signup: {
    enabled: boolean
    limit: number
  }

  admin: {
    email: string
  }

  user: {
    videoQuota: number
  }

  transcoding: {
    enabled: boolean
    threads: number
    resolutions: {
      '240p': boolean
      '360p': boolean
      '480p': boolean
      '720p': boolean
      '1080p': boolean
    }
  }
}
