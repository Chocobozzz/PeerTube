import express from 'express'
import { VideoImportModel } from '@server/models/video/video-import.js'
import { HttpStatusCode } from '@peertube/peertube-models'
import { MVideoImportDefault } from '@server/types/models/index.js'

export async function doesVideoImportExist (id: number, res: express.Response) {
  return checkVideoImportExists(await VideoImportModel.loadAndPopulateVideo(id), res)
}

export async function doesVideoImportOfVideoExist (videoId: number, res: express.Response) {
  return checkVideoImportExists(await VideoImportModel.loadByVideoIdAndPopulateVideo(videoId), res)
}

// ---------------------------------------------------------------------------

function checkVideoImportExists (videoImport: MVideoImportDefault, res: express.Response) {
  if (!videoImport) {
    res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: 'Video import not found'
    })
    return false
  }

  res.locals.videoImport = videoImport
  return true
}
