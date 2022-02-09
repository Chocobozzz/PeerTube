import { getFileSize } from '@shared/extra-utils'
import { readFile } from 'fs-extra'
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

async function isVTTFileValid (filePath: string) {
  const size = await getFileSize(filePath)

  if (size > CONSTRAINTS_FIELDS.VIDEO_CAPTIONS.CAPTION_FILE.FILE_SIZE.max) return false

  const content = await readFile(filePath, 'utf8')

  return content?.startsWith('WEBVTT\n')
}

// ---------------------------------------------------------------------------

export {
  isVideoCaptionFile,
  isVTTFileValid,
  isVideoCaptionLanguageValid
}
