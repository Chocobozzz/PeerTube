import 'express-validator'
import 'multer'
import * as validator from 'validator'
import { CONSTRAINTS_FIELDS, TORRENT_MIMETYPE_EXT, VIDEO_IMPORT_STATES } from '../../initializers'
import { exists, isFileValid } from './misc'
import * as express from 'express'
import { VideoImportModel } from '../../models/video/video-import'

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
  return exists(value) && VIDEO_IMPORT_STATES[ value ] !== undefined
}

const videoTorrentImportTypes = Object.keys(TORRENT_MIMETYPE_EXT).map(m => `(${m})`)
const videoTorrentImportRegex = videoTorrentImportTypes.join('|')
function isVideoImportTorrentFile (files: { [ fieldname: string ]: Express.Multer.File[] } | Express.Multer.File[]) {
  return isFileValid(files, videoTorrentImportRegex, 'torrentfile', CONSTRAINTS_FIELDS.VIDEO_IMPORTS.TORRENT_FILE.FILE_SIZE.max, true)
}

async function isVideoImportExist (id: number, res: express.Response) {
  const videoImport = await VideoImportModel.loadAndPopulateVideo(id)

  if (!videoImport) {
    res.status(404)
       .json({ error: 'Video import not found' })
       .end()

    return false
  }

  res.locals.videoImport = videoImport
  return true
}

// ---------------------------------------------------------------------------

export {
  isVideoImportStateValid,
  isVideoImportTargetUrlValid,
  isVideoImportExist,
  isVideoImportTorrentFile
}
