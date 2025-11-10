import express from 'express'
import { VideoChangeOwnershipModel } from '@server/models/video/video-change-ownership.js'
import { forceNumber } from '@peertube/peertube-core-utils'
import { HttpStatusCode } from '@peertube/peertube-models'

export async function doesChangeVideoOwnershipExist (idArg: number | string, req: express.Request, res: express.Response) {
  const id = forceNumber(idArg)
  const videoChangeOwnership = await VideoChangeOwnershipModel.load(id)

  if (!videoChangeOwnership) {
    res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: req.t('Video ownership change not found')
    })
    return false
  }

  res.locals.videoChangeOwnership = videoChangeOwnership

  return true
}
