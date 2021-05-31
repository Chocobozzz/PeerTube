import { Response } from 'express'
import { VideoChangeOwnershipModel } from '../../models/video/video-change-ownership'
import { MVideoChangeOwnershipFull } from '@server/types/models/video/video-change-ownership'
import { MUserId } from '@server/types/models'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

export async function doesChangeVideoOwnershipExist (idArg: number | string, res: Response) {
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

export function checkUserCanTerminateOwnershipChange (user: MUserId, videoChangeOwnership: MVideoChangeOwnershipFull, res: Response) {
  if (videoChangeOwnership.NextOwner.userId === user.id) {
    return true
  }

  res.fail({
    status: HttpStatusCode.FORBIDDEN_403,
    message: 'Cannot terminate an ownership change of another user'
  })
  return false
}
