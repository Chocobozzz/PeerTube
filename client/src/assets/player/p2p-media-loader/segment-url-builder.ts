import { basename } from 'path'
import { Segment } from 'p2p-media-loader-core'

function segmentUrlBuilderFactory (baseUrls: string[]) {
  return function segmentBuilder (segment: Segment) {
    const max = baseUrls.length + 1
    const i = getRandomInt(max)

    if (i === max - 1) return segment.url

    let newBaseUrl = baseUrls[i]
    let middlePart = newBaseUrl.endsWith('/') ? '' : '/'

    return newBaseUrl + middlePart + basename(segment.url)
  }
}

// ---------------------------------------------------------------------------

export {
  segmentUrlBuilderFactory
}

// ---------------------------------------------------------------------------

function getRandomInt (max: number) {
  return Math.floor(Math.random() * Math.floor(max))
}
