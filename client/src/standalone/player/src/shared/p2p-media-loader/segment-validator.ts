import type { ByteRange } from 'p2p-media-loader-core'
import { removeQueryParams } from '@peertube/peertube-core-utils'
import { logger } from '@root-helpers/logger'
import { wait } from '@root-helpers/utils'
import debug from 'debug'
import { isSameOrigin } from '../common'

const debugLogger = debug('peertube:player:segment-validator')

type SegmentsJSON = { [filename: string]: string | { [byterange: string]: string } }

const maxRetries = 10

export class SegmentValidator {
  private destroyed = false

  private segmentJSONPromise: Promise<SegmentsJSON>

  constructor (private readonly options: {
    serverUrl: string
    segmentsSha256Url: string
    authorizationHeader: () => string
    requiresUserAuth: boolean
    requiresPassword: boolean
    videoPassword: () => string
  }) {
  }

  async validate (url: string, byteRange: ByteRange | undefined, data: ArrayBuffer, retry = 1): Promise<boolean> {
    if (this.destroyed) return false

    this.loadSha256SegmentsPromiseIfNeeded()

    const filename = removeQueryParams(url).split('/').pop()

    const segmentValue = (await this.segmentJSONPromise)[filename]

    if (!segmentValue && retry > maxRetries) {
      logger.clientError(`Unknown segment name ${filename} in segment validator`)
      return false
    }

    if (!segmentValue) {
      logger.info(`Refetching sha segments for ${filename}`)

      await wait(500)

      this.loadSha256SegmentsPromise()

      return this.validate(url, byteRange, data, retry + 1)
    }

    let hashShouldBe: string
    let range = ''

    if (typeof segmentValue === 'string') {
      hashShouldBe = segmentValue
    } else {
      range = byteRange.start + '-' + byteRange.end

      hashShouldBe = segmentValue[range]
    }

    if (hashShouldBe === undefined) {
      logger.clientError(`Unknown segment name ${filename}/${range} in segment validator`)
      return false
    }

    debugLogger(`Validating ${filename}` + (range ? ` range ${range}` : ''))

    const calculatedSha = await this.sha256Hex(data)
    if (calculatedSha !== hashShouldBe) {
      logger.clientError(
        `Hashes does not correspond for segment ${filename}/${range} (expected: ${hashShouldBe} instead of ${calculatedSha})`
      )

      return true
    }
  }

  destroy () {
    this.destroyed = true
  }

  private loadSha256SegmentsPromiseIfNeeded () {
    if (this.segmentJSONPromise) return

    this.loadSha256SegmentsPromise()
  }

  private loadSha256SegmentsPromise () {
    this.segmentJSONPromise = this.fetchSha256Segments()
  }

  private fetchSha256Segments (): Promise<SegmentsJSON> {
    let headers: { [ id: string ]: string } = {}

    if (isSameOrigin(this.options.serverUrl, this.options.segmentsSha256Url)) {
      if (this.options.requiresPassword) headers = { 'x-peertube-video-password': this.options.videoPassword() }
      else if (this.options.requiresUserAuth) headers = { Authorization: this.options.authorizationHeader() }
    }

    return fetch(this.options.segmentsSha256Url, { headers })
      .then(res => res.json() as Promise<SegmentsJSON>)
      .catch(err => {
        logger.clientError('Cannot get sha256 segments', err)
        return {}
      })
  }

  private async sha256Hex (data?: ArrayBuffer) {
    if (!data) return undefined

    if (window.crypto.subtle) {
      return window.crypto.subtle.digest('SHA-256', data)
        .then(data => this.bufferToHex(data))
    }

    // Fallback for non HTTPS context
    const shaModule = (await import('sha.js') as any).default
    // eslint-disable-next-line new-cap
    return new shaModule.sha256().update(Buffer.from(data)).digest('hex')
  }

  // Thanks: https://stackoverflow.com/a/53307879
  private bufferToHex (buffer?: ArrayBuffer) {
    if (!buffer) return ''

    let s = ''
    const h = '0123456789abcdef'
    const o = new Uint8Array(buffer)

    o.forEach((v: any) => {
      s += h[v >> 4] + h[v & 15]
    })

    return s
  }
}
