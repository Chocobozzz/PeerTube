import { VideoRedundancyModel } from '../models/redundancy/video-redundancy'
import { sendUndoCacheFile } from './activitypub/send'
import { Transaction } from 'sequelize'
import { getServerActor } from '../helpers/utils'

async function removeVideoRedundancy (videoRedundancy: VideoRedundancyModel, t?: Transaction) {
  const serverActor = await getServerActor()

  // Local cache, send undo to remote instances
  if (videoRedundancy.actorId === serverActor.id) await sendUndoCacheFile(serverActor, videoRedundancy, t)

  await videoRedundancy.destroy({ transaction: t })
}

async function removeRedundancyOf (serverId: number) {
  const videosRedundancy = await VideoRedundancyModel.listLocalOfServer(serverId)

  for (const redundancy of videosRedundancy) {
    await removeVideoRedundancy(redundancy)
  }
}

// ---------------------------------------------------------------------------

export {
  removeRedundancyOf,
  removeVideoRedundancy
}
