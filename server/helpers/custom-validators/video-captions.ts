import { CONSTRAINTS_FIELDS, MIMETYPES, VIDEO_LANGUAGES } from '../../initializers/constants'
import { exists, isFileValid } from './misc'

/**
 * @throws {Error}
 */
function checkVideoCaptionLanguage (value: any) {
  if (!exists(value)) throw new Error('Should have a video caption language')
  if (VIDEO_LANGUAGES[value] === undefined) throw new Error('Should have a known video caption language')
  return true
}

const videoCaptionTypesRegex = Object.keys(MIMETYPES.VIDEO_CAPTIONS.MIMETYPE_EXT)
                                .concat([ 'application/octet-stream' ]) // MacOS sends application/octet-stream
                                .map(m => `(${m})`)
                                .join('|')

/**
 * @throws {Error}
 */
function isVideoCaptionFile (files: { [ fieldname: string ]: Express.Multer.File[] } | Express.Multer.File[], field: string) {
  return isFileValid(files, videoCaptionTypesRegex, field, CONSTRAINTS_FIELDS.VIDEO_CAPTIONS.CAPTION_FILE.FILE_SIZE.max)
}

// ---------------------------------------------------------------------------

export {
  isVideoCaptionFile,
  checkVideoCaptionLanguage
}
