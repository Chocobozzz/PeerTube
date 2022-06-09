import * as express from 'express'
import { VideoChangeOwnershipModel } from '@server/models/video/video-change-ownership'
import { HttpStatusCode } from '@shared/core-utils'

async function doesChangeVideoOwnershipExist (idArg: number | string, res: express.Response) {
  const id = parseInt(idArg + '', 10)
  const videoChangeOwnership = await VideoChangeOwnershipModel.load(id)

  if (!videoChangeOwnership) {
    res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: 'Video change ownership not found'
    })
    return false
  }

  res.locals.videoChangeOwnership = videoChangeOwnership

  return true
}

export {
  doesChangeVideoOwnershipExist
}
