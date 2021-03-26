import * as cors from 'cors'
import * as express from 'express'
import { VideosTorrentCache } from '@server/lib/files-cache/videos-torrent-cache'
import { HttpStatusCode } from '../../shared/core-utils/miscs/http-error-codes'
import { logger } from '../helpers/logger'
import { LAZY_STATIC_PATHS, STATIC_MAX_AGE } from '../initializers/constants'
import { avatarPathUnsafeCache, pushAvatarProcessInQueue } from '../lib/avatar'
import { VideosCaptionCache, VideosPreviewCache } from '../lib/files-cache'
import { asyncMiddleware } from '../middlewares'
import { AvatarModel } from '../models/avatar/avatar'

const lazyStaticRouter = express.Router()

lazyStaticRouter.use(cors())

lazyStaticRouter.use(
  LAZY_STATIC_PATHS.AVATARS + ':filename',
  asyncMiddleware(getAvatar)
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

async function getAvatar (req: express.Request, res: express.Response) {
  const filename = req.params.filename

  if (avatarPathUnsafeCache.has(filename)) {
    return res.sendFile(avatarPathUnsafeCache.get(filename), { maxAge: STATIC_MAX_AGE.SERVER })
  }

  const avatar = await AvatarModel.loadByName(filename)
  if (!avatar) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  if (avatar.onDisk === false) {
    if (!avatar.fileUrl) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    logger.info('Lazy serve remote avatar image %s.', avatar.fileUrl)

    try {
      await pushAvatarProcessInQueue({ filename: avatar.filename, fileUrl: avatar.fileUrl })
    } catch (err) {
      logger.warn('Cannot process remote avatar %s.', avatar.fileUrl, { err })
      return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
    }

    avatar.onDisk = true
    avatar.save()
      .catch(err => logger.error('Cannot save new avatar disk state.', { err }))
  }

  const path = avatar.getPath()

  avatarPathUnsafeCache.set(filename, path)
  return res.sendFile(path, { maxAge: STATIC_MAX_AGE.LAZY_SERVER })
}

async function getPreview (req: express.Request, res: express.Response) {
  const result = await VideosPreviewCache.Instance.getFilePath(req.params.filename)
  if (!result) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  return res.sendFile(result.path, { maxAge: STATIC_MAX_AGE.LAZY_SERVER })
}

async function getVideoCaption (req: express.Request, res: express.Response) {
  const result = await VideosCaptionCache.Instance.getFilePath(req.params.filename)
  if (!result) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  return res.sendFile(result.path, { maxAge: STATIC_MAX_AGE.LAZY_SERVER })
}

async function getTorrent (req: express.Request, res: express.Response) {
  const result = await VideosTorrentCache.Instance.getFilePath(req.params.filename)
  if (!result) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  // Torrents still use the old naming convention (video uuid + .torrent)
  return res.sendFile(result.path, { maxAge: STATIC_MAX_AGE.SERVER })
}
