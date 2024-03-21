import express from 'express'
import { logger } from '@server/helpers/logger.js'
import { ffprobePromise, getVideoStreamDuration } from '@peertube/peertube-ffmpeg'
import { HttpStatusCode } from '@peertube/peertube-models'

export async function addDurationToVideoFileIfNeeded (options: {
  res: express.Response
  videoFile: { path: string, duration?: number }
  middlewareName: string
}) {
  const { res, middlewareName, videoFile } = options

  try {
    if (!videoFile.duration) await addDurationToVideo(res, videoFile)
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

async function addDurationToVideo (res: express.Response, videoFile: { path: string, duration?: number }) {
  const probe = await ffprobePromise(videoFile.path)
  res.locals.ffprobe = probe

  const duration = await getVideoStreamDuration(videoFile.path, probe)

  // FFmpeg may not be able to guess video duration
  // For example with m2v files: https://trac.ffmpeg.org/ticket/9726#comment:2
  if (isNaN(duration)) videoFile.duration = 0
  else videoFile.duration = duration
}
