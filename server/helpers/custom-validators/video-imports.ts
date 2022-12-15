import 'multer'
import { UploadFilesForCheck } from 'express'
import validator from 'validator'
import { CONSTRAINTS_FIELDS, MIMETYPES, VIDEO_IMPORT_STATES } from '../../initializers/constants'
import { exists, isFileValid } from './misc'

function isVideoImportTargetUrlValid (url: string) {
  const isURLOptions = {
    require_host: true,
    require_tld: true,
    require_protocol: true,
    require_valid_protocol: true,
    protocols: [ 'http', 'https' ]
  }

  return exists(url) &&
    validator.isURL('' + url, isURLOptions) &&
    validator.isLength('' + url, CONSTRAINTS_FIELDS.VIDEO_IMPORTS.URL)
}

function isVideoImportStateValid (value: any) {
  return exists(value) && VIDEO_IMPORT_STATES[value] !== undefined
}

const videoTorrentImportRegex = Object.keys(MIMETYPES.TORRENT.MIMETYPE_EXT)
                                      .concat([ 'application/octet-stream' ]) // MacOS sends application/octet-stream
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
