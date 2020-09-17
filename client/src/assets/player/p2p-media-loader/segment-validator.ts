import { Segment } from 'p2p-media-loader-core'
import { basename } from 'path'

type SegmentsJSON = { [filename: string]: string | { [byterange: string]: string } }

function segmentValidatorFactory (segmentsSha256Url: string) {
  let segmentsJSON = fetchSha256Segments(segmentsSha256Url)
  const regex = /bytes=(\d+)-(\d+)/

  return async function segmentValidator (segment: Segment, canRefetchSegmentHashes = true) {
    const filename = basename(segment.url)

    const segmentValue = (await segmentsJSON)[filename]

    if (!segmentValue && !canRefetchSegmentHashes) {
      throw new Error(`Unknown segment name ${filename} in segment validator`)
    }

    if (!segmentValue) {
      console.log('Refetching sha segments.')

      // Refetch
      segmentsJSON = fetchSha256Segments(segmentsSha256Url)
      segmentValidator(segment, false)
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

    const calculatedSha = bufferToEx(await sha256(segment.data))
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

function sha256 (data?: ArrayBuffer) {
  if (!data) return undefined

  return window.crypto.subtle.digest('SHA-256', data)
}

// Thanks: https://stackoverflow.com/a/53307879
function bufferToEx (buffer?: ArrayBuffer) {
  if (!buffer) return ''

  let s = ''
  const h = '0123456789abcdef'
  const o = new Uint8Array(buffer)

  o.forEach((v: any) => s += h[ v >> 4 ] + h[ v & 15 ])

  return s
}
