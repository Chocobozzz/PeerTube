import { VideoResolutionType } from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'
import { ExecaError } from 'execa'
import { move, pathExists, remove } from 'fs-extra/esm'
import { readdir } from 'fs/promises'
import { dirname, join } from 'path'
import { inspect } from 'util'
import { isVideoFileExtnameValid } from '../custom-validators/videos.js'
import { t } from '../i18n.js'
import { logger, loggerTagsFactory } from '../logger.js'
import { generateVideoImportTmpPath } from '../utils.js'
import { YoutubeDLCLI } from './youtube-dl-cli.js'
import { YoutubeDLInfo, YoutubeDLInfoBuilder } from './youtube-dl-info-builder.js'

const lTags = loggerTagsFactory('youtube-dl')

export const YoutubeDlImportErrorCode = {
  FETCH_ERROR: 0,
  NOT_ONLY_UNICAST_URL: 1,
  SKIP_PUBLICATION_DATE: 2,
  IS_LIVE: 3
}

export type YoutubeDlImportErrorCodeType = typeof YoutubeDlImportErrorCode[keyof typeof YoutubeDlImportErrorCode]

export class YoutubeDlImportError extends Error {
  static fromError (options: {
    err: Error
    code: YoutubeDlImportErrorCodeType
    message?: string
  }) {
    const { err, code, message } = options

    const ytDlErr = new this({ message: message ?? err.message, code })
    ytDlErr.cause = err

    return ytDlErr
  }

  code: YoutubeDlImportErrorCodeType

  constructor ({ message, code }) {
    super(message)

    this.code = code
  }

  isUnavailableVideoError () {
    const stderr = this.getStderr()

    if (stderr.includes('Video unavailable') || stderr.includes(' 429 ')) {
      return true
    }

    return false
  }

  isRateLimitError () {
    const stderr = this.getStderr()

    if (stderr.includes('Sign in to confirm you’re not a bot')) {
      return true
    }

    return false
  }

  private getStderr () {
    const stderr = (this.cause as ExecaError)?.stderr

    if (typeof stderr === 'string') return stderr

    return ''
  }
}

export type YoutubeDLSubs = {
  language: string
  filename: string
  path: string
}[]

const processOptions = {
  maxBuffer: 1024 * 1024 * 30 // 30MB
}

export class YoutubeDLWrapper {
  constructor (
    private readonly url: string,
    private readonly enabledResolutions: VideoResolutionType[],
    private readonly useBestFormat: boolean
  ) {
  }

  async getInfoForDownload (options: {
    userLanguage: string
    youtubeDLArgs?: string[]
  }): Promise<YoutubeDLInfo> {
    const { userLanguage, youtubeDLArgs = [] } = options

    const youtubeDL = await YoutubeDLCLI.safeGet()

    try {
      const info = await youtubeDL.getInfo({
        url: this.url,
        format: YoutubeDLCLI.getYoutubeDLVideoFormat(this.enabledResolutions, this.useBestFormat),
        additionalYoutubeDLArgs: youtubeDLArgs,
        processOptions
      })

      if (!info) {
        throw new YoutubeDlImportError({
          message: t(`Cannot fetch information from import for URL {targetUrl}`, userLanguage, { targetUrl: this.url }),
          code: YoutubeDlImportErrorCode.FETCH_ERROR
        })
      }

      if (info.is_live === true || [ 'is_live', 'post_live', 'is_upcoming' ].includes(info.live_status)) {
        throw new YoutubeDlImportError({
          message: t('Cannot download a live streaming for URL {targetUrl}', userLanguage, { targetUrl: this.url }),
          code: YoutubeDlImportErrorCode.IS_LIVE
        })
      }

      const infoBuilder = new YoutubeDLInfoBuilder(info)

      return infoBuilder.getInfo()
    } catch (err) {
      throw YoutubeDlImportError.fromError({
        err,
        message: t(`Cannot get info from {targetUrl}`, userLanguage, { targetUrl: this.url }),
        code: YoutubeDlImportErrorCode.FETCH_ERROR
      })
    }
  }

