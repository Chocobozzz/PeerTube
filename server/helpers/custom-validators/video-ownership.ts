import { Response } from 'express'
import * as validator from 'validator'
import { VideoChangeOwnershipModel } from '../../models/video/video-change-ownership'
import { UserModel } from '../../models/account/user'

export async function doesChangeVideoOwnershipExist (id: string, res: Response): Promise<boolean> {
  const videoChangeOwnership = await loadVideoChangeOwnership(id)

  if (!videoChangeOwnership) {
    res.status(404)
      .json({ error: 'Video change ownership not found' })
      .end()

    return false
  }

  res.locals.videoChangeOwnership = videoChangeOwnership
  return true
}

async function loadVideoChangeOwnership (id: string): Promise<VideoChangeOwnershipModel | undefined> {
  if (validator.isInt(id)) {
    return VideoChangeOwnershipModel.load(parseInt(id, 10))
  }

  return undefined
}

export function checkUserCanTerminateOwnershipChange (
  user: UserModel,
  videoChangeOwnership: VideoChangeOwnershipModel,
  res: Response
): boolean {
  if (videoChangeOwnership.NextOwner.userId === user.id) {
    return true
  }

  res.status(403)
    .json({ error: 'Cannot terminate an ownership change of another user' })
    .end()
  return false
}
