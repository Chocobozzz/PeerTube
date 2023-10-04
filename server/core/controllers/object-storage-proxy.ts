import cors from 'cors'
import express from 'express'
import { OBJECT_STORAGE_PROXY_PATHS } from '@server/initializers/constants.js'
import { proxifyHLS, proxifyWebVideoFile } from '@server/lib/object-storage/index.js'
import {
  asyncMiddleware,
  ensureCanAccessPrivateVideoHLSFiles,
  ensureCanAccessVideoPrivateWebVideoFiles,
  ensurePrivateObjectStorageProxyIsEnabled,
  optionalAuthenticate
} from '@server/middlewares/index.js'
import { doReinjectVideoFileToken } from './shared/m3u8-playlist.js'

const objectStorageProxyRouter = express.Router()

objectStorageProxyRouter.use(cors())

objectStorageProxyRouter.get(
  [ OBJECT_STORAGE_PROXY_PATHS.PRIVATE_WEB_VIDEOS + ':filename', OBJECT_STORAGE_PROXY_PATHS.LEGACY_PRIVATE_WEB_VIDEOS + ':filename' ],
  ensurePrivateObjectStorageProxyIsEnabled,
  optionalAuthenticate,
  asyncMiddleware(ensureCanAccessVideoPrivateWebVideoFiles),
  asyncMiddleware(proxifyWebVideoController)
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

function proxifyWebVideoController (req: express.Request, res: express.Response) {
  const filename = req.params.filename

  return proxifyWebVideoFile({ req, res, filename })
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
