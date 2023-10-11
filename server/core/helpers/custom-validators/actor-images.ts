import { UploadFilesForCheck } from 'express'
import { CONSTRAINTS_FIELDS } from '../../initializers/constants.js'
import { isFileValid } from './misc.js'

const imageMimeTypes = CONSTRAINTS_FIELDS.ACTORS.IMAGE.EXTNAME
  .map(v => v.replace('.', ''))
  .join('|')
const imageMimeTypesRegex = `image/(${imageMimeTypes})`

function isActorImageFile (files: UploadFilesForCheck, fieldname: string) {
  return isFileValid({
    files,
    mimeTypeRegex: imageMimeTypesRegex,
    field: fieldname,
    maxSize: CONSTRAINTS_FIELDS.ACTORS.IMAGE.FILE_SIZE.max
  })
}

// ---------------------------------------------------------------------------

export {
  isActorImageFile
}
