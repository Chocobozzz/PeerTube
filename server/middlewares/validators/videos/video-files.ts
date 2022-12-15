import express from 'express'
import { param } from 'express-validator'
import { isIdValid } from '@server/helpers/custom-validators/misc'
import { MVideo } from '@server/types/models'
import { HttpStatusCode } from '@shared/models'
import { areValidationErrors, doesVideoExist, isValidVideoIdParam } from '../shared'

const videoFilesDeleteWebTorrentValidator = [
  isValidVideoIdParam('id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.id, res)) return

    const video = res.locals.videoAll

    if (!checkLocalVideo(video, res)) return

    if (!video.hasWebTorrentFiles()) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'This video does not have WebTorrent files'
      })
    }

    if (!video.getHLSPlaylist()) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'Cannot delete WebTorrent files since this video does not have HLS playlist'
      })
    }

    return next()
  }
]

const videoFilesDeleteWebTorrentFileValidator = [
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
        message: 'This video does not have this WebTorrent file id'
      })
    }

    if (files.length === 1 && !video.getHLSPlaylist()) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'Cannot delete WebTorrent files since this video does not have HLS playlist'
      })
    }

    return next()
  }
]

// ---------------------------------------------------------------------------

const videoFilesDeleteHLSValidator = [
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

    if (!video.hasWebTorrentFiles()) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'Cannot delete HLS playlist since this video does not have WebTorrent files'
      })
    }

    return next()
  }
]

const videoFilesDeleteHLSFileValidator = [
  isValidVideoIdParam('id'),

  param('videoFileId')
    .custom(isIdValid),

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

    const hlsFiles = video.getHLSPlaylist().VideoFiles
    if (!hlsFiles.find(f => f.id === +req.params.videoFileId)) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'This HLS playlist does not have this file id'
      })
    }

    // Last file to delete
    if (hlsFiles.length === 1 && !video.hasWebTorrentFiles()) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'Cannot delete last HLS playlist file since this video does not have WebTorrent files'
      })
    }

    return next()
  }
]

export {
  videoFilesDeleteWebTorrentValidator,
  videoFilesDeleteWebTorrentFileValidator,

  videoFilesDeleteHLSValidator,
  videoFilesDeleteHLSFileValidator
}

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
