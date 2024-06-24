import { logger } from '@root-helpers/logger'

class RedundancyUrlManager {

  constructor (private baseUrls: string[] = []) {
    // empty
  }

  removeBySegmentUrl (segmentUrl: string) {
    logger.info(`Removing redundancy of segment URL ${segmentUrl}.`)

    const baseUrl = getBaseUrl(segmentUrl)

    this.baseUrls = this.baseUrls.filter(u => u !== baseUrl && u !== baseUrl + '/')
  }

  buildUrl (url: string) {
    const max = this.baseUrls.length + 1
    const i = this.getRandomInt(max)

    if (i === max - 1) return url

    const newBaseUrl = this.baseUrls[i]
    const slashPart = newBaseUrl.endsWith('/') ? '' : '/'

    return newBaseUrl + slashPart + getFilename(url)
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