  async getInfoForListImport (options: {
    userLanguage: string
    latestVideosCount?: number
  }) {
    const { userLanguage } = options

    const youtubeDL = await YoutubeDLCLI.safeGet()

    const list = await youtubeDL.getListInfo({
      url: this.url,
      latestVideosCount: options.latestVideosCount,
      processOptions
    })

    if (!Array.isArray(list)) {
      logger.debug(`List info from youtube-dl is not an array for ${this.url}.`, { info: inspect(list), ...lTags() })

      throw new YoutubeDlImportError({
        message: t(`YoutubeDL could not get list info from ${this.url}: ${inspect(list)}`, userLanguage, { targetUrl: this.url }),
        code: YoutubeDlImportErrorCode.FETCH_ERROR
      })
    }

    return list.map(info => info.webpage_url)
  }

  async getSubtitles (): Promise<YoutubeDLSubs> {
    const cwd = CONFIG.STORAGE.TMP_DIR

    const youtubeDL = await YoutubeDLCLI.safeGet()

    const files = await youtubeDL.getSubs({ url: this.url, format: 'vtt', processOptions: { cwd } })
    if (!files) return []

    logger.debug('Get subtitles from youtube dl.', { url: this.url, files, ...lTags() })

    const subtitles = files.reduce((acc, filename) => {
      const matched = filename.match(/\.([a-z]{2})(-[a-z]+)?\.(vtt|ttml)/i)
      if (!matched?.[1]) return acc

      return [
        ...acc,
        {
          language: matched[1],
          path: join(cwd, filename),
          filename
        }
      ]
    }, [])

    return subtitles
  }

  async downloadVideo (fileExt: string, timeout: number): Promise<string> {
    // Leave empty the extension, youtube-dl will add it
    const pathWithoutExtension = generateVideoImportTmpPath(this.url, '')

    logger.info('Importing youtubeDL video %s to %s', this.url, pathWithoutExtension, lTags())

    const youtubeDL = await YoutubeDLCLI.safeGet()

    try {
      await youtubeDL.download({
        url: this.url,
        format: YoutubeDLCLI.getYoutubeDLVideoFormat(this.enabledResolutions, this.useBestFormat),
        output: pathWithoutExtension,
        timeout,
        processOptions
      })

      // If youtube-dl did not guess an extension for our file, just use .mp4 as default
      if (await pathExists(pathWithoutExtension)) {
        await move(pathWithoutExtension, pathWithoutExtension + '.mp4')
      }

      const path = await this.guessVideoPathWithExtension(pathWithoutExtension, fileExt)
      if (!path) {
        const directoryContent = await readdir(dirname(pathWithoutExtension))

        throw new Error(`Cannot guess path of ${pathWithoutExtension}. Directory content: ${directoryContent.join(', ')}`)
      }

      return path
    } catch (err) {
      this.guessVideoPathWithExtension(pathWithoutExtension, fileExt)
        .then(path => {
          logger.debug('Error in youtube-dl import, deleting file if exists.', { err, pathToDelete: path, ...lTags() })

          if (path) return remove(path)
        })
        .catch(innerErr => logger.error('Cannot remove file in youtubeDL error.', { innerErr, ...lTags() }))

      throw err
    }
  }

  private async guessVideoPathWithExtension (tmpPath: string, sourceExt: string) {
    if (!isVideoFileExtnameValid(sourceExt)) {
      throw new Error('Invalid video extension ' + sourceExt)
    }

    const extensions = [ sourceExt, '.mp4', '.mkv', '.webm' ]

    for (const extension of extensions) {
      const path = tmpPath + extension

      if (await pathExists(path)) return path
    }

    return undefined
  }
}
