import { VideoRedundancyModel } from '../models/redundancy/video-redundancy'
import { sendUndoCacheFile } from './activitypub/send'
import { Transaction } from 'sequelize'
import { getServerActor } from '../helpers/utils'
import { MVideoRedundancyVideo } from '@server/typings/models'

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

// ---------------------------------------------------------------------------

export {
  removeRedundanciesOfServer,
  removeVideoRedundancy
}
