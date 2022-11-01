import cors from 'cors'
import express from 'express'
import { logger } from '@server/helpers/logger'
import { OBJECT_STORAGE_PROXY_PATHS } from '@server/initializers/constants'
import { getHLSFileReadStream, getWebTorrentFileReadStream } from '@server/lib/object-storage'
import {
  asyncMiddleware,
  ensureCanAccessPrivateVideoHLSFiles,
  ensureCanAccessVideoPrivateWebTorrentFiles,
  ensurePrivateObjectStorageProxyIsEnabled,
  optionalAuthenticate
} from '@server/middlewares'
import { HttpStatusCode } from '@shared/models'

const objectStorageProxyRouter = express.Router()

objectStorageProxyRouter.use(cors())

objectStorageProxyRouter.get(OBJECT_STORAGE_PROXY_PATHS.PRIVATE_WEBSEED + ':filename',
  ensurePrivateObjectStorageProxyIsEnabled,
  optionalAuthenticate,
  asyncMiddleware(ensureCanAccessVideoPrivateWebTorrentFiles),
  asyncMiddleware(proxifyWebTorrent)
)

objectStorageProxyRouter.get(OBJECT_STORAGE_PROXY_PATHS.STREAMING_PLAYLISTS.PRIVATE_HLS + ':videoUUID/:filename',
  ensurePrivateObjectStorageProxyIsEnabled,
  optionalAuthenticate,
  asyncMiddleware(ensureCanAccessPrivateVideoHLSFiles),
  asyncMiddleware(proxifyHLS)
)

// ---------------------------------------------------------------------------

export {
  objectStorageProxyRouter
}

async function proxifyWebTorrent (req: express.Request, res: express.Response) {
  const filename = req.params.filename

  logger.debug('Proxifying WebTorrent file %s from object storage.', filename)

  try {
    const stream = await getWebTorrentFileReadStream({
      filename,
      rangeHeader: req.header('range')
    })

    return stream.pipe(res)
  } catch (err) {
    return handleObjectStorageFailure(res, err)
  }
}

async function proxifyHLS (req: express.Request, res: express.Response) {
  const playlist = res.locals.videoStreamingPlaylist
  const video = res.locals.onlyVideo
  const filename = req.params.filename

  logger.debug('Proxifying HLS file %s from object storage.', filename)

  try {
    const stream = await getHLSFileReadStream({
      playlist: playlist.withVideo(video),
      filename,
      rangeHeader: req.header('range')
    })

    return stream.pipe(res)
  } catch (err) {
    return handleObjectStorageFailure(res, err)
  }
}

function handleObjectStorageFailure (res: express.Response, err: Error) {
  if (err.name === 'NoSuchKey') {
    return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  }

  return res.fail({
    status: HttpStatusCode.INTERNAL_SERVER_ERROR_500,
    message: err.message,
    type: err.name
  })
}
