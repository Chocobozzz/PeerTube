import { CONSTRAINTS_FIELDS, VIDEO_CATEGORIES, VIDEO_LANGUAGES, VIDEO_LICENCES } from '../../initializers/constants'
import { peertubeTruncate } from '../core-utils'

type YoutubeDLInfo = {
  name?: string
  description?: string
  category?: number
  language?: string
  licence?: number
  nsfw?: boolean
  tags?: string[]
  thumbnailUrl?: string
  ext?: string
  originallyPublishedAt?: Date
}

class YoutubeDLInfoBuilder {
  private readonly info: any

  constructor (info: any) {
    this.info = { ...info }
  }

  getInfo () {
    const obj = this.buildVideoInfo(this.normalizeObject(this.info))
    if (obj.name && obj.name.length < CONSTRAINTS_FIELDS.VIDEOS.NAME.min) obj.name += ' video'

    return obj
  }

  private normalizeObject (obj: any) {
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

  private buildOriginallyPublishedAt (obj: any) {
    let originallyPublishedAt: Date = null

    const uploadDateMatcher = /^(\d{4})(\d{2})(\d{2})$/.exec(obj.upload_date)
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

  private buildVideoInfo (obj: any): YoutubeDLInfo {
    return {
      name: this.titleTruncation(obj.title),
      description: this.descriptionTruncation(obj.description),
      category: this.getCategory(obj.categories),
      licence: this.getLicence(obj.license),
      language: this.getLanguage(obj.language),
      nsfw: this.isNSFW(obj),
      tags: this.getTags(obj.tags),
      thumbnailUrl: obj.thumbnail || undefined,
      originallyPublishedAt: this.buildOriginallyPublishedAt(obj),
      ext: obj.ext
    }
  }

  private titleTruncation (title: string) {
    return peertubeTruncate(title, {
      length: CONSTRAINTS_FIELDS.VIDEOS.NAME.max,
      separator: /,? +/,
      omission: ' […]'
    })
  }

  private descriptionTruncation (description: string) {
    if (!description || description.length < CONSTRAINTS_FIELDS.VIDEOS.DESCRIPTION.min) return undefined

    return peertubeTruncate(description, {
      length: CONSTRAINTS_FIELDS.VIDEOS.DESCRIPTION.max,
      separator: /,? +/,
      omission: ' […]'
    })
  }

  private isNSFW (info: any) {
    return info?.age_limit >= 16
  }

  private getTags (tags: string[]) {
    if (Array.isArray(tags) === false) return []

    return tags
      .filter(t => t.length < CONSTRAINTS_FIELDS.VIDEOS.TAG.max && t.length > CONSTRAINTS_FIELDS.VIDEOS.TAG.min)
      .map(t => t.normalize())
      .slice(0, 5)
  }

  private getLicence (licence: string) {
    if (!licence) return undefined

    if (licence.includes('Creative Commons Attribution')) return 1

    for (const key of Object.keys(VIDEO_LICENCES)) {
      const peertubeLicence = VIDEO_LICENCES[key]
      if (peertubeLicence.toLowerCase() === licence.toLowerCase()) return parseInt(key, 10)
    }

    return undefined
  }

  private getCategory (categories: string[]) {
    if (!categories) return undefined

    const categoryString = categories[0]
    if (!categoryString || typeof categoryString !== 'string') return undefined

    if (categoryString === 'News & Politics') return 11

    for (const key of Object.keys(VIDEO_CATEGORIES)) {
      const category = VIDEO_CATEGORIES[key]
      if (categoryString.toLowerCase() === category.toLowerCase()) return parseInt(key, 10)
    }

    return undefined
  }

  private getLanguage (language: string) {
    return VIDEO_LANGUAGES[language] ? language : undefined
  }
}

// ---------------------------------------------------------------------------

export {
  YoutubeDLInfo,
  YoutubeDLInfoBuilder
}
