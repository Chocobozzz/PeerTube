import { logger } from '@root-helpers/logger'

// Load the first segments from the origin, so a broken redundancy cannot delay the playback start
const ORIGIN_ONLY_SEGMENTS = 3

class RedundancyUrlManager {
  private map = new Map<string, string>()

  private loadedSegments = 0

  // Retry from the origin a segment that failed on a redundancy, instead of trying another (possibly broken) redundancy
  private originRetries = 0

  constructor (private baseUrls: string[] = []) {
    // empty
  }

  onSegmentError (segmentUrl: string) {
    if (!this.map.has(segmentUrl)) return

    const customSegmentUrl = this.map.get(segmentUrl)
    this.map.delete(segmentUrl)

    this.originRetries++

    const baseUrl = getBaseUrl(customSegmentUrl)
    const oldLength = this.baseUrls.length

    this.baseUrls = this.baseUrls.filter(u => u !== baseUrl && u !== baseUrl + '/')

    if (oldLength !== this.baseUrls.length) {
      logger.info(`Removed redundancy of segment URL ${customSegmentUrl}.`)
    }
  }

  onSegmentSuccess (segmentUrl: string) {
    this.map.delete(segmentUrl)

    this.loadedSegments++
  }

  // The segment may be requested again with another base URL, so forget the one we assigned to it
  onSegmentAbort (segmentUrl: string) {
    this.map.delete(segmentUrl)
  }

  buildUrl (url: string) {
    if (this.baseUrls.length === 0) return url
    if (this.loadedSegments < ORIGIN_ONLY_SEGMENTS) return url

    if (this.originRetries > 0) {
      this.originRetries--
      return url
    }

    const max = this.baseUrls.length + 1
    const i = this.getRandomInt(max)

    if (i === max - 1) return url

    const newBaseUrl = this.baseUrls[i]
    const slashPart = newBaseUrl.endsWith('/') ? '' : '/'

    const newUrl = newBaseUrl + slashPart + getFilename(url)

    this.map.set(url, newUrl)

    return newUrl
  }

  countBaseUrls () {
    return this.baseUrls.length
  }

  private getRandomInt (max: number) {
    return Math.floor(Math.random() * Math.floor(max))
  }
}

// ---------------------------------------------------------------------------

export {
  RedundancyUrlManager
}

// ---------------------------------------------------------------------------

function getFilename (url: string) {
  return url.split('/').pop()
}

function getBaseUrl (url: string) {
  const baseUrl = url.split('/')
  baseUrl.pop()

  return baseUrl.join('/')
}
