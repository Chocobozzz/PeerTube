import EventEmitter from 'events'
import { LoggerTagsFn } from '@server/helpers/logger'
import { MStreamingPlaylistVideo, MVideoLiveVideo } from '@server/types/models'
import { LiveVideoError } from '@shared/models'

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

  inputLocalUrl: string
  inputPublicUrl: string

  fps: number
  toTranscode: {
    resolution: number
    fps: number
  }[]

  bitrate: number
  ratio: number
  hasAudio: boolean

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

  protected readonly inputLocalUrl: string
  protected readonly inputPublicUrl: string

  protected readonly fps: number
  protected readonly bitrate: number
  protected readonly ratio: number
  protected readonly hasAudio: boolean

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

    this.inputLocalUrl = options.inputLocalUrl
    this.inputPublicUrl = options.inputPublicUrl

    this.fps = options.fps
    this.toTranscode = options.toTranscode

    this.bitrate = options.bitrate
    this.ratio = options.ratio
    this.hasAudio = options.hasAudio

    this.segmentListSize = options.segmentListSize
    this.segmentDuration = options.segmentDuration

    this.outDirectory = options.outDirectory
  }

  abstract run (): Promise<void>

  abstract abort (error?: LiveVideoError): void
}

export {
  AbstractTranscodingWrapper,
  AbstractTranscodingWrapperOptions
}
