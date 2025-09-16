import { HttpStatusCode, VideoChannelCollaboratorState } from '@peertube/peertube-models'
import { retryTransactionWrapper, saveInTransactionWithRetries } from '@server/helpers/database-utils.js'
import { getFormattedObjects } from '@server/helpers/utils.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import {
  channelAcceptOrRejectInviteCollaboratorsValidator,
  channelDeleteInviteCollaboratorsValidator,
  channelInviteCollaboratorsValidator,
  channelListCollaboratorsValidator
} from '@server/middlewares/validators/videos/video-channel-collaborators.js'
import { VideoChannelCollaboratorModel } from '@server/models/video/video-channel-collaborator.js'
import { MChannelCollaboratorAccount } from '@server/types/models/index.js'
import express from 'express'
import { asyncMiddleware, authenticate } from '../../../middlewares/index.js'

const channelCollaborators = express.Router()

channelCollaborators.get(
  '/:handle/collaborators',
  authenticate,
  asyncMiddleware(channelListCollaboratorsValidator),
  asyncMiddleware(listCollaborators)
)

channelCollaborators.post(
  '/:handle/collaborators/invite',
  authenticate,
  asyncMiddleware(channelInviteCollaboratorsValidator),
  asyncMiddleware(inviteCollaborator)
)

channelCollaborators.post(
  '/:handle/collaborators/:collaboratorId/accept',
  authenticate,
  asyncMiddleware(channelAcceptOrRejectInviteCollaboratorsValidator),
  asyncMiddleware(acceptCollaboratorInvite)
)

channelCollaborators.post(
  '/:handle/collaborators/:collaboratorId/reject',
  authenticate,
  asyncMiddleware(channelAcceptOrRejectInviteCollaboratorsValidator),
  asyncMiddleware(rejectCollaboratorInvite)
)

channelCollaborators.delete(
  '/:handle/collaborators/:collaboratorId',
  authenticate,
  asyncMiddleware(channelDeleteInviteCollaboratorsValidator),
  asyncMiddleware(removeCollaborator)
)

// ---------------------------------------------------------------------------

export {
  channelCollaborators
}

// ---------------------------------------------------------------------------

async function listCollaborators (req: express.Request, res: express.Response) {
  const resultList = await VideoChannelCollaboratorModel.listForApi({
    channelId: res.locals.videoChannel.id,
    start: 0,
    count: 100,
    sort: '-createdAt'
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function inviteCollaborator (req: express.Request, res: express.Response) {
  const collaborator = new VideoChannelCollaboratorModel({
    state: VideoChannelCollaboratorState.PENDING,
    accountId: res.locals.account.id,
    channelId: res.locals.videoChannel.id
  }) as MChannelCollaboratorAccount

  await saveInTransactionWithRetries(collaborator)
  collaborator.Account = res.locals.account

  // send notification

  return res.json(collaborator.toFormattedJSON())
}

async function acceptCollaboratorInvite (req: express.Request, res: express.Response) {
  const collaborator = res.locals.channelCollaborator
  collaborator.state = VideoChannelCollaboratorState.ACCEPTED

  await saveInTransactionWithRetries(collaborator)

  // send notification

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function rejectCollaboratorInvite (req: express.Request, res: express.Response) {
  const collaborator = res.locals.channelCollaborator
  collaborator.state = VideoChannelCollaboratorState.REJECTED

  await saveInTransactionWithRetries(collaborator)

  // send notification

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function removeCollaborator (req: express.Request, res: express.Response) {
  const collaborator = res.locals.channelCollaborator

  await retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction(async t => {
      await collaborator.destroy({ transaction: t })
    })
  })

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}
