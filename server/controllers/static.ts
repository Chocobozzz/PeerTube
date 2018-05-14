import * as cors from 'cors'
import * as express from 'express'
import { CONFIG, STATIC_MAX_AGE, STATIC_PATHS } from '../initializers'
import { VideosPreviewCache } from '../lib/cache'
import { asyncMiddleware } from '../middlewares'

const staticRouter = express.Router()

/*
  Cors is very important to let other servers access torrent and video files
*/

const torrentsPhysicalPath = CONFIG.STORAGE.TORRENTS_DIR
staticRouter.use(
  STATIC_PATHS.TORRENTS,
  cors(),
  express.static(torrentsPhysicalPath, { maxAge: 0 }) // Don't cache because we could regenerate the torrent file
)

// Videos path for webseeding
const videosPhysicalPath = CONFIG.STORAGE.VIDEOS_DIR
staticRouter.use(
  STATIC_PATHS.WEBSEED,
  cors(),
  express.static(videosPhysicalPath, { maxAge: STATIC_MAX_AGE })
)

// Thumbnails path for express
const thumbnailsPhysicalPath = CONFIG.STORAGE.THUMBNAILS_DIR
staticRouter.use(
  STATIC_PATHS.THUMBNAILS,
  express.static(thumbnailsPhysicalPath, { maxAge: STATIC_MAX_AGE })
)

const avatarsPhysicalPath = CONFIG.STORAGE.AVATARS_DIR
staticRouter.use(
  STATIC_PATHS.AVATARS,
  express.static(avatarsPhysicalPath, { maxAge: STATIC_MAX_AGE })
)

// Video previews path for express
staticRouter.use(
  STATIC_PATHS.PREVIEWS + ':uuid.jpg',
  asyncMiddleware(getPreview)
)

// robots.txt service
staticRouter.get('/robots.txt', (req: express.Request, res: express.Response) => {
  res.type('text/plain')
  return res.send(CONFIG.INSTANCE.ROBOTS)
})

// ---------------------------------------------------------------------------

export {
  staticRouter
}

// ---------------------------------------------------------------------------

async function getPreview (req: express.Request, res: express.Response, next: express.NextFunction) {
  const path = await VideosPreviewCache.Instance.getPreviewPath(req.params.uuid)
  if (!path) return res.sendStatus(404)

  return res.sendFile(path, { maxAge: STATIC_MAX_AGE })
}
