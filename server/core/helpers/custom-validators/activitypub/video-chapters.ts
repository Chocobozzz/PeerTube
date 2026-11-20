import { VideoChaptersObject } from '@peertube/peertube-models'
import { CONSTRAINTS_FIELDS } from '@server/initializers/constants.js'
import { isArray } from '../misc.js'
import { isVideoChapterTimecodeValid, isVideoChapterTitleValid } from '../video-chapters.js'
import { isActivityPubUrlValid } from './misc.js'

export function sanitizeAndCheckVideoChaptersObject (object: VideoChaptersObject) {
  if (!object) return false
  if (!isActivityPubUrlValid(object.id)) return false

  if (!isArray(object.hasPart)) return false

  object.hasPart = object.hasPart.slice(0, CONSTRAINTS_FIELDS.VIDEO_CHAPTERS.CHAPTERS.max)

  return object.hasPart.every(part => {
    return isVideoChapterTitleValid(part.name) && isVideoChapterTimecodeValid(part.startOffset)
  })
}
