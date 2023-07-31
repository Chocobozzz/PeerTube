import { Response } from 'express'
import { HttpStatusCode } from '@peertube/peertube-models'
import { MUserId } from '@server/types/models/index.js'
import { MVideoChangeOwnershipFull } from '@server/types/models/video/video-change-ownership.js'

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
