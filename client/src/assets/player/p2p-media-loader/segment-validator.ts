import { wait } from '@root-helpers/utils'
import { Segment } from 'p2p-media-loader-core'
import { basename } from 'path'

type SegmentsJSON = { [filename: string]: string | { [byterange: string]: string } }

const maxRetries = 3

function segmentValidatorFactory (segmentsSha256Url: string, isLive: boolean) {
  let segmentsJSON = fetchSha256Segments(segmentsSha256Url)
  const regex = /bytes=(\d+)-(\d+)/

  return async function segmentValidator (segment: Segment, _method: string, _peerId: string, retry = 1) {
    // Wait for hash generation from the server
    if (isLive) await wait(1000)

    const filename = basename(segment.url)

    const segmentValue = (await segmentsJSON)[filename]

    if (!segmentValue && retry > maxRetries) {
      throw new Error(`Unknown segment name ${filename} in segment validator`)
    }

    if (!segmentValue) {
      console.log('Refetching sha segments for %s.', filename)

      await wait(1000)

      segmentsJSON = fetchSha256Segments(segmentsSha256Url)
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

function fetchSha256Segments (url: string) {
  return fetch(url)
    .then(res => res.json() as Promise<SegmentsJSON>)
    .catch(err => {
      console.error('Cannot get sha256 segments', err)
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
  const shaModule = await import('sha.js')
  return new shaModule.sha256().update(Buffer.from(data)).digest('hex')
}

// Thanks: https://stackoverflow.com/a/53307879
function bufferToHex (buffer?: ArrayBuffer) {
  if (!buffer) return ''

  let s = ''
  const h = '0123456789abcdef'
  const o = new Uint8Array(buffer)

  o.forEach((v: any) => s += h[ v >> 4 ] + h[ v & 15 ])

  return s
}
