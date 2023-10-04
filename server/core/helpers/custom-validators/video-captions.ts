import { UploadFilesForCheck } from 'express'
import { readFile } from 'fs/promises'
import { getFileSize } from '@peertube/peertube-node-utils'
import { CONSTRAINTS_FIELDS, MIMETYPES, VIDEO_LANGUAGES } from '../../initializers/constants.js'
import { logger } from '../logger.js'
import { exists, isFileValid } from './misc.js'

function isVideoCaptionLanguageValid (value: any) {
  return exists(value) && VIDEO_LANGUAGES[value] !== undefined
}

// MacOS sends application/octet-stream
const videoCaptionTypesRegex = [ ...Object.keys(MIMETYPES.VIDEO_CAPTIONS.MIMETYPE_EXT), 'application/octet-stream' ]
  .map(m => `(${m})`)
  .join('|')

function isVideoCaptionFile (files: UploadFilesForCheck, field: string) {
  return isFileValid({
    files,
    mimeTypeRegex: videoCaptionTypesRegex,
    field,
    maxSize: CONSTRAINTS_FIELDS.VIDEO_CAPTIONS.CAPTION_FILE.FILE_SIZE.max
  })
}

async function isVTTFileValid (filePath: string) {
  const size = await getFileSize(filePath)
  const content = await readFile(filePath, 'utf8')

  logger.debug('Checking VTT file %s', filePath, { size, content })

  if (size > CONSTRAINTS_FIELDS.VIDEO_CAPTIONS.CAPTION_FILE.FILE_SIZE.max) return false

  return content?.startsWith('WEBVTT')
}

// ---------------------------------------------------------------------------

export {
  isVideoCaptionFile,
  isVTTFileValid,
  isVideoCaptionLanguageValid
}
