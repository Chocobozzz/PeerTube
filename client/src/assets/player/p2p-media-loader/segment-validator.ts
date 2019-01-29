import { Segment } from 'p2p-media-loader-core'
import { basename } from 'path'

function segmentValidatorFactory (segmentsSha256Url: string) {
  const segmentsJSON = fetchSha256Segments(segmentsSha256Url)

  return async function segmentValidator (segment: Segment) {
    const segmentName = basename(segment.url)

    const hashShouldBe = (await segmentsJSON)[segmentName]
    if (hashShouldBe === undefined) {
      throw new Error(`Unknown segment name ${segmentName} in segment validator`)
    }

    const calculatedSha = bufferToEx(await sha256(segment.data))
    if (calculatedSha !== hashShouldBe) {
      throw new Error(`Hashes does not correspond for segment ${segmentName} (expected: ${hashShouldBe} instead of ${calculatedSha})`)
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
    .then(res => res.json())
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
