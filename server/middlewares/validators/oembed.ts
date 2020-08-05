import * as express from 'express'
import { query } from 'express-validator'
import { join } from 'path'
import { fetchVideo } from '@server/helpers/video'
import { VideoPlaylistModel } from '@server/models/video/video-playlist'
import { VideoPlaylistPrivacy, VideoPrivacy } from '@shared/models'
import { isTestInstance } from '../../helpers/core-utils'
import { isIdOrUUIDValid } from '../../helpers/custom-validators/misc'
import { logger } from '../../helpers/logger'
import { WEBSERVER } from '../../initializers/constants'
import { areValidationErrors } from './utils'

const startVideoPlaylistsURL = WEBSERVER.SCHEME + '://' + join(WEBSERVER.HOST, 'videos', 'watch', 'playlist') + '/'
const startVideosURL = WEBSERVER.SCHEME + '://' + join(WEBSERVER.HOST, 'videos', 'watch') + '/'

const watchRegex = new RegExp('([^/]+)$')
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
      return res.status(501)
        .json({ error: 'Requested format is not implemented on server.' })
    }

    const url = req.query.url as string

    const isPlaylist = url.startsWith(startVideoPlaylistsURL)
    const isVideo = isPlaylist ? false : url.startsWith(startVideosURL)

    const startIsOk = isVideo || isPlaylist

    const matches = watchRegex.exec(url)

    if (startIsOk === false || matches === null) {
      return res.status(400)
        .json({ error: 'Invalid url.' })
    }

    const elementId = matches[1]
    if (isIdOrUUIDValid(elementId) === false) {
      return res.status(400)
        .json({ error: 'Invalid video or playlist id.' })
    }

    if (isVideo) {
      const video = await fetchVideo(elementId, 'all')

      if (!video) {
        return res.status(404)
          .json({ error: 'Video not found' })
      }

      if (video.privacy !== VideoPrivacy.PUBLIC) {
        return res.status(403)
          .json({ error: 'Video is not public' })
      }

      res.locals.videoAll = video
      return next()
    }

    // Is playlist

    const videoPlaylist = await VideoPlaylistModel.loadWithAccountAndChannelSummary(elementId, undefined)
    if (!videoPlaylist) {
      return res.status(404)
        .json({ error: 'Video playlist not found' })
    }

    if (videoPlaylist.privacy !== VideoPlaylistPrivacy.PUBLIC) {
      return res.status(403)
        .json({ error: 'Playlist is not public' })
    }

    res.locals.videoPlaylistSummary = videoPlaylist
    return next()
  }

]

// ---------------------------------------------------------------------------

export {
  oembedValidator
}
