import { ffprobePromise, getVideoStreamDuration } from '@peertube/peertube-ffmpeg'
import { HttpStatusCode } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import express, { VideoUploadMetadata } from 'express'

const logger = createLogger()

export async function addDurationToVideoFileIfNeeded (options: {
  res: express.Response
  uploadFile: VideoUploadMetadata
  middlewareName: string
}) {
  const { res, middlewareName, uploadFile } = options

  try {
    if (!uploadFile.duration) await addDurationToVideo(res, uploadFile)
  } catch (err) {
    logger.error('Invalid input file in ' + middlewareName, { err })

    res.fail({
      status: HttpStatusCode.UNPROCESSABLE_ENTITY_422,
      message: 'Video file unreadable.'
    })
    return false
  }

  return true
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function addDurationToVideo (res: express.Response, uploadFile: VideoUploadMetadata) {
  // Fallback to `path` for legacy upload
  const input = uploadFile.ffmpegInput ?? uploadFile.path

  const probe = await ffprobePromise(input)
  res.locals.ffprobe = probe

  const duration = await getVideoStreamDuration(input, probe)

  // FFmpeg may not be able to guess video duration
  // For example with m2v files: https://trac.ffmpeg.org/ticket/9726#comment:2
  if (isNaN(duration)) uploadFile.duration = 0
  else uploadFile.duration = duration
}
