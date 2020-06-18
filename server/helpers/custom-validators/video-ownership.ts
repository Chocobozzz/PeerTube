import { Response } from 'express'
import { VideoChangeOwnershipModel } from '../../models/video/video-change-ownership'
import { MVideoChangeOwnershipFull } from '@server/types/models/video/video-change-ownership'
import { MUserId } from '@server/types/models'

export async function doesChangeVideoOwnershipExist (idArg: number | string, res: Response) {
  const id = parseInt(idArg + '', 10)
  const videoChangeOwnership = await VideoChangeOwnershipModel.load(id)

  if (!videoChangeOwnership) {
    res.status(404)
      .json({ error: 'Video change ownership not found' })
      .end()

    return false
  }

  res.locals.videoChangeOwnership = videoChangeOwnership
  return true
}

export function checkUserCanTerminateOwnershipChange (user: MUserId, videoChangeOwnership: MVideoChangeOwnershipFull, res: Response) {
  if (videoChangeOwnership.NextOwner.userId === user.id) {
    return true
  }

  res.status(403)
    .json({ error: 'Cannot terminate an ownership change of another user' })
    .end()
  return false
}
