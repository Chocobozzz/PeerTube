import express from 'express'
import { logger } from '@server/helpers/logger'
import { getVideoStreamDuration } from '@shared/ffmpeg'
import { HttpStatusCode } from '@shared/models'

export async function addDurationToVideoFileIfNeeded (options: {
  res: express.Response
  videoFile: { path: string, duration?: number }
  middlewareName: string
}) {
  const { res, middlewareName, videoFile } = options

  try {
    if (!videoFile.duration) await addDurationToVideo(videoFile)
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

async function addDurationToVideo (videoFile: { path: string, duration?: number }) {
  const duration = await getVideoStreamDuration(videoFile.path)

  // FFmpeg may not be able to guess video duration
  // For example with m2v files: https://trac.ffmpeg.org/ticket/9726#comment:2
  if (isNaN(duration)) videoFile.duration = 0
  else videoFile.duration = duration
}
