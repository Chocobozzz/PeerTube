import { VideoRedundancyModel } from '../models/redundancy/video-redundancy'
import { sendUndoCacheFile } from './activitypub/send'
import { Transaction } from 'sequelize'
import { getServerActor } from '../helpers/utils'

async function removeVideoRedundancy (videoRedundancy: VideoRedundancyModel, t?: Transaction) {
  const serverActor = await getServerActor()

  await sendUndoCacheFile(serverActor, videoRedundancy, t)

  await videoRedundancy.destroy({ transaction: t })
}

// ---------------------------------------------------------------------------

export {
  removeVideoRedundancy
}
