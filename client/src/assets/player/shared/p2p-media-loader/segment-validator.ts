import { basename } from 'path'
import { Segment } from 'p2p-media-loader-core-basyton'
import { logger } from '@root-helpers/logger'
import { wait } from '@root-helpers/utils'

type SegmentsJSON = { [filename: string]: string | { [byterange: string]: string } }

const maxRetries = 3

function findbyqualityname(segments : any, name : string){

  var result = undefined

  name = name.substring(36)



  for (var key in segments) {
    if (segments.hasOwnProperty(key) && key.indexOf(name) > -1) {
      result = segments[key]
    }
  }


  return result
}

function segmentValidatorFactory (segmentsSha256Url: string, isLive: boolean) {
  let segmentsJSON = fetchSha256Segments(segmentsSha256Url)
  const regex = /bytes=(\d+)-(\d+)/

  return async function segmentValidator (segment: Segment, _method: string, _peerId: string, retry = 1) {
    // Wait for hash generation from the server
    if (isLive) await wait(1000)

    const filename = basename(segment.url)

    const segments = (await segmentsJSON)

    const segmentValue = segments[filename] || findbyqualityname(segments, filename)



    if (!segmentValue && retry > maxRetries) {
      throw new Error(`Unknown segment name ${filename} in segment validator`)
    }

    if (!segmentValue) {
      logger.info(`Refetching sha segments for ${filename}`)

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


    console.log('segment.data', segment.url, range, segment.data)

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
  return new shaModule.sha256().update(data).digest('hex')
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
