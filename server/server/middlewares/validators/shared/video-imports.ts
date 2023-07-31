import express from 'express'
import { VideoImportModel } from '@server/models/video/video-import.js'
import { HttpStatusCode } from '@peertube/peertube-models'

async function doesVideoImportExist (id: number, res: express.Response) {
  const videoImport = await VideoImportModel.loadAndPopulateVideo(id)

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

export {
  doesVideoImportExist
}
