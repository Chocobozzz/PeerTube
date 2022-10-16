import { move, pathExists, readdir, remove } from 'fs-extra'
import { dirname, join } from 'path'
import { inspect } from 'util'
import { CONFIG } from '@server/initializers/config'
import { isVideoFileExtnameValid } from '../custom-validators/videos'
import { logger, loggerTagsFactory } from '../logger'
import { generateVideoImportTmpPath } from '../utils'
import { YoutubeDLCLI } from './youtube-dl-cli'
import { YoutubeDLInfo, YoutubeDLInfoBuilder } from './youtube-dl-info-builder'
import { YoutubeDLListBuilder } from './youtube-dl-list-builder'
import { YoutubeDLLiveStatus } from './youtube-dl-live-status.enum'
import { YoutubeDLError } from './youtube-dl-error'
import { YoutubeDLSubs } from './youtube-dl-subs'

const lTags = loggerTagsFactory('youtube-dl')

const processOptions = {
  maxBuffer: 1024 * 1024 * 30 // 30MB
}

class YoutubeDLWrapper {

  constructor (
    private readonly url: string,
    private readonly enabledResolutions: number[],
    private readonly useBestFormat: boolean
  ) {

  }

  async getInfoForDownload (youtubeDLArgs: string[] = []): Promise<YoutubeDLInfo> {
    const youtubeDL = await YoutubeDLCLI.safeGet()

    const info = await youtubeDL.getInfo({
      url: this.url,
      format: YoutubeDLCLI.getYoutubeDLVideoFormat(this.enabledResolutions, this.useBestFormat),
      additionalYoutubeDLArgs: youtubeDLArgs,
      processOptions
    })

    if (!info) throw new Error(`YoutubeDL could not get info from ${this.url}`)

    const builder = new YoutubeDLInfoBuilder(info)
    const serializedInfo = builder.getInfo()

    try {
      this.checkAvailability(serializedInfo)
      this.checkFormats(serializedInfo)
    } catch (err) {
      throw YoutubeDLError.fromError(
        err, YoutubeDLError.STATUS.VIDEO_AVAILABILITY_ERROR, this.url
      )
    }

    return serializedInfo
  }

  async getInfoForListImport (options: {
    latestVideosCount?: number
  }): Promise<Partial<YoutubeDLInfo>[]> {
    const youtubeDL = await YoutubeDLCLI.safeGet()

    const list = await youtubeDL.getListInfo({
      url: this.url,
      latestVideosCount: options.latestVideosCount,
      processOptions
    })

    if (!Array.isArray(list)) throw new Error(`YoutubeDL could not get list info from ${this.url}: ${inspect(list)}`)

    const builder = new YoutubeDLListBuilder(list)
    const serializedList = builder.getList()

    return serializedList
  }

  async getSubtitles (): Promise<YoutubeDLSubs> {
    const cwd = CONFIG.STORAGE.TMP_DIR

    const youtubeDL = await YoutubeDLCLI.safeGet()

    const files = await youtubeDL.getSubs({ url: this.url, format: 'vtt', processOptions: { cwd } })
    if (!files) return []

    logger.debug('Get subtitles from youtube dl.', { url: this.url, files, ...lTags() })

    const subtitles = files.reduce((acc, filename) => {
      const matched = filename.match(/\.([a-z]{2})(-[a-z]+)?\.(vtt|ttml)/i)
      if (!matched || !matched[1]) return acc

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

      return this.guessVideoPathWithExtension(pathWithoutExtension, fileExt)
    } catch (err) {
      this.guessVideoPathWithExtension(pathWithoutExtension, fileExt)
        .then(path => {
          logger.debug('Error in youtube-dl import, deleting file %s.', path, { err, ...lTags() })

          return remove(path)
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

    const directoryContent = await readdir(dirname(tmpPath))

    throw new Error(`Cannot guess path of ${tmpPath}. Directory content: ${directoryContent.join(', ')}`)
  }

  private checkFormats (info: YoutubeDLInfo) {
    if (info.formats.length > 0) {
      return
    }

    throw new YoutubeDLError({ status: YoutubeDLError.STATUS.NO_FORMATS_AVAILABLE, url: info.webpageUrl })
  }

  private checkAvailability (info: YoutubeDLInfo | Partial<YoutubeDLInfo>) {
    switch (info.liveStatus) {
      case YoutubeDLLiveStatus.LIVE:
        throw new YoutubeDLError({ status: YoutubeDLError.STATUS.IS_LIVE, url: info.webpageUrl })
      case YoutubeDLLiveStatus.POST_PROCESSING:
        throw new YoutubeDLError({ status: YoutubeDLError.STATUS.NOT_POST_PROCESSED, url: info.webpageUrl })
      case YoutubeDLLiveStatus.TO_BE_PUBLISHED:
        throw new YoutubeDLError({ status: YoutubeDLError.STATUS.TO_BE_PUBLISHED, url: info.webpageUrl })
    }
  }
}

// ---------------------------------------------------------------------------

export {
  YoutubeDLWrapper
}
