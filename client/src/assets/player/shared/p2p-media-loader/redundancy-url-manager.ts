import { logger } from '@root-helpers/logger'

class RedundancyUrlManager {

  constructor (private baseUrls: string[] = []) {
    // empty
  }

  removeBySegmentUrl (segmentUrl: string) {
    const baseUrl = getBaseUrl(segmentUrl)
    const oldLength = baseUrl.length

    this.baseUrls = this.baseUrls.filter(u => u !== baseUrl && u !== baseUrl + '/')

    if (oldLength !== this.baseUrls.length) {
      logger.info(`Removed redundancy of segment URL ${segmentUrl}.`)
    }
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
