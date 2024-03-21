import { logger } from '@server/helpers/logger.js'
import { FFmpegCommandWrapper, getDefaultAvailableEncoders } from '@peertube/peertube-ffmpeg'
import { AvailableEncoders, EncoderOptionsBuilder } from '@peertube/peertube-models'

// ---------------------------------------------------------------------------
// Profile manager to get and change default profiles
// ---------------------------------------------------------------------------

class VideoTranscodingProfilesManager {
  private static instance: VideoTranscodingProfilesManager

  // 1 === less priority
  private readonly encodersPriorities = {
    vod: this.buildDefaultEncodersPriorities(),
    live: this.buildDefaultEncodersPriorities()
  }

  private readonly availableEncoders = getDefaultAvailableEncoders()

  private availableProfiles = {
    vod: [] as string[],
    live: [] as string[]
  }

  private constructor () {
    this.buildAvailableProfiles()
  }

  getAvailableEncoders (): AvailableEncoders {
    return {
      available: this.availableEncoders,
      encodersToTry: {
        vod: {
          video: this.getEncodersByPriority('vod', 'video'),
          audio: this.getEncodersByPriority('vod', 'audio')
        },
        live: {
          video: this.getEncodersByPriority('live', 'video'),
          audio: this.getEncodersByPriority('live', 'audio')
        }
      }
    }
  }

  getAvailableProfiles (type: 'vod' | 'live') {
    return this.availableProfiles[type]
  }

  addProfile (options: {
    type: 'vod' | 'live'
    encoder: string
    profile: string
    builder: EncoderOptionsBuilder
  }) {
    const { type, encoder, profile, builder } = options

    const encoders = this.availableEncoders[type]

    if (!encoders[encoder]) encoders[encoder] = {}
    encoders[encoder][profile] = builder

    this.buildAvailableProfiles()
  }

  removeProfile (options: {
    type: 'vod' | 'live'
    encoder: string
    profile: string
  }) {
    const { type, encoder, profile } = options

    delete this.availableEncoders[type][encoder][profile]

    this.buildAvailableProfiles()
  }

  addEncoderPriority (type: 'vod' | 'live', streamType: 'audio' | 'video', encoder: string, priority: number) {
    this.encodersPriorities[type][streamType].push({ name: encoder, priority, isDefault: false })

    FFmpegCommandWrapper.resetSupportedEncoders()
  }

  removeEncoderPriority (type: 'vod' | 'live', streamType: 'audio' | 'video', encoder: string, priority: number) {
    this.encodersPriorities[type][streamType] = this.encodersPriorities[type][streamType]
      .filter(o => {
        // Don't remove default encoders
        if (o.isDefault) return true
        // Don't include this encoder anymore
        if (o.name === encoder && o.priority === priority) return false

        return true
      })

    FFmpegCommandWrapper.resetSupportedEncoders()
  }

  private getEncodersByPriority (type: 'vod' | 'live', streamType: 'audio' | 'video') {
    return this.encodersPriorities[type][streamType]
      .sort((e1, e2) => {
        if (e1.priority > e2.priority) return -1
        else if (e1.priority === e2.priority) return 0

        return 1
      })
      .map(e => e.name)
  }

  private buildAvailableProfiles () {
    for (const type of [ 'vod', 'live' ]) {
      const result = new Set()

      const encoders = this.availableEncoders[type]

      for (const encoderName of Object.keys(encoders)) {
        for (const profile of Object.keys(encoders[encoderName])) {
          result.add(profile)
        }
      }

      this.availableProfiles[type] = Array.from(result)
    }

    logger.debug('Available transcoding profiles built.', { availableProfiles: this.availableProfiles })
  }

  private buildDefaultEncodersPriorities () {
    return {
      video: [
        { name: 'libx264', priority: 100, isDefault: true }
      ],

      // Try the first one, if not available try the second one etc
      audio: [
        // we favor VBR, if a good AAC encoder is available
        { name: 'libfdk_aac', priority: 200, isDefault: true },
        { name: 'aac', priority: 100, isDefault: true }
      ]
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  VideoTranscodingProfilesManager
}
