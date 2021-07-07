import * as express from 'express'
import { query } from 'express-validator'
import { join } from 'path'
import { loadVideo } from '@server/lib/model-loaders'
import { VideoPlaylistModel } from '@server/models/video/video-playlist'
import { VideoPlaylistPrivacy, VideoPrivacy } from '@shared/models'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'
import { isTestInstance } from '../../helpers/core-utils'
import { isIdOrUUIDValid, toCompleteUUID } from '../../helpers/custom-validators/misc'
import { logger } from '../../helpers/logger'
import { WEBSERVER } from '../../initializers/constants'
import { areValidationErrors } from './shared'

const playlistPaths = [
  join('videos', 'watch', 'playlist'),
  join('w', 'p')
]

const videoPaths = [
  join('videos', 'watch'),
  'w'
]

function buildUrls (paths: string[]) {
  return paths.map(p => WEBSERVER.SCHEME + '://' + join(WEBSERVER.HOST, p) + '/')
}

const startPlaylistURLs = buildUrls(playlistPaths)
const startVideoURLs = buildUrls(videoPaths)

const watchRegex = /([^/]+)$/
const isURLOptions = {
  require_host: true,
  require_tld: true
}

// We validate 'localhost', so we don't have the top level domain
if (isTestInstance()) {
  isURLOptions.require_tld = false
}

const oembedValidator = [
  query('url').isURL(isURLOptions).withMessage('Should have a valid url'),
  query('maxwidth').optional().isInt().withMessage('Should have a valid max width'),
  query('maxheight').optional().isInt().withMessage('Should have a valid max height'),
  query('format').optional().isIn([ 'xml', 'json' ]).withMessage('Should have a valid format'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking oembed parameters', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    if (req.query.format !== undefined && req.query.format !== 'json') {
      return res.fail({
        status: HttpStatusCode.NOT_IMPLEMENTED_501,
        message: 'Requested format is not implemented on server.',
        data: {
          format: req.query.format
        }
      })
    }

    const url = req.query.url as string

    const isPlaylist = startPlaylistURLs.some(u => url.startsWith(u))
    const isVideo = isPlaylist ? false : startVideoURLs.some(u => url.startsWith(u))

    const startIsOk = isVideo || isPlaylist

    const matches = watchRegex.exec(url)

    if (startIsOk === false || matches === null) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'Invalid url.',
        data: {
          url
        }
      })
    }

    const elementId = toCompleteUUID(matches[1])
    if (isIdOrUUIDValid(elementId) === false) {
      return res.fail({ message: 'Invalid video or playlist id.' })
    }

    if (isVideo) {
      const video = await loadVideo(elementId, 'all')

      if (!video) {
        return res.fail({
          status: HttpStatusCode.NOT_FOUND_404,
          message: 'Video not found'
        })
      }

      if (video.privacy !== VideoPrivacy.PUBLIC) {
        return res.fail({
          status: HttpStatusCode.FORBIDDEN_403,
          message: 'Video is not public'
        })
      }

      res.locals.videoAll = video
      return next()
    }

    // Is playlist

    const videoPlaylist = await VideoPlaylistModel.loadWithAccountAndChannelSummary(elementId, undefined)
    if (!videoPlaylist) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'Video playlist not found'
      })
    }

    if (videoPlaylist.privacy !== VideoPlaylistPrivacy.PUBLIC) {
      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: 'Playlist is not public'
      })
    }

    res.locals.videoPlaylistSummary = videoPlaylist
    return next()
  }

]

// ---------------------------------------------------------------------------

export {
  oembedValidator
}
