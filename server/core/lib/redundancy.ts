import { Activity } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { ActorFollowModel } from '@server/models/actor/actor-follow.js'
import { getServerActor } from '@server/models/application/application.js'
import { MActorSignature, MVideoRedundancyVideo } from '@server/types/models/index.js'
import { Transaction } from 'sequelize'
import { VideoRedundancyModel } from '../models/redundancy/video-redundancy.js'
import { sendUndoCacheFile } from './activitypub/send/index.js'

const logger = createLogger('redundancy')

async function removeVideoRedundancy (videoRedundancy: MVideoRedundancyVideo, t?: Transaction) {
  const serverActor = await getServerActor()

  // Local cache, send undo to remote instances
  if (videoRedundancy.actorId === serverActor.id) await sendUndoCacheFile(serverActor, videoRedundancy, t)

  await videoRedundancy.destroy({ transaction: t })
}

// The streaming playlist changed on the origin instance, so our cached copy is outdated
// The redundancy scheduler will duplicate the video again later if it still matches one of its strategies
async function removeRedundanciesOfStreamingPlaylist (videoStreamingPlaylistId: number, t?: Transaction) {
  const redundancies = await VideoRedundancyModel.listLocalByStreamingPlaylistId(videoStreamingPlaylistId)

  for (const redundancy of redundancies) {
    logger.info('Removing outdated redundancy %s of streaming playlist %d.', redundancy.url, videoStreamingPlaylistId)

    await removeVideoRedundancy(redundancy, t)
  }
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
    logger.info('Do not accept remote redundancy %s due instance accept policy.', activity.id)
    return false
  }

  if (configAcceptFrom === 'followings') {
    const serverActor = await getServerActor()
    const allowed = await ActorFollowModel.isFollowedBy(byActor.id, serverActor.id)

    if (allowed !== true) {
      logger.info(
        'Do not accept remote redundancy %s because actor %s is not followed by our instance.',
        activity.id,
        byActor.url
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
  removeRedundanciesOfStreamingPlaylist,
  removeVideoRedundancy
}
