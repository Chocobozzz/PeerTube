
import { CONSTRAINTS_FIELDS } from '../../initializers/constants'
import { checkFileValid } from './misc'

const imageMimeTypes = CONSTRAINTS_FIELDS.ACTORS.IMAGE.EXTNAME
  .map(v => v.replace('.', ''))
  .join('|')
const imageMimeTypesRegex = `image/(${imageMimeTypes})`

function checkActorImageFile (files: { [ fieldname: string ]: Express.Multer.File[] } | Express.Multer.File[], fieldname: string) {
  return checkFileValid(files, imageMimeTypesRegex, fieldname, CONSTRAINTS_FIELDS.ACTORS.IMAGE.FILE_SIZE.max)
}

// ---------------------------------------------------------------------------

export {
  checkActorImageFile
}
