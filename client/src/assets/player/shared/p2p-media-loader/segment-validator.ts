import { basename } from 'path'
import { Segment } from '@peertube/p2p-media-loader-core'
import { logger } from '@root-helpers/logger'
import { wait } from '@root-helpers/utils'
import { removeQueryParams } from '@shared/core-utils'
import { isSameOrigin } from '../common'

type SegmentsJSON = { [filename: string]: string | { [byterange: string]: string } }

const maxRetries = 10

function segmentValidatorFactory (options: {
  serverUrl: string
  segmentsSha256Url: string
  authorizationHeader: () => string
  requiresUserAuth: boolean
  requiresPassword: boolean
  videoPassword: () => string
}) {
  const { serverUrl, segmentsSha256Url, authorizationHeader, requiresUserAuth, requiresPassword, videoPassword } = options

  let segmentsJSON = fetchSha256Segments({
    serverUrl,
    segmentsSha256Url,
    authorizationHeader,
    requiresUserAuth,
    requiresPassword,
    videoPassword
  })
  const regex = /bytes=(\d+)-(\d+)/

  return async function segmentValidator (segment: Segment, _method: string, _peerId: string, retry = 1) {
    const filename = basename(removeQueryParams(segment.url))

    const segmentValue = (await segmentsJSON)[filename]

    if (!segmentValue && retry > maxRetries) {
      throw new Error(`Unknown segment name ${filename} in segment validator`)
    }

    if (!segmentValue) {
      logger.info(`Refetching sha segments for ${filename}`)

      await wait(500)

      segmentsJSON = fetchSha256Segments({
        serverUrl,
        segmentsSha256Url,
        authorizationHeader,
        requiresUserAuth,
        requiresPassword,
        videoPassword
      })
      await segmentValidator(segment, _method, _peerId, retry + 1)

      return
    }

    let hashShouldBe: string
    let range = ''

    if (typeof segmentValue === 'string') {
      hashShouldBe = segmentValue
    } else {
      const captured = regex.exec(segment.range)
      range = captured[1] + '-' + captured[2]

      hashShouldBe = segmentValue[range]
    }

    if (hashShouldBe === undefined) {
      throw new Error(`Unknown segment name ${filename}/${range} in segment validator`)
    }

    const calculatedSha = await sha256Hex(segment.data)
    if (calculatedSha !== hashShouldBe) {
      throw new Error(
        `Hashes does not correspond for segment ${filename}/${range}` +
        `(expected: ${hashShouldBe} instead of ${calculatedSha})`
      )
    }
  }
}

// ---------------------------------------------------------------------------

export {
  segmentValidatorFactory
}

// ---------------------------------------------------------------------------

function fetchSha256Segments (options: {
  serverUrl: string
  segmentsSha256Url: string
  authorizationHeader: () => string
  requiresUserAuth: boolean
  requiresPassword: boolean
  videoPassword: () => string
}): Promise<SegmentsJSON> {
  const { serverUrl, segmentsSha256Url, requiresUserAuth, authorizationHeader, requiresPassword, videoPassword } = options

  let headers: { [ id: string ]: string } = {}
  if (isSameOrigin(serverUrl, segmentsSha256Url)) {
    if (requiresPassword) headers = { 'x-peertube-video-password': videoPassword() }
    else if (requiresUserAuth) headers = { Authorization: authorizationHeader() }
  }

  return fetch(segmentsSha256Url, { headers })
    .then(res => res.json() as Promise<SegmentsJSON>)
    .catch(err => {
      logger.error('Cannot get sha256 segments', err)
      return {}
    })
}

async function sha256Hex (data?: ArrayBuffer) {
  if (!data) return undefined

  if (window.crypto.subtle) {
    return window.crypto.subtle.digest('SHA-256', data)
      .then(data => bufferToHex(data))
  }

  // Fallback for non HTTPS context
  const shaModule = (await import('sha.js') as any).default
  // eslint-disable-next-line new-cap
  return new shaModule.sha256().update(Buffer.from(data)).digest('hex')
}

// Thanks: https://stackoverflow.com/a/53307879
function bufferToHex (buffer?: ArrayBuffer) {
  if (!buffer) return ''

  let s = ''
  const h = '0123456789abcdef'
  const o = new Uint8Array(buffer)

  o.forEach((v: any) => {
    s += h[v >> 4] + h[v & 15]
  })

  return s
}
