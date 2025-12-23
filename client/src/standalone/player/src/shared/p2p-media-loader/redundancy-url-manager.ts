import { logger } from '@root-helpers/logger'

class RedundancyUrlManager {
  private map = new Map<string, string>()

  constructor (private baseUrls: string[] = []) {
    // empty
  }

  onSegmentError (segmentUrl: string) {
    if (!this.map.has(segmentUrl)) return

    const customSegmentUrl = this.map.get(segmentUrl)
    this.map.delete(segmentUrl)

    const baseUrl = getBaseUrl(customSegmentUrl)
    const oldLength = baseUrl.length

    this.baseUrls = this.baseUrls.filter(u => u !== baseUrl && u !== baseUrl + '/')

    if (oldLength !== this.baseUrls.length) {
      logger.info(`Removed redundancy of segment URL ${customSegmentUrl}.`)
    }
  }

  onSegmentSuccess (segmentUrl: string) {
    this.map.delete(segmentUrl)
  }

  buildUrl (url: string) {
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
