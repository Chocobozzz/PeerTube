import { truncate } from 'lodash'
import { CONSTRAINTS_FIELDS, VIDEO_CATEGORIES } from '../initializers'
import { logger } from './logger'
import { generateVideoTmpPath } from './utils'
import { YoutubeDlUpdateScheduler } from '../lib/schedulers/youtube-dl-update-scheduler'

export type YoutubeDLInfo = {
  name?: string
  description?: string
  category?: number
  licence?: number
  nsfw?: boolean
  tags?: string[]
  thumbnailUrl?: string
}

function getYoutubeDLInfo (url: string): Promise<YoutubeDLInfo> {
  return new Promise<YoutubeDLInfo>(async (res, rej) => {
    const options = [ '-j', '--flat-playlist' ]

    const youtubeDL = await safeGetYoutubeDL()
    youtubeDL.getInfo(url, options, (err, info) => {
      if (err) return rej(err)

      const obj = normalizeObject(info)

      return res(buildVideoInfo(obj))
    })
  })
}

function downloadYoutubeDLVideo (url: string) {
  const path = generateVideoTmpPath(url)

  logger.info('Importing youtubeDL video %s', url)

  const options = [ '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best', '-o', path ]

  return new Promise<string>(async (res, rej) => {
    const youtubeDL = await safeGetYoutubeDL()
    youtubeDL.exec(url, options, async (err, output) => {
      if (err) return rej(err)

      return res(path)
    })
  })
}

// ---------------------------------------------------------------------------

export {
  downloadYoutubeDLVideo,
  getYoutubeDLInfo
}

// ---------------------------------------------------------------------------

async function safeGetYoutubeDL () {
  let youtubeDL

  try {
    youtubeDL = require('youtube-dl')
  } catch (e) {
    // Download binary
    await YoutubeDlUpdateScheduler.Instance.execute()
    youtubeDL = require('youtube-dl')
  }

  return youtubeDL
}

function normalizeObject (obj: any) {
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

function buildVideoInfo (obj: any) {
  return {
    name: titleTruncation(obj.title),
    description: descriptionTruncation(obj.description),
    category: getCategory(obj.categories),
    licence: getLicence(obj.license),
    nsfw: isNSFW(obj),
    tags: getTags(obj.tags),
    thumbnailUrl: obj.thumbnail || undefined
  }
}

function titleTruncation (title: string) {
  return truncate(title, {
    'length': CONSTRAINTS_FIELDS.VIDEOS.NAME.max,
    'separator': /,? +/,
    'omission': ' […]'
  })
}

function descriptionTruncation (description: string) {
  if (!description || description.length < CONSTRAINTS_FIELDS.VIDEOS.DESCRIPTION.min) return undefined

  return truncate(description, {
    'length': CONSTRAINTS_FIELDS.VIDEOS.DESCRIPTION.max,
    'separator': /,? +/,
    'omission': ' […]'
  })
}

function isNSFW (info: any) {
  return info.age_limit && info.age_limit >= 16
}

function getTags (tags: any) {
  if (Array.isArray(tags) === false) return []

  return tags
    .filter(t => t.length < CONSTRAINTS_FIELDS.VIDEOS.TAG.max && t.length > CONSTRAINTS_FIELDS.VIDEOS.TAG.min)
    .map(t => t.normalize())
    .slice(0, 5)
}

function getLicence (licence: string) {
  if (!licence) return undefined

  if (licence.indexOf('Creative Commons Attribution') !== -1) return 1

  return undefined
}

function getCategory (categories: string[]) {
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
