import express from 'express'
import { query } from 'express-validator'
import { join } from 'path'
import { HttpStatusCode, VideoPlaylistPrivacy, VideoPrivacy } from '@peertube/peertube-models'
import { isTestOrDevInstance } from '@peertube/peertube-node-utils'
import { loadVideo } from '@server/lib/model-loaders/index.js'
import { VideoPlaylistModel } from '@server/models/video/video-playlist.js'
import { isIdOrUUIDValid, isUUIDValid, toCompleteUUID } from '../../helpers/custom-validators/misc.js'
import { WEBSERVER } from '../../initializers/constants.js'
import { areValidationErrors } from './shared/index.js'

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

const isURLOptions = {
  require_host: true,
  require_tld: true
}

// We validate 'localhost', so we don't have the top level domain
if (isTestOrDevInstance()) {
  isURLOptions.require_tld = false
}

const oembedValidator = [
  query('url')
    .isURL(isURLOptions),
  query('maxwidth')
    .optional()
    .isInt(),
  query('maxheight')
    .optional()
    .isInt(),
  query('format')
    .optional()
    .isIn([ 'xml', 'json' ]),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
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

    let urlPath: string

    try {
      urlPath = new URL(url).pathname
    } catch (err) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: err.message,
        data: {
          url
        }
      })
    }

    const isPlaylist = startPlaylistURLs.some(u => url.startsWith(u))
    const isVideo = isPlaylist ? false : startVideoURLs.some(u => url.startsWith(u))

    const startIsOk = isVideo || isPlaylist

    const parts = urlPath.split('/')

    if (startIsOk === false || parts.length === 0) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'Invalid url.',
        data: {
          url
        }
      })
    }

    const elementId = toCompleteUUID(parts.pop())
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

      if (
        video.privacy === VideoPrivacy.PUBLIC ||
        (video.privacy === VideoPrivacy.UNLISTED && isUUIDValid(elementId) === true)
      ) {
        res.locals.videoAll = video
        return next()
      }

      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: 'Video is not publicly available'
      })
    }

    // Is playlist

    const videoPlaylist = await VideoPlaylistModel.loadWithAccountAndChannelSummary(elementId, undefined)
    if (!videoPlaylist) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'Video playlist not found'
      })
    }

    if (
      videoPlaylist.privacy === VideoPlaylistPrivacy.PUBLIC ||
      (videoPlaylist.privacy === VideoPlaylistPrivacy.UNLISTED && isUUIDValid(elementId))
    ) {
      res.locals.videoPlaylistSummary = videoPlaylist
      return next()
    }

    return res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'Playlist is not public'
    })
  }

]

// ---------------------------------------------------------------------------

export {
  oembedValidator
}
