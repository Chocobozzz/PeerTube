import cors from 'cors'
import express from 'express'
import { readFile } from 'fs-extra'
import { join } from 'path'
import { injectQueryToPlaylistUrls } from '@server/lib/hls'
import {
  asyncMiddleware,
  ensureCanAccessPrivateVideoHLSFiles,
  ensureCanAccessVideoPrivateWebTorrentFiles,
  handleStaticError,
  optionalAuthenticate
} from '@server/middlewares'
import { HttpStatusCode } from '@shared/models'
import { CONFIG } from '../initializers/config'
import { DIRECTORIES, STATIC_MAX_AGE, STATIC_PATHS } from '../initializers/constants'
import { buildReinjectVideoFileTokenQuery, doReinjectVideoFileToken } from './shared/m3u8-playlist'

const staticRouter = express.Router()

// Cors is very important to let other servers access torrent and video files
staticRouter.use(cors())

// ---------------------------------------------------------------------------
// WebTorrent/Classic videos
// ---------------------------------------------------------------------------

const privateWebTorrentStaticMiddlewares = CONFIG.STATIC_FILES.PRIVATE_FILES_REQUIRE_AUTH === true
  ? [ optionalAuthenticate, asyncMiddleware(ensureCanAccessVideoPrivateWebTorrentFiles) ]
  : []

staticRouter.use(
  STATIC_PATHS.PRIVATE_WEBSEED,
  ...privateWebTorrentStaticMiddlewares,
  express.static(DIRECTORIES.VIDEOS.PRIVATE, { fallthrough: false }),
  handleStaticError
)
staticRouter.use(
  STATIC_PATHS.WEBSEED,
  express.static(DIRECTORIES.VIDEOS.PUBLIC, { fallthrough: false }),
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
  STATIC_PATHS.STREAMING_PLAYLISTS.PRIVATE_HLS + ':videoUUID/:playlistName.m3u8',
  ...privateHLSStaticMiddlewares,
  asyncMiddleware(servePrivateM3U8)
)

staticRouter.use(
  STATIC_PATHS.STREAMING_PLAYLISTS.PRIVATE_HLS,
  ...privateHLSStaticMiddlewares,
  express.static(DIRECTORIES.HLS_STREAMING_PLAYLIST.PRIVATE, { fallthrough: false }),
  handleStaticError
)
staticRouter.use(
  STATIC_PATHS.STREAMING_PLAYLISTS.HLS,
  express.static(DIRECTORIES.HLS_STREAMING_PLAYLIST.PUBLIC, { fallthrough: false }),
  handleStaticError
)

// FIXME: deprecated in v6, to remove
const thumbnailsPhysicalPath = CONFIG.STORAGE.THUMBNAILS_DIR
staticRouter.use(
  STATIC_PATHS.THUMBNAILS,
  express.static(thumbnailsPhysicalPath, { maxAge: STATIC_MAX_AGE.SERVER, fallthrough: false }),
  handleStaticError
)

// ---------------------------------------------------------------------------

export {
  staticRouter
}

// ---------------------------------------------------------------------------

async function servePrivateM3U8 (req: express.Request, res: express.Response) {
  const path = join(DIRECTORIES.HLS_STREAMING_PLAYLIST.PRIVATE, req.params.videoUUID, req.params.playlistName + '.m3u8')
  const filename = req.params.playlistName + '.m3u8'

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

  return res.set('content-type', 'application/vnd.apple.mpegurl').send(transformedContent).end()
}
