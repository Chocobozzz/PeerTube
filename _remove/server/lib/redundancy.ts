import { Transaction } from 'sequelize'
import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { CONFIG } from '@server/initializers/config'
import { ActorFollowModel } from '@server/models/actor/actor-follow'
import { getServerActor } from '@server/models/application/application'
import { MActorSignature, MVideoRedundancyVideo } from '@server/types/models'
import { Activity } from '@shared/models'
import { VideoRedundancyModel } from '../models/redundancy/video-redundancy'
import { sendUndoCacheFile } from './activitypub/send'

const lTags = loggerTagsFactory('redundancy')

async function removeVideoRedundancy (videoRedundancy: MVideoRedundancyVideo, t?: Transaction) {
  const serverActor = await getServerActor()

  // Local cache, send undo to remote instances
  if (videoRedundancy.actorId === serverActor.id) await sendUndoCacheFile(serverActor, videoRedundancy, t)

  await videoRedundancy.destroy({ transaction: t })
}

async function removeRedundanciesOfServer (serverId: number) {
  const redundancies = await VideoRedundancyModel.listLocalOfServer(serverId)

  for (const redundancy of redundancies) {
    await removeVideoRedundancy(redundancy)
  }
}

async function isRedundancyAccepted (activity: Activity, byActor: MActorSignature) {
  const configAcceptFrom = CONFIG.REMOTE_REDUNDANCY.VIDEOS.ACCEPT_FROM
  if (configAcceptFrom === 'nobody') {
    logger.info('Do not accept remote redundancy %s due instance accept policy.', activity.id, lTags())
    return false
  }

  if (configAcceptFrom === 'followings') {
    const serverActor = await getServerActor()
    const allowed = await ActorFollowModel.isFollowedBy(byActor.id, serverActor.id)

    if (allowed !== true) {
      logger.info(
        'Do not accept remote redundancy %s because actor %s is not followed by our instance.',
        activity.id, byActor.url, lTags()
      )
      return false
    }
  }

  return true
}

// ---------------------------------------------------------------------------

export {
  isRedundancyAccepted,
  removeRedundanciesOfServer,
  removeVideoRedundancy
}
