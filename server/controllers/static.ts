import * as cors from 'cors'
import * as express from 'express'
import { CONFIG, STATIC_DOWNLOAD_PATHS, STATIC_MAX_AGE, STATIC_PATHS } from '../initializers'
import { VideosPreviewCache } from '../lib/cache'
import { asyncMiddleware, videosGetValidator } from '../middlewares'
import { VideoModel } from '../models/video/video'

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
staticRouter.use(
  STATIC_DOWNLOAD_PATHS.TORRENTS + ':id-:resolution([0-9]+).torrent',
  asyncMiddleware(videosGetValidator),
  asyncMiddleware(downloadTorrent)
)

// Videos path for webseeding
const videosPhysicalPath = CONFIG.STORAGE.VIDEOS_DIR
staticRouter.use(
  STATIC_PATHS.WEBSEED,
  cors(),
  express.static(videosPhysicalPath, { maxAge: STATIC_MAX_AGE })
)
staticRouter.use(
  STATIC_DOWNLOAD_PATHS.VIDEOS + ':id-:resolution([0-9]+).:extension',
  asyncMiddleware(videosGetValidator),
  asyncMiddleware(downloadVideoFile)
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

async function downloadTorrent (req: express.Request, res: express.Response, next: express.NextFunction) {
  const { video, videoFile } = getVideoAndFile(req, res)
  if (!videoFile) return res.status(404).end()

  return res.download(video.getTorrentFilePath(videoFile), `${video.name}-${videoFile.resolution}p.torrent`)
}

async function downloadVideoFile (req: express.Request, res: express.Response, next: express.NextFunction) {
  const { video, videoFile } = getVideoAndFile(req, res)
  if (!videoFile) return res.status(404).end()

  return res.download(video.getVideoFilePath(videoFile), `${video.name}-${videoFile.resolution}p${videoFile.extname}`)
}

function getVideoAndFile (req: express.Request, res: express.Response) {
  const resolution = parseInt(req.params.resolution, 10)
  const video: VideoModel = res.locals.video

  const videoFile = video.VideoFiles.find(f => f.resolution === resolution)

  return { video, videoFile }
}
