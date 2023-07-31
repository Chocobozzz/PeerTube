import 'multer'
import { UploadFilesForCheck } from 'express'
import validator from 'validator'
import { CONSTRAINTS_FIELDS, MIMETYPES, VIDEO_IMPORT_STATES } from '../../initializers/constants.js'
import { exists, isFileValid } from './misc.js'

function isVideoImportTargetUrlValid (url: string) {
  const isURLOptions = {
    require_host: true,
    require_tld: true,
    require_protocol: true,
    require_valid_protocol: true,
    protocols: [ 'http', 'https' ]
  }

  return exists(url) &&
    validator.default.isURL('' + url, isURLOptions) &&
    validator.default.isLength('' + url, CONSTRAINTS_FIELDS.VIDEO_IMPORTS.URL)
}

function isVideoImportStateValid (value: any) {
  return exists(value) && VIDEO_IMPORT_STATES[value] !== undefined
}

// MacOS sends application/octet-stream
const videoTorrentImportRegex = [ ...Object.keys(MIMETYPES.TORRENT.MIMETYPE_EXT), 'application/octet-stream' ]
  .map(m => `(${m})`)
  .join('|')

function isVideoImportTorrentFile (files: UploadFilesForCheck) {
  return isFileValid({
    files,
    mimeTypeRegex: videoTorrentImportRegex,
    field: 'torrentfile',
    maxSize: CONSTRAINTS_FIELDS.VIDEO_IMPORTS.TORRENT_FILE.FILE_SIZE.max,
    optional: true
  })
}

// ---------------------------------------------------------------------------

export {
  isVideoImportStateValid,
  isVideoImportTargetUrlValid,
  isVideoImportTorrentFile
}
