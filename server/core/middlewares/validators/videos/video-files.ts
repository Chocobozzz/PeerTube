import { HttpStatusCode, VideoResolution } from '@peertube/peertube-models'
import { isIdValid } from '@server/helpers/custom-validators/misc.js'
import { MVideo } from '@server/types/models/index.js'
import express from 'express'
import { param } from 'express-validator'
import { areValidationErrors, doesVideoExist, isValidVideoIdParam } from '../shared/index.js'

export const videoFilesDeleteWebVideoValidator = [
  isValidVideoIdParam('id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.id, res)) return

    const video = res.locals.videoAll

    if (!checkLocalVideo(video, res)) return

    if (!video.hasWebVideoFiles()) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'This video does not have Web Video files'
      })
    }

    if (!video.getHLSPlaylist()) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'Cannot delete Web Video files since this video does not have HLS playlist'
      })
    }

    return next()
  }
]

export const videoFilesDeleteWebVideoFileValidator = [
  isValidVideoIdParam('id'),

  param('videoFileId')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.id, res)) return

    const video = res.locals.videoAll

    if (!checkLocalVideo(video, res)) return

    const files = video.VideoFiles
    if (!files.find(f => f.id === +req.params.videoFileId)) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'This video does not have this Web Video file id'
      })
    }

    if (files.length === 1 && !video.getHLSPlaylist()) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'Cannot delete Web Video files since this video does not have HLS playlist'
      })
    }

    return next()
  }
]

// ---------------------------------------------------------------------------

export const videoFilesDeleteHLSValidator = [
  isValidVideoIdParam('id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.id, res)) return

    const video = res.locals.videoAll

    if (!checkLocalVideo(video, res)) return

    if (!video.getHLSPlaylist()) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'This video does not have HLS files'
      })
    }

    if (!video.hasWebVideoFiles()) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'Cannot delete HLS playlist since this video does not have Web Video files'
      })
    }

    return next()
  }
]

export const videoFilesDeleteHLSFileValidator = [
  isValidVideoIdParam('id'),

  param('videoFileId')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.id, res)) return

    const video = res.locals.videoAll

    if (!checkLocalVideo(video, res)) return

    const hls = video.getHLSPlaylist()

    if (!hls) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'This video does not have HLS files'
      })
    }

    const hlsFiles = hls.VideoFiles
    const file = hlsFiles.find(f => f.id === +req.params.videoFileId)

    if (!file) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'This HLS playlist does not have this file id'
      })
    }

    // Last file to delete
    if (hlsFiles.length === 1 && !video.hasWebVideoFiles()) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'Cannot delete last HLS playlist file since this video does not have Web Video files'
      })
    }

    if (hls.hasAudioAndVideoSplitted() && file.resolution === VideoResolution.H_NOVIDEO) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'Cannot delete audio file of HLS playlist with splitted audio/video. Delete all the videos first'
      })
    }

    return next()
  }
]

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function checkLocalVideo (video: MVideo, res: express.Response) {
  if (video.remote) {
    res.fail({
      status: HttpStatusCode.BAD_REQUEST_400,
      message: 'Cannot delete files of remote video'
    })

    return false
  }

  return true
}
