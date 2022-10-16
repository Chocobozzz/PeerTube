import { YoutubeDLCLIResult } from './youtube-dl-cli'

class YoutubeDLBaseBuilder {
  normalizeObject (obj: any): any {
    const newObj: any = {}

    for (const key of Object.keys(obj)) {
      // Deprecated key
      if (key === 'resolution') continue

      const value = obj[key]

      if (typeof value === 'string') {
        newObj[key] = value.normalize()
      } else {
        newObj[key] = value
      }
    }

    return newObj
  }

  parseDate (date: string): Date {
    let originallyPublishedAt: Date = null

    const uploadDateMatcher = /^(\d{4})(\d{2})(\d{2})$/.exec(date)
    if (uploadDateMatcher) {
      originallyPublishedAt = new Date()
      originallyPublishedAt.setHours(0, 0, 0, 0)

      const year = parseInt(uploadDateMatcher[1], 10)
      // Month starts from 0
      const month = parseInt(uploadDateMatcher[2], 10) - 1
      const day = parseInt(uploadDateMatcher[3], 10)

      originallyPublishedAt.setFullYear(year, month, day)
    }

    return originallyPublishedAt
  }

  epochToDate (timestamp: number): Date {
    const d = new Date(0)
    d.setUTCSeconds(timestamp)
    return d
  }

  buildOriginallyPublishedAt (obj: Partial<YoutubeDLCLIResult>): Date {
    // timestamp property is not always set on all sites
    if (obj.timestamp !== undefined &&
      obj.timestamp !== null &&
      obj.timestamp > 0) {
      return this.epochToDate(obj.timestamp)
    }

    // neither is upload_date supported on all sites
    if (obj.upload_date !== undefined &&
      obj.timestamp !== null &&
      obj.upload_date.length > 0) {
      return this.parseDate(obj.upload_date)
    }

    // skip the override during channel sync if no date available
    return null
  }
}

// ---------------------------------------------------------------------------

export {
  YoutubeDLBaseBuilder
}
