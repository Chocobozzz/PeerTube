import 'multer'
import validator from 'validator'
import { CONSTRAINTS_FIELDS, MIMETYPES, VIDEO_IMPORT_STATES } from '../../initializers/constants'
import { exists, isFileValid } from './misc'
import * as express from 'express'
import { VideoImportModel } from '../../models/video/video-import'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

/**
 * @throws {Error}
 */
function checkVideoImportTargetUrl (url: string) {
  const isURLOptions = {
    require_host: true,
    require_tld: true,
    require_protocol: true,
    require_valid_protocol: true,
    protocols: [ 'http', 'https' ]
  }

  if (!exists(url)) throw new Error('Should have a video import target URL')
  if (!validator.isURL('' + url, isURLOptions)) {
    throw new Error('Should have a video import target URL that has a host, top-level domain, and a protocol among http/https')
  }
  if (!validator.isLength('' + url, CONSTRAINTS_FIELDS.VIDEO_IMPORTS.URL)) {
    const min = CONSTRAINTS_FIELDS.VIDEO_IMPORTS.URL.min
    const max = CONSTRAINTS_FIELDS.VIDEO_IMPORTS.URL.max
    throw new Error(`Should have a video import target URL between ${min} and ${max} characters long`)
  }
  return true
}

/**
 * @throws {Error}
 */
function checkVideoImportState (value: any) {
  if (!exists(value)) throw new Error('Should have a video import state')
  if (VIDEO_IMPORT_STATES[value] === undefined) throw new Error('Should have a known video import')
  return true
}

const videoTorrentImportRegex = Object.keys(MIMETYPES.TORRENT.MIMETYPE_EXT)
                                      .concat([ 'application/octet-stream' ]) // MacOS sends application/octet-stream
                                      .map(m => `(${m})`)
                                      .join('|')

/**
 * @throws {Error}
 */
function checkVideoImportTorrentFile (files: { [ fieldname: string ]: Express.Multer.File[] } | Express.Multer.File[]) {
  return isFileValid(files, videoTorrentImportRegex, 'torrentfile', CONSTRAINTS_FIELDS.VIDEO_IMPORTS.TORRENT_FILE.FILE_SIZE.max, true)
}

async function doesVideoImportExist (id: number, res: express.Response) {
  const videoImport = await VideoImportModel.loadAndPopulateVideo(id)

  if (!videoImport) {
    res.status(HttpStatusCode.NOT_FOUND_404)
       .json({ error: 'Video import not found' })
       .end()

    return false
  }

  res.locals.videoImport = videoImport
  return true
}

// ---------------------------------------------------------------------------

export {
  checkVideoImportState,
  checkVideoImportTargetUrl,
  doesVideoImportExist,
  checkVideoImportTorrentFile
}
