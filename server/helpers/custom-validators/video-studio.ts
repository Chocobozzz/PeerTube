import validator from 'validator'
import { CONSTRAINTS_FIELDS } from '@server/initializers/constants'
import { buildTaskFileFieldname } from '@server/lib/video-studio'
import { VideoStudioTask } from '@shared/models'
import { isArray } from './misc'
import { isVideoFileMimeTypeValid, isVideoImageValid } from './videos'
import { forceNumber } from '@shared/core-utils'

function isValidStudioTasksArray (tasks: any) {
  if (!isArray(tasks)) return false

  return tasks.length >= CONSTRAINTS_FIELDS.VIDEO_STUDIO.TASKS.min &&
    tasks.length <= CONSTRAINTS_FIELDS.VIDEO_STUDIO.TASKS.max
}

function isStudioCutTaskValid (task: VideoStudioTask) {
  if (task.name !== 'cut') return false
  if (!task.options) return false

  const { start, end } = task.options
  if (!start && !end) return false

  if (start && !validator.isInt(start + '', CONSTRAINTS_FIELDS.VIDEO_STUDIO.CUT_TIME)) return false
  if (end && !validator.isInt(end + '', CONSTRAINTS_FIELDS.VIDEO_STUDIO.CUT_TIME)) return false

  if (!start || !end) return true

  return forceNumber(start) < forceNumber(end)
}

function isStudioTaskAddIntroOutroValid (task: VideoStudioTask, indice: number, files: Express.Multer.File[]) {
  const file = files.find(f => f.fieldname === buildTaskFileFieldname(indice, 'file'))

  return (task.name === 'add-intro' || task.name === 'add-outro') &&
    file && isVideoFileMimeTypeValid([ file ], null)
}

function isStudioTaskAddWatermarkValid (task: VideoStudioTask, indice: number, files: Express.Multer.File[]) {
  const file = files.find(f => f.fieldname === buildTaskFileFieldname(indice, 'file'))

  return task.name === 'add-watermark' &&
    file && isVideoImageValid([ file ], null, true)
}

// ---------------------------------------------------------------------------

export {
  isValidStudioTasksArray,

  isStudioCutTaskValid,
  isStudioTaskAddIntroOutroValid,
  isStudioTaskAddWatermarkValid
}
