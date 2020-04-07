import { CONSTRAINTS_FIELDS, MIMETYPES, VIDEO_LANGUAGES } from '../../initializers/constants'
import { exists, isFileValid } from './misc'

function isVideoCaptionLanguageValid (value: any) {
  return exists(value) && VIDEO_LANGUAGES[value] !== undefined
}

const videoCaptionTypesRegex = Object.keys(MIMETYPES.VIDEO_CAPTIONS.MIMETYPE_EXT)
                                .concat([ 'application/octet-stream' ]) // MacOS sends application/octet-stream
                                .map(m => `(${m})`)
                                .join('|')
function isVideoCaptionFile (files: { [ fieldname: string ]: Express.Multer.File[] } | Express.Multer.File[], field: string) {
  return isFileValid(files, videoCaptionTypesRegex, field, CONSTRAINTS_FIELDS.VIDEO_CAPTIONS.CAPTION_FILE.FILE_SIZE.max)
}

// ---------------------------------------------------------------------------

export {
  isVideoCaptionFile,
  isVideoCaptionLanguageValid
}
