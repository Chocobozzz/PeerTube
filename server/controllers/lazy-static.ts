import * as cors from 'cors'
import * as express from 'express'
import { VideosTorrentCache } from '@server/lib/files-cache/videos-torrent-cache'
import { HttpStatusCode } from '../../shared/core-utils/miscs/http-error-codes'
import { logger } from '../helpers/logger'
import { LAZY_STATIC_PATHS, STATIC_MAX_AGE } from '../initializers/constants'
import { VideosCaptionCache, VideosPreviewCache } from '../lib/files-cache'
import { actorImagePathUnsafeCache, pushActorImageProcessInQueue } from '../lib/local-actor'
import { asyncMiddleware } from '../middlewares'
import { ActorImageModel } from '../models/actor/actor-image'

const lazyStaticRouter = express.Router()

lazyStaticRouter.use(cors())

lazyStaticRouter.use(
  LAZY_STATIC_PATHS.AVATARS + ':filename',
  asyncMiddleware(getActorImage)
)

lazyStaticRouter.use(
  LAZY_STATIC_PATHS.BANNERS + ':filename',
  asyncMiddleware(getActorImage)
)

lazyStaticRouter.use(
  LAZY_STATIC_PATHS.PREVIEWS + ':filename',
  asyncMiddleware(getPreview)
)

lazyStaticRouter.use(
  LAZY_STATIC_PATHS.VIDEO_CAPTIONS + ':filename',
  asyncMiddleware(getVideoCaption)
)

lazyStaticRouter.use(
  LAZY_STATIC_PATHS.TORRENTS + ':filename',
  asyncMiddleware(getTorrent)
)

// ---------------------------------------------------------------------------

export {
  lazyStaticRouter,
  getPreview,
  getVideoCaption
}

// ---------------------------------------------------------------------------

async function getActorImage (req: express.Request, res: express.Response, next: express.NextFunction) {
  const filename = req.params.filename

  if (actorImagePathUnsafeCache.has(filename)) {
    return res.sendFile(actorImagePathUnsafeCache.get(filename), { maxAge: STATIC_MAX_AGE.SERVER })
  }

  const image = await ActorImageModel.loadByName(filename)
  if (!image) return res.status(HttpStatusCode.NOT_FOUND_404).end()

  if (image.onDisk === false) {
    if (!image.fileUrl) return res.status(HttpStatusCode.NOT_FOUND_404).end()

    logger.info('Lazy serve remote actor image %s.', image.fileUrl)

    try {
      await pushActorImageProcessInQueue({ filename: image.filename, fileUrl: image.fileUrl, type: image.type })
    } catch (err) {
      logger.warn('Cannot process remote actor image %s.', image.fileUrl, { err })
      return res.status(HttpStatusCode.NOT_FOUND_404).end()
    }

    image.onDisk = true
    image.save()
      .catch(err => logger.error('Cannot save new actor image disk state.', { err }))
  }

  const path = image.getPath()

  actorImagePathUnsafeCache.set(filename, path)

  return res.sendFile(path, { maxAge: STATIC_MAX_AGE.LAZY_SERVER }, (err: any) => {
    if (!err) return

    // It seems this actor image is not on the disk anymore
    if (err.status === HttpStatusCode.NOT_FOUND_404 && !image.isOwned()) {
      logger.error('Cannot lazy serve actor image %s.', filename, { err })

      actorImagePathUnsafeCache.del(filename)

      image.onDisk = false
      image.save()
       .catch(err => logger.error('Cannot save new actor image disk state.', { err }))
    }

    return next(err)
  })
}

async function getPreview (req: express.Request, res: express.Response) {
  const result = await VideosPreviewCache.Instance.getFilePath(req.params.filename)
  if (!result) return res.status(HttpStatusCode.NOT_FOUND_404).end()

  return res.sendFile(result.path, { maxAge: STATIC_MAX_AGE.LAZY_SERVER })
}

async function getVideoCaption (req: express.Request, res: express.Response) {
  const result = await VideosCaptionCache.Instance.getFilePath(req.params.filename)
  if (!result) return res.status(HttpStatusCode.NOT_FOUND_404).end()

  return res.sendFile(result.path, { maxAge: STATIC_MAX_AGE.LAZY_SERVER })
}

async function getTorrent (req: express.Request, res: express.Response) {
  const result = await VideosTorrentCache.Instance.getFilePath(req.params.filename)
  if (!result) return res.status(HttpStatusCode.NOT_FOUND_404).end()

  // Torrents still use the old naming convention (video uuid + .torrent)
  return res.sendFile(result.path, { maxAge: STATIC_MAX_AGE.SERVER })
}
