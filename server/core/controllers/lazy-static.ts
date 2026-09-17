import { FileStorage, HttpStatusCode } from '@peertube/peertube-models'
import { parseDurationToMs } from '@peertube/peertube-node-utils'
import { pipelineToResponse } from '@server/helpers/express-utils.js'
import { generateRequestStream } from '@server/helpers/requests.js'
import { CONFIG } from '@server/initializers/config.js'
import { isObjectNotFoundError } from '@server/lib/object-storage/object-storage-helpers.js'
import { getCommonFileReadStream } from '@server/lib/object-storage/common-files.js'
import { VideoFileModel } from '@server/models/video/video-file.js'
import cors from 'cors'
import express from 'express'
import { join } from 'node:path'
import { LAZY_STATIC_PATHS, STATIC_MAX_AGE } from '../initializers/constants.js'

import { AvatarImageFileCache } from '@server/lib/files-cache/avatar-image-file-cache.js'
import { VideoCaptionsFileCache } from '@server/lib/files-cache/video-captions-file-cache.js'
import { VideoStoryboardsImageFileCache } from '@server/lib/files-cache/video-storyboards-image-file-cache.js'
import { VideoThumbnailsImageFileCache } from '@server/lib/files-cache/video-thumbnails-image-file-cache.js'
import { asyncMiddleware, handleStaticError } from '../middlewares/index.js'

// ---------------------------------------------------------------------------

const lazyStaticRouter = express.Router()

lazyStaticRouter.use(cors())

lazyStaticRouter.use(
  LAZY_STATIC_PATHS.AVATARS + ':filename',
  asyncMiddleware(getActorImage),
  handleStaticError
)

lazyStaticRouter.use(
  LAZY_STATIC_PATHS.BANNERS + ':filename',
  asyncMiddleware(getActorImage),
  handleStaticError
)

lazyStaticRouter.use(
  LAZY_STATIC_PATHS.THUMBNAILS + ':filename',
  asyncMiddleware(getThumbnail),
  handleStaticError
)

// TODO: deprecated, remove in v9
lazyStaticRouter.use(
  '/lazy-static/previews/:filename',
  asyncMiddleware(getThumbnail),
  handleStaticError
)

lazyStaticRouter.use(
  LAZY_STATIC_PATHS.STORYBOARDS + ':filename',
  asyncMiddleware(getStoryboard),
  handleStaticError
)

lazyStaticRouter.use(
  LAZY_STATIC_PATHS.VIDEO_CAPTIONS + ':filename',
  asyncMiddleware(getVideoCaption),
  handleStaticError
)

lazyStaticRouter.use(
  LAZY_STATIC_PATHS.TORRENTS + ':filename',
  asyncMiddleware(getTorrent),
  handleStaticError
)

// ---------------------------------------------------------------------------

export {
  lazyStaticRouter
}

// ---------------------------------------------------------------------------
const avatarImageFileCache = new AvatarImageFileCache()

function getActorImage (req: express.Request, res: express.Response, next: express.NextFunction) {
  const filename = req.params.filename

  return avatarImageFileCache.lazyServe({ filename, res, next })
}

// ---------------------------------------------------------------------------

const videoThumbnailImageFileCache = new VideoThumbnailsImageFileCache()

async function getThumbnail (req: express.Request, res: express.Response, next: express.NextFunction) {
  const filename = req.params.filename

  return videoThumbnailImageFileCache.lazyServe({ filename, res, next })
}

// ---------------------------------------------------------------------------

const videoStoryboardsImageFileCache = new VideoStoryboardsImageFileCache()

async function getStoryboard (req: express.Request, res: express.Response, next: express.NextFunction) {
  const filename = req.params.filename

  return videoStoryboardsImageFileCache.lazyServe({ filename, res, next })
}

// ---------------------------------------------------------------------------

const videoCaptionFileCache = new VideoCaptionsFileCache()

async function getVideoCaption (req: express.Request, res: express.Response, next: express.NextFunction) {
  const filename = req.params.filename

  return videoCaptionFileCache.lazyServe({ filename, res, next })
}

// ---------------------------------------------------------------------------

// Proxify remote request without cache
// Unlike images and captions, torrents don't use an AbstractFileCache: video files have no "cached" state for torrents,
// and these small files are rarely requested
async function getTorrent (req: express.Request, res: express.Response) {
  const file = await VideoFileModel.loadWithVideoOrPlaylistByTorrentFilename(req.params.filename)
  if (!file) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  if (file.getVideo().isLocal()) {
    // Torrent URL is now the object storage URL, but keep serving torrents that were published with this URL to not break existing torrents
    if (file.torrentStorage === FileStorage.OBJECT_STORAGE) {
      const stream = await getCommonFileReadStream('torrents', file.torrentFilename)
        .catch(err => {
          if (isObjectNotFoundError(err)) return undefined

          throw err
        })

      if (!stream) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

      // Same cache policy as torrents served from the file system
      res.setHeader('Cache-Control', 'public, max-age=' + Math.floor(parseDurationToMs(STATIC_MAX_AGE.LAZY_SERVER) / 1000))
      res.setHeader('Content-Type', 'application/x-bittorrent')

      return pipelineToResponse({ streams: [ stream ], res, logLabel: `torrent download of ${file.torrentFilename}` })
    }

    return res.sendFile(join(CONFIG.STORAGE.TORRENTS_DIR, file.torrentFilename), { maxAge: STATIC_MAX_AGE.LAZY_SERVER })
  }

  const remoteUrl = file.getRemoteTorrentUrl(file.getVideo())

  await pipelineToResponse({ streams: [ generateRequestStream(remoteUrl) ], res, logLabel: `torrent download of ${remoteUrl}` })
}
