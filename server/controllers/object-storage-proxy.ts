import cors from 'cors'
import express from 'express'
import { PassThrough, pipeline } from 'stream'
import { logger } from '@server/helpers/logger'
import { StreamReplacer } from '@server/helpers/stream-replacer'
import { OBJECT_STORAGE_PROXY_PATHS } from '@server/initializers/constants'
import { injectQueryToPlaylistUrls } from '@server/lib/hls'
import { getHLSFileReadStream, getWebTorrentFileReadStream } from '@server/lib/object-storage'
import {
  asyncMiddleware,
  ensureCanAccessPrivateVideoHLSFiles,
  ensureCanAccessVideoPrivateWebTorrentFiles,
  ensurePrivateObjectStorageProxyIsEnabled,
  optionalAuthenticate
} from '@server/middlewares'
import { HttpStatusCode } from '@shared/models'
import { buildReinjectVideoFileTokenQuery, doReinjectVideoFileToken } from './shared/m3u8-playlist'
import { GetObjectCommandOutput } from '@aws-sdk/client-s3'

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
    const { response: s3Response, stream } = await getWebTorrentFileReadStream({
      filename,
      rangeHeader: req.header('range')
    })

    setS3Headers(res, s3Response)

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
    const { response: s3Response, stream } = await getHLSFileReadStream({
      playlist: playlist.withVideo(video),
      filename,
      rangeHeader: req.header('range')
    })

    setS3Headers(res, s3Response)

    const streamReplacer = filename.endsWith('.m3u8') && doReinjectVideoFileToken(req)
      ? new StreamReplacer(line => injectQueryToPlaylistUrls(line, buildReinjectVideoFileTokenQuery(req, filename.endsWith('master.m3u8'))))
      : new PassThrough()

    return pipeline(
      stream,
      streamReplacer,
      res,
      err => {
        if (!err) return

        handleObjectStorageFailure(res, err)
      }
    )
  } catch (err) {
    return handleObjectStorageFailure(res, err)
  }
}

function handleObjectStorageFailure (res: express.Response, err: Error) {
  if (err.name === 'NoSuchKey') {
    logger.debug('Could not find key in object storage to proxify private HLS video file.', { err })
    return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  }

  return res.fail({
    status: HttpStatusCode.INTERNAL_SERVER_ERROR_500,
    message: err.message,
    type: err.name
  })
}

function setS3Headers (res: express.Response, s3Response: GetObjectCommandOutput) {
  if (s3Response.$metadata.httpStatusCode === HttpStatusCode.PARTIAL_CONTENT_206) {
    res.setHeader('Content-Range', s3Response.ContentRange)
    res.status(HttpStatusCode.PARTIAL_CONTENT_206)
  }
}
