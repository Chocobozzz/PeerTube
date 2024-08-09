import { Segment } from '@peertube/p2p-media-loader-core'
import { logger } from '@root-helpers/logger'
import { wait } from '@root-helpers/utils'
import { removeQueryParams } from '@peertube/peertube-core-utils'
import { isSameOrigin } from '../common'
import debug from 'debug'

const debugLogger = debug('peertube:player:segment-validator')

type SegmentsJSON = { [filename: string]: string | { [byterange: string]: string } }

const maxRetries = 10

export class SegmentValidator {

  private readonly bytesRangeRegex = /bytes=(\d+)-(\d+)/

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

  async validate (segment: Segment, _method: string, _peerId: string, retry = 1) {
    if (this.destroyed) return

    this.loadSha256SegmentsPromiseIfNeeded()

    const filename = removeQueryParams(segment.url).split('/').pop()

    const segmentValue = (await this.segmentJSONPromise)[filename]

    if (!segmentValue && retry > maxRetries) {
      throw new Error(`Unknown segment name ${filename} in segment validator`)
    }

    if (!segmentValue) {
      logger.info(`Refetching sha segments for ${filename}`)

      await wait(500)

      this.loadSha256SegmentsPromise()

      await this.validate(segment, _method, _peerId, retry + 1)

      return
    }

    let hashShouldBe: string
    let range = ''

    if (typeof segmentValue === 'string') {
      hashShouldBe = segmentValue
    } else {
      const captured = this.bytesRangeRegex.exec(segment.range)
      range = captured[1] + '-' + captured[2]

      hashShouldBe = segmentValue[range]
    }

    if (hashShouldBe === undefined) {
      throw new Error(`Unknown segment name ${filename}/${range} in segment validator`)
    }

    debugLogger(`Validating ${filename}` + (segment.range ? ` range ${segment.range}` : ''))

    const calculatedSha = await this.sha256Hex(segment.data)
    if (calculatedSha !== hashShouldBe) {
      throw new Error(
        `Hashes does not correspond for segment ${filename}/${range}` +
        `(expected: ${hashShouldBe} instead of ${calculatedSha})`
      )
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
        logger.error('Cannot get sha256 segments', err)
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
