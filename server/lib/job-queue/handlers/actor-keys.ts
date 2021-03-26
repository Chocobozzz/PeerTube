import * as Bull from 'bull'
import { generateAndSaveActorKeys } from '@server/lib/activitypub/actor'
import { ActorModel } from '@server/models/activitypub/actor'
import { ActorKeysPayload } from '@shared/models'
import { logger } from '../../../helpers/logger'

async function processActorKeys (job: Bull.Job) {
  const payload = job.data as ActorKeysPayload
  logger.info('Processing actor keys in job %d.', job.id)

  const actor = await ActorModel.load(payload.actorId)

  await generateAndSaveActorKeys(actor)
}

// ---------------------------------------------------------------------------

export {
  processActorKeys
}
