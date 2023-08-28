import { isArray } from './misc.js'
import { VideoChapter, VideoChapterUpdate } from '@peertube/peertube-models'
import { Unpacked } from '@peertube/peertube-typescript-utils'
import { CONSTRAINTS_FIELDS } from '@server/initializers/constants.js'
import validator from 'validator'

export function areVideoChaptersValid (value: VideoChapter[]) {
  if (!isArray(value)) return false
  if (!value.every(v => isVideoChapterValid(v))) return false

  const timecodes = value.map(c => c.timecode)

  return new Set(timecodes).size === timecodes.length
}

export function isVideoChapterValid (value: Unpacked<VideoChapterUpdate['chapters']>) {
  return isVideoChapterTimecodeValid(value.timecode) && isVideoChapterTitleValid(value.title)
}

export function isVideoChapterTitleValid (value: any) {
  return validator.default.isLength(value + '', CONSTRAINTS_FIELDS.VIDEO_CHAPTERS.TITLE)
}

export function isVideoChapterTimecodeValid (value: any) {
  return validator.default.isInt(value + '', { min: 0 })
}
