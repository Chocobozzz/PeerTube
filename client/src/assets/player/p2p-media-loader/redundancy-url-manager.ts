import { basename, dirname } from 'path'

class RedundancyUrlManager {

  // Remember by what new URL we replaced an origin URL
  private replacedSegmentUrls: { [originUrl: string]: string } = {}

  constructor (private baseUrls: string[] = []) {
    // empty
  }

  removeBySegmentUrl (segmentUrl: string) {
    console.log('Removing redundancy of segment URL %s.', segmentUrl)

    const baseUrl = dirname(segmentUrl)

    this.baseUrls = this.baseUrls.filter(u => u !== baseUrl && u !== baseUrl + '/')
  }

  removeByOriginUrl (originUrl: string) {
    const replaced = this.replacedSegmentUrls[originUrl]
    if (!replaced) return

    return this.removeBySegmentUrl(replaced)
  }

  buildUrl (url: string) {
    delete this.replacedSegmentUrls[url]

    const max = this.baseUrls.length + 1
    const i = this.getRandomInt(max)

    if (i === max - 1) return url

    const newBaseUrl = this.baseUrls[i]
    const slashPart = newBaseUrl.endsWith('/') ? '' : '/'

    const newUrl = newBaseUrl + slashPart + basename(url)
    this.replacedSegmentUrls[url] = newUrl

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
