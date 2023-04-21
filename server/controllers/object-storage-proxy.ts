import cors from 'cors'
import express from 'express'
import { OBJECT_STORAGE_PROXY_PATHS } from '@server/initializers/constants'
import { proxifyHLS, proxifyWebTorrentFile } from '@server/lib/object-storage'
import {
  asyncMiddleware,
  ensureCanAccessPrivateVideoHLSFiles,
  ensureCanAccessVideoPrivateWebTorrentFiles,
  ensurePrivateObjectStorageProxyIsEnabled,
  optionalAuthenticate
} from '@server/middlewares'
import { doReinjectVideoFileToken } from './shared/m3u8-playlist'

const objectStorageProxyRouter = express.Router()

objectStorageProxyRouter.use(cors())

objectStorageProxyRouter.get(OBJECT_STORAGE_PROXY_PATHS.PRIVATE_WEBSEED + ':filename',
  ensurePrivateObjectStorageProxyIsEnabled,
  optionalAuthenticate,
  asyncMiddleware(ensureCanAccessVideoPrivateWebTorrentFiles),
  asyncMiddleware(proxifyWebTorrentController)
)

objectStorageProxyRouter.get(OBJECT_STORAGE_PROXY_PATHS.STREAMING_PLAYLISTS.PRIVATE_HLS + ':videoUUID/:filename',
  ensurePrivateObjectStorageProxyIsEnabled,
  optionalAuthenticate,
  asyncMiddleware(ensureCanAccessPrivateVideoHLSFiles),
  asyncMiddleware(proxifyHLSController)
)

// ---------------------------------------------------------------------------

export {
  objectStorageProxyRouter
}

function proxifyWebTorrentController (req: express.Request, res: express.Response) {
  const filename = req.params.filename

  return proxifyWebTorrentFile({ req, res, filename })
}

function proxifyHLSController (req: express.Request, res: express.Response) {
  const playlist = res.locals.videoStreamingPlaylist
  const video = res.locals.onlyVideo
  const filename = req.params.filename

  const reinjectVideoFileToken = filename.endsWith('.m3u8') && doReinjectVideoFileToken(req)

  return proxifyHLS({
    req,
    res,
    playlist,
    video,
    filename,
    reinjectVideoFileToken
  })
}
