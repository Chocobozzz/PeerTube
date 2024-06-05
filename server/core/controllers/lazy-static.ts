import cors from 'cors'
import express from 'express'
import { HttpStatusCode } from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'
import { FILES_CACHE, LAZY_STATIC_PATHS, STATIC_MAX_AGE } from '../initializers/constants.js'
import {
  AvatarPermanentFileCache,
  VideoCaptionsSimpleFileCache,
  VideoMiniaturePermanentFileCache,
  VideoPreviewsSimpleFileCache,
  VideoStoryboardsSimpleFileCache,
  VideoTorrentsSimpleFileCache
} from '../lib/files-cache/index.js'
import { asyncMiddleware, handleStaticError } from '../middlewares/index.js'

// ---------------------------------------------------------------------------
// Cache initializations
// ---------------------------------------------------------------------------

VideoPreviewsSimpleFileCache.Instance.init(CONFIG.CACHE.PREVIEWS.SIZE, FILES_CACHE.PREVIEWS.MAX_AGE)
VideoCaptionsSimpleFileCache.Instance.init(CONFIG.CACHE.VIDEO_CAPTIONS.SIZE, FILES_CACHE.VIDEO_CAPTIONS.MAX_AGE)
VideoTorrentsSimpleFileCache.Instance.init(CONFIG.CACHE.TORRENTS.SIZE, FILES_CACHE.TORRENTS.MAX_AGE)
VideoStoryboardsSimpleFileCache.Instance.init(CONFIG.CACHE.STORYBOARDS.SIZE, FILES_CACHE.STORYBOARDS.MAX_AGE)

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

lazyStaticRouter.use(
  LAZY_STATIC_PATHS.PREVIEWS + ':filename',
  asyncMiddleware(getPreview),
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
  lazyStaticRouter,
  getPreview,
  getVideoCaption
}

// ---------------------------------------------------------------------------
const avatarPermanentFileCache = new AvatarPermanentFileCache()

function getActorImage (req: express.Request, res: express.Response, next: express.NextFunction) {
  const filename = req.params.filename

  return avatarPermanentFileCache.lazyServe({ filename, res, next })
}

// ---------------------------------------------------------------------------
const videoMiniaturePermanentFileCache = new VideoMiniaturePermanentFileCache()

function getThumbnail (req: express.Request, res: express.Response, next: express.NextFunction) {
  const filename = req.params.filename

  return videoMiniaturePermanentFileCache.lazyServe({ filename, res, next })
}

// ---------------------------------------------------------------------------

async function getPreview (req: express.Request, res: express.Response) {
  const result = await VideoPreviewsSimpleFileCache.Instance.getFilePath(req.params.filename)
  if (!result) return res.status(HttpStatusCode.NOT_FOUND_404).end()

  return res.sendFile(result.path, { maxAge: STATIC_MAX_AGE.LAZY_SERVER })
}

async function getStoryboard (req: express.Request, res: express.Response) {
  const result = await VideoStoryboardsSimpleFileCache.Instance.getFilePath(req.params.filename)
  if (!result) return res.status(HttpStatusCode.NOT_FOUND_404).end()

  return res.sendFile(result.path, { maxAge: STATIC_MAX_AGE.LAZY_SERVER })
}

async function getVideoCaption (req: express.Request, res: express.Response) {
  const result = await VideoCaptionsSimpleFileCache.Instance.getFilePath(req.params.filename)
  if (!result) return res.status(HttpStatusCode.NOT_FOUND_404).end()

  return res.sendFile(result.path, { maxAge: STATIC_MAX_AGE.LAZY_SERVER })
}

async function getTorrent (req: express.Request, res: express.Response) {
  const result = await VideoTorrentsSimpleFileCache.Instance.getFilePath(req.params.filename)
  if (!result) return res.status(HttpStatusCode.NOT_FOUND_404).end()

  return res.sendFile(result.path, { maxAge: STATIC_MAX_AGE.SERVER })
}
