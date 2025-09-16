import { HttpStatusCode, UserRight } from '@peertube/peertube-models'
import { checkCanManageAccount } from '@server/middlewares/validators/shared/users.js'
import { MUserAccountId } from '@server/types/models/index.js'
import { MVideoChangeOwnershipFull } from '@server/types/models/video/video-change-ownership.js'
import { Request, Response } from 'express'

export function checkCanTerminateOwnershipChange (options: {
  user: MUserAccountId
  videoChangeOwnership: MVideoChangeOwnershipFull
  req: Request
  res: Response
}) {
  const { user, videoChangeOwnership, req, res } = options

  if (!checkCanManageAccount({ user, account: videoChangeOwnership.NextOwner, req, res: null, specialRight: UserRight.MANAGE_USERS })) {
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: req.t('Cannot terminate an ownership change of another user')
    })

    return false
  }

  return true
}
