import { injectQueryToPlaylistUrls } from '@server/lib/hls.js'
import {
  asyncMiddleware,
  ensureCanAccessPrivateVideoHLSFiles,
  ensureCanAccessVideoPrivateWebVideoFiles,
  handleStaticError,
  hlsFileValidator,
  optionalAuthenticate,
  privateM3U8PlaylistValidator
} from '@server/middlewares/index.js'
import cors from 'cors'
import express from 'express'
import { readJSON } from 'fs-extra/esm'
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
  asyncMiddleware(servePrivateM3U8),
  handleStaticError
)

// segments-sha256.json is frequently rewritten (on every new live segment), so we can't rely on express.static/sendFile
// (stat + range read) that could read a truncated file if it's overwritten between the stat and the read
staticRouter.use(
  STATIC_PATHS.STREAMING_PLAYLISTS.PRIVATE_HLS + ':videoUUID/:filename([a-z0-9-]*segments-sha256\\.json)',
  hlsFileValidator,
  ...privateHLSStaticMiddlewares,
  asyncMiddleware(serveSha256Segments(DIRECTORIES.HLS_STREAMING_PLAYLIST.PRIVATE)),
  handleStaticError
)

staticRouter.use(
  STATIC_PATHS.STREAMING_PLAYLISTS.PRIVATE_HLS + ':videoUUID/:filename',
  hlsFileValidator,
  ...privateHLSStaticMiddlewares,
  servePrivateHLSFile,
  handleStaticError
)
// ---------------------------------------------------------------------------

// Same as above: avoid express.static for this frequently rewritten file to prevent serving truncated content
staticRouter.use(
  STATIC_PATHS.STREAMING_PLAYLISTS.HLS + '/:videoUUID/:filename([a-z0-9-]*segments-sha256\\.json)',
  hlsFileValidator,
  asyncMiddleware(serveSha256Segments(DIRECTORIES.HLS_STREAMING_PLAYLIST.PUBLIC)),
  handleStaticError
)

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

function serveSha256Segments (baseDirectory: string) {
  return async (req: express.Request, res: express.Response) => {
    const path = join(baseDirectory, req.params.videoUUID, req.params.filename)

    return res.json(await readJSON(path))
  }
}

async function servePrivateM3U8 (req: express.Request, res: express.Response) {
  const path = join(DIRECTORIES.HLS_STREAMING_PLAYLIST.PRIVATE, req.params.videoUUID, req.params.playlistNameWithoutExtension + '.m3u8')
  const filename = req.params.playlistNameWithoutExtension + '.m3u8'

  const playlistContent = await readFile(path, 'utf-8')

  // Inject token in playlist so players that cannot alter the HTTP request can still watch the video
  const transformedContent = doReinjectVideoFileToken(req)
    ? injectQueryToPlaylistUrls(playlistContent, buildReinjectVideoFileTokenQuery(req, filename.endsWith('master.m3u8')))
    : playlistContent

  return res.set('content-type', 'application/x-mpegurl; charset=utf-8').send(transformedContent).end()
}
