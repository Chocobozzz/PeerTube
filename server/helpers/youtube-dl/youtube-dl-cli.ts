import execa from 'execa'
import { ensureDir, pathExists, writeFile } from 'fs-extra'
import { dirname, join } from 'path'
import { CONFIG } from '@server/initializers/config'
import { VideoResolution } from '@shared/models'
import { logger, loggerTagsFactory } from '../logger'
import { getProxy, isProxyEnabled } from '../proxy'
import { isBinaryResponse, peertubeGot } from '../requests'

const lTags = loggerTagsFactory('youtube-dl')

const youtubeDLBinaryPath = join(CONFIG.STORAGE.BIN_DIR, CONFIG.IMPORT.VIDEOS.HTTP.YOUTUBE_DL_RELEASE.NAME)

export class YoutubeDLCLI {

  static async safeGet () {
    if (!await pathExists(youtubeDLBinaryPath)) {
      await ensureDir(dirname(youtubeDLBinaryPath))

      await this.updateYoutubeDLBinary()
    }

    return new YoutubeDLCLI()
  }

  static async updateYoutubeDLBinary () {
    const url = CONFIG.IMPORT.VIDEOS.HTTP.YOUTUBE_DL_RELEASE.URL

    logger.info('Updating youtubeDL binary from %s.', url, lTags())

    const gotOptions = { context: { bodyKBLimit: 20_000 }, responseType: 'buffer' as 'buffer' }

    try {
      let gotResult = await peertubeGot(url, gotOptions)

      if (!isBinaryResponse(gotResult)) {
        const json = JSON.parse(gotResult.body.toString())
        const latest = json.filter(release => release.prerelease === false)[0]
        if (!latest) throw new Error('Cannot find latest release')

        const releaseName = CONFIG.IMPORT.VIDEOS.HTTP.YOUTUBE_DL_RELEASE.NAME
        const releaseAsset = latest.assets.find(a => a.name === releaseName)
        if (!releaseAsset) throw new Error(`Cannot find appropriate release with name ${releaseName} in release assets`)

        gotResult = await peertubeGot(releaseAsset.browser_download_url, gotOptions)
      }

      if (!isBinaryResponse(gotResult)) {
        throw new Error('Not a binary response')
      }

      await writeFile(youtubeDLBinaryPath, gotResult.body)

      logger.info('youtube-dl updated %s.', youtubeDLBinaryPath, lTags())
    } catch (err) {
      logger.error('Cannot update youtube-dl from %s.', url, { err, ...lTags() })
    }
  }

  static getYoutubeDLVideoFormat (enabledResolutions: VideoResolution[], useBestFormat: boolean) {
    /**
     * list of format selectors in order or preference
     * see https://github.com/ytdl-org/youtube-dl#format-selection
     *
     * case #1 asks for a mp4 using h264 (avc1) and the exact resolution in the hope
     * of being able to do a "quick-transcode"
     * case #2 is the first fallback. No "quick-transcode" means we can get anything else (like vp9)
     * case #3 is the resolution-degraded equivalent of #1, and already a pretty safe fallback
     *
     * in any case we avoid AV1, see https://github.com/Chocobozzz/PeerTube/issues/3499
     **/

    let result: string[] = []

    if (!useBestFormat) {
      const resolution = enabledResolutions.length === 0
        ? VideoResolution.H_720P
        : Math.max(...enabledResolutions)

      result = [
        `bestvideo[vcodec^=avc1][height=${resolution}]+bestaudio[ext=m4a]`, // case #1
        `bestvideo[vcodec!*=av01][vcodec!*=vp9.2][height=${resolution}]+bestaudio`, // case #2
        `bestvideo[vcodec^=avc1][height<=${resolution}]+bestaudio[ext=m4a]` // case #
      ]
    }

    return result.concat([
      'bestvideo[vcodec!*=av01][vcodec!*=vp9.2]+bestaudio',
      'best[vcodec!*=av01][vcodec!*=vp9.2]', // case fallback for known formats
      'best' // Ultimate fallback
    ]).join('/')
  }

  private constructor () {

  }

  download (options: {
    url: string
    format: string
    output: string
    processOptions: execa.NodeOptions
    timeout?: number
    additionalYoutubeDLArgs?: string[]
  }) {
    return this.run({
      url: options.url,
      processOptions: options.processOptions,
      timeout: options.timeout,
      args: (options.additionalYoutubeDLArgs || []).concat([ '-f', options.format, '-o', options.output ])
    })
  }

  async getInfo (options: {
    url: string
    format: string
    processOptions: execa.NodeOptions
    additionalYoutubeDLArgs?: string[]
  }) {
    const { url, format, additionalYoutubeDLArgs = [], processOptions } = options

    const completeArgs = additionalYoutubeDLArgs.concat([ '--dump-json', '-f', format ])

    const data = await this.run({ url, args: completeArgs, processOptions })
    const info = data.map(this.parseInfo)

    return info.length === 1
      ? info[0]
      : info
  }

  async getSubs (options: {
    url: string
    format: 'vtt'
    processOptions: execa.NodeOptions
  }) {
    const { url, format, processOptions } = options

    const args = [ '--skip-download', '--all-subs', `--sub-format=${format}` ]

    const data = await this.run({ url, args, processOptions })
    const files: string[] = []

    const skipString = '[info] Writing video subtitles to: '

    for (let i = 0, len = data.length; i < len; i++) {
      const line = data[i]

      if (line.indexOf(skipString) === 0) {
        files.push(line.slice(skipString.length))
      }
    }

    return files
  }

  private async run (options: {
    url: string
    args: string[]
    timeout?: number
    processOptions: execa.NodeOptions
  }) {
    const { url, args, timeout, processOptions } = options

    let completeArgs = this.wrapWithProxyOptions(args)
    completeArgs = this.wrapWithIPOptions(completeArgs)
    completeArgs = this.wrapWithFFmpegOptions(completeArgs)

    const { PYTHON_PATH } = CONFIG.IMPORT.VIDEOS.HTTP.YOUTUBE_DL_RELEASE
    const subProcess = execa(PYTHON_PATH, [ youtubeDLBinaryPath, ...completeArgs, url ], processOptions)

    if (timeout) {
      setTimeout(() => subProcess.cancel(), timeout)
    }

    const output = await subProcess

    logger.debug('Runned youtube-dl command.', { command: output.command, ...lTags() })

    return output.stdout
      ? output.stdout.trim().split(/\r?\n/)
      : undefined
  }

  private wrapWithProxyOptions (args: string[]) {
    if (isProxyEnabled()) {
      logger.debug('Using proxy %s for YoutubeDL', getProxy(), lTags())

      return [ '--proxy', getProxy() ].concat(args)
    }

    return args
  }

  private wrapWithIPOptions (args: string[]) {
    if (CONFIG.IMPORT.VIDEOS.HTTP.FORCE_IPV4) {
      logger.debug('Force ipv4 for YoutubeDL')

      return [ '--force-ipv4' ].concat(args)
    }

    return args
  }

  private wrapWithFFmpegOptions (args: string[]) {
    if (process.env.FFMPEG_PATH) {
      logger.debug('Using ffmpeg location %s for YoutubeDL', process.env.FFMPEG_PATH, lTags())

      return [ '--ffmpeg-location', process.env.FFMPEG_PATH ].concat(args)
    }

    return args
  }

  private parseInfo (data: string) {
    return JSON.parse(data)
  }
}
