import { HttpStatusCode, VideoChannelCollaboratorState } from '@peertube/peertube-models'
import {
  auditLog,
  buildChannelAuditSummary,
  buildChannelCollaboratorAuditEntity,
  getAuditActorFromRes
} from '@server/lib/audit-log/index.js'
import {
  deleteInTransactionWithRetries,
  retryTransactionWrapper,
  runTransaction,
  saveInTransactionWithRetries
} from '@server/helpers/database-utils.js'
import { getFormattedObjects } from '@server/helpers/utils.js'
import { CONFIG } from '@server/initializers/config.js'
import { Notifier } from '@server/lib/notifier/notifier.js'
import {
  channelAcceptOrRejectInviteCollaboratorsValidator,
  channelDeleteCollaboratorsValidator,
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
  asyncMiddleware(channelDeleteCollaboratorsValidator),
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
    // Prefer to use limit of 100 to avoid issues with collaborators list if the admin lowered the config
    count: Math.max(CONFIG.VIDEO_CHANNELS.MAX_COLLABORATORS_PER_CHANNEL, 100),
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

  await retryTransactionWrapper(() => {
    return runTransaction(async transaction => {
      // Existing rejected collaborator
      if (res.locals.channelCollaborator) {
        await res.locals.channelCollaborator.destroy({ transaction })
      }

      await collaborator.save({ transaction })
    })
  })

  collaborator.Account = res.locals.account

  auditLog.create(getAuditActorFromRes(res), () => buildCollaboratorEntityOf(res, collaborator))

  Notifier.Instance.notifyOfChannelCollaboratorInvitation(collaborator, res.locals.videoChannel)

  return res.json({ collaborator: collaborator.toFormattedJSON() })
}

async function acceptCollaboratorInvite (req: express.Request, res: express.Response) {
  const collaborator = res.locals.channelCollaborator
  const oldCollaboratorAuditEntity = auditLog.snapshot(() => buildCollaboratorEntityOf(res, collaborator))

  collaborator.state = VideoChannelCollaboratorState.ACCEPTED

  await saveInTransactionWithRetries(collaborator)

  auditLog.update(getAuditActorFromRes(res), () => buildCollaboratorEntityOf(res, collaborator), oldCollaboratorAuditEntity)

  Notifier.Instance.notifyOfAcceptedChannelCollaborator(collaborator, res.locals.videoChannel)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function rejectCollaboratorInvite (req: express.Request, res: express.Response) {
  const collaborator = res.locals.channelCollaborator
  const oldCollaboratorAuditEntity = auditLog.snapshot(() => buildCollaboratorEntityOf(res, collaborator))

  collaborator.state = VideoChannelCollaboratorState.REJECTED

  await saveInTransactionWithRetries(collaborator)

  auditLog.update(getAuditActorFromRes(res), () => buildCollaboratorEntityOf(res, collaborator), oldCollaboratorAuditEntity)

  Notifier.Instance.notifyOfRefusedChannelCollaborator(collaborator, res.locals.videoChannel)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function removeCollaborator (req: express.Request, res: express.Response) {
  const collaborator = res.locals.channelCollaborator

  await deleteInTransactionWithRetries(collaborator)

  auditLog.delete(getAuditActorFromRes(res), () => buildCollaboratorEntityOf(res, collaborator))

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

function buildCollaboratorEntityOf (res: express.Response, collaborator: MChannelCollaboratorAccount) {
  return buildChannelCollaboratorAuditEntity({
    channel: buildChannelAuditSummary(res.locals.videoChannel),
    collaborator: collaborator.toFormattedJSON()
  })
}
