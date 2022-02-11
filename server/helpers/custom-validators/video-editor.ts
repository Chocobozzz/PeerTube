import validator from 'validator'
import { CONSTRAINTS_FIELDS } from '@server/initializers/constants'
import { buildTaskFileFieldname } from '@server/lib/video-editor'
import { VideoEditorTask } from '@shared/models'
import { isArray } from './misc'
import { isVideoFileMimeTypeValid, isVideoImageValid } from './videos'

function isValidEditorTasksArray (tasks: any) {
  if (!isArray(tasks)) return false

  return tasks.length >= CONSTRAINTS_FIELDS.VIDEO_EDITOR.TASKS.min &&
    tasks.length <= CONSTRAINTS_FIELDS.VIDEO_EDITOR.TASKS.max
}

function isEditorCutTaskValid (task: VideoEditorTask) {
  if (task.name !== 'cut') return false
  if (!task.options) return false

  const { start, end } = task.options
  if (!start && !end) return false

  if (start && !validator.isInt(start + '', CONSTRAINTS_FIELDS.VIDEO_EDITOR.CUT_TIME)) return false
  if (end && !validator.isInt(end + '', CONSTRAINTS_FIELDS.VIDEO_EDITOR.CUT_TIME)) return false

  if (!start || !end) return true

  return parseInt(start + '') < parseInt(end + '')
}

function isEditorTaskAddIntroOutroValid (task: VideoEditorTask, indice: number, files: Express.Multer.File[]) {
  const file = files.find(f => f.fieldname === buildTaskFileFieldname(indice, 'file'))

  return (task.name === 'add-intro' || task.name === 'add-outro') &&
    file && isVideoFileMimeTypeValid([ file ], null)
}

function isEditorTaskAddWatermarkValid (task: VideoEditorTask, indice: number, files: Express.Multer.File[]) {
  const file = files.find(f => f.fieldname === buildTaskFileFieldname(indice, 'file'))

  return task.name === 'add-watermark' &&
    file && isVideoImageValid([ file ], null, true)
}

// ---------------------------------------------------------------------------

export {
  isValidEditorTasksArray,

  isEditorCutTaskValid,
  isEditorTaskAddIntroOutroValid,
  isEditorTaskAddWatermarkValid
}
