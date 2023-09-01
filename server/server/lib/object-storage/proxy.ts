import express from 'express'
import { PassThrough, pipeline } from 'stream'
import { HttpStatusCode } from '@peertube/peertube-models'
import { buildReinjectVideoFileTokenQuery } from '@server/controllers/shared/m3u8-playlist.js'
import { logger } from '@server/helpers/logger.js'
import { StreamReplacer } from '@server/helpers/stream-replacer.js'
import { MStreamingPlaylist, MVideo } from '@server/types/models/index.js'
import { injectQueryToPlaylistUrls } from '../hls.js'
import { getHLSFileReadStream, getWebVideoFileReadStream } from './videos.js'

import type { GetObjectCommandOutput } from '@aws-sdk/client-s3'

export async function proxifyWebVideoFile (options: {
  req: express.Request
  res: express.Response
  filename: string
}) {
  const { req, res, filename } = options

  logger.debug('Proxifying Web Video file %s from object storage.', filename)

  try {
    const { response: s3Response, stream } = await getWebVideoFileReadStream({
      filename,
      rangeHeader: req.header('range')
    })

    setS3Headers(res, s3Response)

    return stream.pipe(res)
  } catch (err) {
    return handleObjectStorageFailure(res, err)
  }
}

export async function proxifyHLS (options: {
  req: express.Request
  res: express.Response
  playlist: MStreamingPlaylist
  video: MVideo
  filename: string
  reinjectVideoFileToken: boolean
}) {
  const { req, res, playlist, video, filename, reinjectVideoFileToken } = options

  logger.debug('Proxifying HLS file %s from object storage.', filename)

  try {
    const { response: s3Response, stream } = await getHLSFileReadStream({
      playlist: playlist.withVideo(video),
      filename,
      rangeHeader: req.header('range')
    })

    setS3Headers(res, s3Response)

    const streamReplacer = reinjectVideoFileToken
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

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function handleObjectStorageFailure (res: express.Response, err: Error) {
  if (err.name === 'NoSuchKey') {
    logger.debug('Could not find key in object storage to proxify private HLS video file.', { err })
    return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  }

  logger.error('Object storage failure', { err })

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
