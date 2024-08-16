import { arrayify, pick, promisify0 } from '@peertube/peertube-core-utils'
import {
  AvailableEncoders,
  EncoderOptionsBuilder,
  EncoderOptionsBuilderParams,
  EncoderProfile,
  SimpleLogger
} from '@peertube/peertube-models'
import { MutexInterface } from 'async-mutex'
import ffmpeg, { FfmpegCommand } from 'fluent-ffmpeg'
import { Readable } from 'node:stream'

export interface FFmpegCommandWrapperOptions {
  availableEncoders?: AvailableEncoders
  profile?: string

  niceness: number
  tmpDirectory: string
  threads: number

  logger: SimpleLogger
  lTags?: { tags: string[] }

  updateJobProgress?: (progress?: number) => void
  onEnd?: () => void
  onError?: (err: Error) => void
}

export class FFmpegCommandWrapper {
  private static supportedEncoders: Map<string, boolean>

  private readonly availableEncoders: AvailableEncoders
  private readonly profile: string

  private readonly niceness: number
  private readonly tmpDirectory: string
  private readonly threads: number

  private readonly logger: SimpleLogger
  private readonly lTags: { tags: string[] }

  private readonly updateJobProgress: (progress?: number) => void
  private readonly onEnd?: () => void
  private readonly onError?: (err: Error) => void

  private command: FfmpegCommand

  constructor (options: FFmpegCommandWrapperOptions) {
    this.availableEncoders = options.availableEncoders
    this.profile = options.profile
    this.niceness = options.niceness
    this.tmpDirectory = options.tmpDirectory
    this.threads = options.threads
    this.logger = options.logger
    this.lTags = options.lTags || { tags: [] }

    this.updateJobProgress = options.updateJobProgress

    this.onEnd = options.onEnd
    this.onError = options.onError
  }

  getAvailableEncoders () {
    return this.availableEncoders
  }

  getProfile () {
    return this.profile
  }

  getCommand () {
    return this.command
  }

  // ---------------------------------------------------------------------------

  debugLog (msg: string, meta: any = {}) {
    this.logger.debug(msg, { ...meta, ...this.lTags })
  }

  // ---------------------------------------------------------------------------

  resetCommand () {
    this.command = undefined
  }

  buildCommand (inputs: (string | Readable)[] | string | Readable, inputFileMutexReleaser?: MutexInterface.Releaser) {
    if (this.command) throw new Error('Command is already built')

    // We set cwd explicitly because ffmpeg appears to create temporary files when trancoding which fails in read-only file systems
    this.command = ffmpeg({
      niceness: this.niceness,
      cwd: this.tmpDirectory
    })

    for (const input of arrayify(inputs)) {
      this.command.input(input)
    }

    if (this.threads > 0) {
      // If we don't set any threads ffmpeg will chose automatically
      this.command.outputOption('-threads ' + this.threads)
    }

    if (inputFileMutexReleaser) {
      this.command.on('start', () => {
        setTimeout(() => inputFileMutexReleaser(), 1000)
      })
    }

    return this.command
  }

  async runCommand (options: {
    silent?: boolean // false by default
  } = {}) {
    const { silent = false } = options

    return new Promise<void>((res, rej) => {
      let shellCommand: string

      this.command.on('start', cmdline => { shellCommand = cmdline })

      this.command.on('error', (err: Error & { stdout?: string, stderr?: string }, stdout, stderr) => {
        if (silent !== true) this.logger.error('Error in ffmpeg.', { err, stdout, stderr, shellCommand, ...this.lTags })

        err.stdout = stdout
        err.stderr = stderr

        if (this.onError) this.onError(err)

        rej(err)
      })

      this.command.on('end', (stdout, stderr) => {
        this.logger.debug('FFmpeg command ended.', { stdout, stderr, shellCommand, ...this.lTags })

        if (this.onEnd) this.onEnd()

        res()
      })

      if (this.updateJobProgress) {
        this.command.on('progress', progress => {
          if (!progress.percent) return

          // Sometimes ffmpeg returns an invalid progress
          let percent = Math.round(progress.percent)
          if (percent < 0) percent = 0
          if (percent > 100) percent = 100

          this.updateJobProgress(percent)
        })
      }

      this.command.run()
    })
  }

  // ---------------------------------------------------------------------------

  static resetSupportedEncoders () {
    FFmpegCommandWrapper.supportedEncoders = undefined
  }

  // Run encoder builder depending on available encoders
  // Try encoders by priority: if the encoder is available, run the chosen profile or fallback to the default one
  // If the default one does not exist, check the next encoder
  async getEncoderBuilderResult (options: EncoderOptionsBuilderParams & {
    streamType: 'video' | 'audio'
    input: string

    videoType: 'vod' | 'live'
  }) {
    if (!this.availableEncoders) {
      throw new Error('There is no available encoders')
    }

    const { streamType, videoType } = options

    const encodersToTry = this.availableEncoders.encodersToTry[videoType][streamType]
    const encoders = this.availableEncoders.available[videoType]

    for (const encoder of encodersToTry) {
      if (!(await this.checkFFmpegEncoders(this.availableEncoders)).get(encoder)) {
        this.logger.debug(`Encoder ${encoder} not available in ffmpeg, skipping.`, this.lTags)
        continue
      }

      if (!encoders[encoder]) {
        this.logger.debug(`Encoder ${encoder} not available in peertube encoders, skipping.`, this.lTags)
        continue
      }

      // An object containing available profiles for this encoder
      const builderProfiles: EncoderProfile<EncoderOptionsBuilder> = encoders[encoder]
      let builder = builderProfiles[this.profile]

      if (!builder) {
        this.logger.debug(`Profile ${this.profile} for encoder ${encoder} not available. Fallback to default.`, this.lTags)
        builder = builderProfiles.default

        if (!builder) {
          this.logger.debug(`Default profile for encoder ${encoder} not available. Try next available encoder.`, this.lTags)
          continue
        }
      }

      const result = await builder(
        pick(options, [
          'input',
          'canCopyAudio',
          'canCopyVideo',
          'resolution',
          'inputBitrate',
          'inputProbe',
          'fps',
          'inputRatio',
          'streamNum'
        ])
      )

      return {
        result,

        // If we don't have output options, then copy the input stream
        encoder: result.copy === true
          ? 'copy'
          : encoder
      }
    }

    return null
  }

  // Detect supported encoders by ffmpeg
  private async checkFFmpegEncoders (peertubeAvailableEncoders: AvailableEncoders): Promise<Map<string, boolean>> {
    if (FFmpegCommandWrapper.supportedEncoders !== undefined) {
      return FFmpegCommandWrapper.supportedEncoders
    }

    const getAvailableEncodersPromise = promisify0(ffmpeg.getAvailableEncoders)
    const availableFFmpegEncoders = await getAvailableEncodersPromise()

    const searchEncoders = new Set<string>()
    for (const type of [ 'live', 'vod' ]) {
      for (const streamType of [ 'audio', 'video' ]) {
        for (const encoder of peertubeAvailableEncoders.encodersToTry[type][streamType]) {
          searchEncoders.add(encoder)
        }
      }
    }

    const supportedEncoders = new Map<string, boolean>()

    for (const searchEncoder of searchEncoders) {
      supportedEncoders.set(searchEncoder, availableFFmpegEncoders[searchEncoder] !== undefined)
    }

    this.logger.info('Built supported ffmpeg encoders.', { supportedEncoders, searchEncoders, ...this.lTags })

    FFmpegCommandWrapper.supportedEncoders = supportedEncoders
    return supportedEncoders
  }
}
