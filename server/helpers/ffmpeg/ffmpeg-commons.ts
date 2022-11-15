import { Job } from 'bullmq'
import ffmpeg, { FfmpegCommand } from 'fluent-ffmpeg'
import { execPromise } from '@server/helpers/core-utils'
import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { CONFIG } from '@server/initializers/config'
import { FFMPEG_NICE } from '@server/initializers/constants'
import { EncoderOptions } from '@shared/models'

const lTags = loggerTagsFactory('ffmpeg')

type StreamType = 'audio' | 'video'

function getFFmpeg (input: string, type: 'live' | 'vod') {
  // We set cwd explicitly because ffmpeg appears to create temporary files when trancoding which fails in read-only file systems
  const command = ffmpeg(input, {
    niceness: type === 'live' ? FFMPEG_NICE.LIVE : FFMPEG_NICE.VOD,
    cwd: CONFIG.STORAGE.TMP_DIR
  })

  const threads = type === 'live'
    ? CONFIG.LIVE.TRANSCODING.THREADS
    : CONFIG.TRANSCODING.THREADS

  if (threads > 0) {
    // If we don't set any threads ffmpeg will chose automatically
    command.outputOption('-threads ' + threads)
  }

  return command
}

function getFFmpegVersion () {
  return new Promise<string>((res, rej) => {
    (ffmpeg() as any)._getFfmpegPath((err, ffmpegPath) => {
      if (err) return rej(err)
      if (!ffmpegPath) return rej(new Error('Could not find ffmpeg path'))

      return execPromise(`${ffmpegPath} -version`)
        .then(stdout => {
          const parsed = stdout.match(/ffmpeg version .?(\d+\.\d+(\.\d+)?)/)
          if (!parsed?.[1]) return rej(new Error(`Could not find ffmpeg version in ${stdout}`))

          // Fix ffmpeg version that does not include patch version (4.4 for example)
          let version = parsed[1]
          if (version.match(/^\d+\.\d+$/)) {
            version += '.0'
          }

          return res(version)
        })
        .catch(err => rej(err))
    })
  })
}

async function runCommand (options: {
  command: FfmpegCommand
  silent?: boolean // false by default
  job?: Job
}) {
  const { command, silent = false, job } = options

  return new Promise<void>((res, rej) => {
    let shellCommand: string

    command.on('start', cmdline => { shellCommand = cmdline })

    command.on('error', (err, stdout, stderr) => {
      if (silent !== true) logger.error('Error in ffmpeg.', { stdout, stderr, shellCommand, ...lTags() })

      rej(err)
    })

    command.on('end', (stdout, stderr) => {
      logger.debug('FFmpeg command ended.', { stdout, stderr, shellCommand, ...lTags() })

      res()
    })

    if (job) {
      command.on('progress', progress => {
        if (!progress.percent) return

        job.updateProgress(Math.round(progress.percent))
          .catch(err => logger.warn('Cannot set ffmpeg job progress.', { err, ...lTags() }))
      })
    }

    command.run()
  })
}

function buildStreamSuffix (base: string, streamNum?: number) {
  if (streamNum !== undefined) {
    return `${base}:${streamNum}`
  }

  return base
}

function getScaleFilter (options: EncoderOptions): string {
  if (options.scaleFilter) return options.scaleFilter.name

  return 'scale'
}

export {
  getFFmpeg,
  getFFmpegVersion,
  runCommand,
  StreamType,
  buildStreamSuffix,
  getScaleFilter
}
