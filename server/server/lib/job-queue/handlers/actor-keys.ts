import { Job } from 'bullmq'
import { generateAndSaveActorKeys } from '@server/lib/activitypub/actors/index.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { ActorKeysPayload } from '@peertube/peertube-models'
import { logger } from '../../../helpers/logger.js'

async function processActorKeys (job: Job) {
  const payload = job.data as ActorKeysPayload
  logger.info('Processing actor keys in job %s.', job.id)

  const actor = await ActorModel.load(payload.actorId)

  await generateAndSaveActorKeys(actor)
}

// ---------------------------------------------------------------------------

export {
  processActorKeys
}
