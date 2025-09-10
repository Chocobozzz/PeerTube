import { HttpStatusCode } from '@peertube/peertube-models'
import { injectQueryToPlaylistUrls } from '@server/lib/hls.js'
import {
  asyncMiddleware,
  ensureCanAccessPrivateVideoHLSFiles,
  ensureCanAccessVideoPrivateWebVideoFiles,
  handleStaticError,
  optionalAuthenticate,
  privateHLSFileValidator,
  privateM3U8PlaylistValidator
} from '@server/middlewares/index.js'
import cors from 'cors'
import express from 'express'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { CONFIG } from '../initializers/config.js'
import { DIRECTORIES, STATIC_PATHS } from '../initializers/constants.js'
import { buildReinjectVideoFileTokenQuery, doReinjectVideoFileToken } from './shared/m3u8-playlist.js'

const staticRouter = express.Router()

// Cors is very important to let other servers access torrent and video files
staticRouter.use(cors())

// ---------------------------------------------------------------------------
// Web videos/Classic videos
// ---------------------------------------------------------------------------

const privateWebVideoStaticMiddlewares = CONFIG.STATIC_FILES.PRIVATE_FILES_REQUIRE_AUTH === true
  ? [ optionalAuthenticate, asyncMiddleware(ensureCanAccessVideoPrivateWebVideoFiles) ]
  : []

staticRouter.use(
  [ STATIC_PATHS.PRIVATE_WEB_VIDEOS, STATIC_PATHS.LEGACY_PRIVATE_WEB_VIDEOS ],
  ...privateWebVideoStaticMiddlewares,
  express.static(DIRECTORIES.WEB_VIDEOS.PRIVATE, { fallthrough: false }),
  handleStaticError
)
staticRouter.use(
  [ STATIC_PATHS.WEB_VIDEOS, STATIC_PATHS.LEGACY_WEB_VIDEOS ],
  express.static(DIRECTORIES.WEB_VIDEOS.PUBLIC, { fallthrough: false }),
  handleStaticError
)

staticRouter.use(
  STATIC_PATHS.REDUNDANCY,
  express.static(CONFIG.STORAGE.REDUNDANCY_DIR, { fallthrough: false }),
  handleStaticError
)

// ---------------------------------------------------------------------------
// HLS
// ---------------------------------------------------------------------------

const privateHLSStaticMiddlewares = CONFIG.STATIC_FILES.PRIVATE_FILES_REQUIRE_AUTH === true
  ? [ optionalAuthenticate, asyncMiddleware(ensureCanAccessPrivateVideoHLSFiles) ]
  : []

staticRouter.use(
  STATIC_PATHS.STREAMING_PLAYLISTS.PRIVATE_HLS + ':videoUUID/:playlistNameWithoutExtension([a-z0-9-]+).m3u8',
  privateM3U8PlaylistValidator,
  ...privateHLSStaticMiddlewares,
  asyncMiddleware(servePrivateM3U8)
)

staticRouter.use(
  STATIC_PATHS.STREAMING_PLAYLISTS.PRIVATE_HLS + ':videoUUID/:filename',
  privateHLSFileValidator,
  ...privateHLSStaticMiddlewares,
  servePrivateHLSFile
)
// ---------------------------------------------------------------------------

staticRouter.use(
  STATIC_PATHS.STREAMING_PLAYLISTS.HLS,
  express.static(DIRECTORIES.HLS_STREAMING_PLAYLIST.PUBLIC, { fallthrough: false }),
  handleStaticError
)

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------

staticRouter.use(
  STATIC_PATHS.UPLOAD_IMAGES,
  express.static(DIRECTORIES.UPLOAD_IMAGES, { fallthrough: false }),
  handleStaticError
)

export {
  staticRouter
}

// ---------------------------------------------------------------------------

function servePrivateHLSFile (req: express.Request, res: express.Response) {
  const path = join(DIRECTORIES.HLS_STREAMING_PLAYLIST.PRIVATE, req.params.videoUUID, req.params.filename)

  return res.sendFile(path)
}

async function servePrivateM3U8 (req: express.Request, res: express.Response) {
  const path = join(DIRECTORIES.HLS_STREAMING_PLAYLIST.PRIVATE, req.params.videoUUID, req.params.playlistNameWithoutExtension + '.m3u8')
  const filename = req.params.playlistNameWithoutExtension + '.m3u8'

  let playlistContent: string

  try {
    playlistContent = await readFile(path, 'utf-8')
  } catch (err) {
    if (err.message.includes('ENOENT')) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'File not found'
      })
    }

    throw err
  }

  // Inject token in playlist so players that cannot alter the HTTP request can still watch the video
  const transformedContent = doReinjectVideoFileToken(req)
    ? injectQueryToPlaylistUrls(playlistContent, buildReinjectVideoFileTokenQuery(req, filename.endsWith('master.m3u8')))
    : playlistContent

  return res.set('content-type', 'application/x-mpegurl; charset=utf-8').send(transformedContent).end()
}
