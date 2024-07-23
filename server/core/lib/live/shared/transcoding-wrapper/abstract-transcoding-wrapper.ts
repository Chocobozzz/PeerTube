import { LiveVideoErrorType } from '@peertube/peertube-models'
import { LoggerTagsFn } from '@server/helpers/logger.js'
import { MStreamingPlaylistVideo, MVideoLiveVideo } from '@server/types/models/index.js'
import EventEmitter from 'events'
import { FfprobeData } from 'fluent-ffmpeg'

interface TranscodingWrapperEvents {
  'end': () => void

  'error': (options: { err: Error }) => void
}

declare interface AbstractTranscodingWrapper {
  on<U extends keyof TranscodingWrapperEvents>(
    event: U, listener: TranscodingWrapperEvents[U]
  ): this

  emit<U extends keyof TranscodingWrapperEvents>(
    event: U, ...args: Parameters<TranscodingWrapperEvents[U]>
  ): boolean
}

interface AbstractTranscodingWrapperOptions {
  streamingPlaylist: MStreamingPlaylistVideo
  videoLive: MVideoLiveVideo

  lTags: LoggerTagsFn

  sessionId: string
  inputLocalUrl: string
  inputPublicUrl: string

  toTranscode: {
    resolution: number
    fps: number
  }[]

  bitrate: number
  ratio: number

  hasAudio: boolean
  hasVideo: boolean
  probe: FfprobeData

  segmentListSize: number
  segmentDuration: number

  outDirectory: string
}

abstract class AbstractTranscodingWrapper extends EventEmitter {
  protected readonly videoLive: MVideoLiveVideo

  protected readonly toTranscode: {
    resolution: number
    fps: number
  }[]

  protected readonly sessionId: string
  protected readonly inputLocalUrl: string
  protected readonly inputPublicUrl: string

  protected readonly bitrate: number
  protected readonly ratio: number
  protected readonly hasAudio: boolean
  protected readonly hasVideo: boolean
  protected readonly probe: FfprobeData

  protected readonly segmentListSize: number
  protected readonly segmentDuration: number

  protected readonly videoUUID: string

  protected readonly outDirectory: string

  protected readonly lTags: LoggerTagsFn

  protected readonly streamingPlaylist: MStreamingPlaylistVideo

  constructor (options: AbstractTranscodingWrapperOptions) {
    super()

    this.lTags = options.lTags

    this.videoLive = options.videoLive
    this.videoUUID = options.videoLive.Video.uuid
    this.streamingPlaylist = options.streamingPlaylist

    this.sessionId = options.sessionId
    this.inputLocalUrl = options.inputLocalUrl
    this.inputPublicUrl = options.inputPublicUrl

    this.toTranscode = options.toTranscode

    this.bitrate = options.bitrate
    this.ratio = options.ratio
    this.hasAudio = options.hasAudio
    this.hasVideo = options.hasVideo
    this.probe = options.probe

    this.segmentListSize = options.segmentListSize
    this.segmentDuration = options.segmentDuration

    this.outDirectory = options.outDirectory
  }

  abstract run (): Promise<void>

  abstract abort (error?: LiveVideoErrorType): void
}

export {
  type AbstractTranscodingWrapperOptions,

  AbstractTranscodingWrapper
}
