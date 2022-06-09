import { Response } from 'express'
import { MUserId } from '@server/types/models'
import { MVideoChangeOwnershipFull } from '@server/types/models/video/video-change-ownership'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

function checkUserCanTerminateOwnershipChange (user: MUserId, videoChangeOwnership: MVideoChangeOwnershipFull, res: Response) {
  if (videoChangeOwnership.NextOwner.userId === user.id) {
    return true
  }

  res.fail({
    status: HttpStatusCode.FORBIDDEN_403,
    message: 'Cannot terminate an ownership change of another user'
  })
  return false
}

export {
  checkUserCanTerminateOwnershipChange
}
