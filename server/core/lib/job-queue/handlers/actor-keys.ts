import { Job } from 'bullmq'
import { generateAndSaveActorKeys } from '@server/lib/activitypub/actors/index.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { ActorKeysPayload } from '@peertube/peertube-models'
import { createLogger } from '../../../helpers/logger.js'

const logger = createLogger()

export async function processActorKeys (job: Job) {
  const payload = job.data as ActorKeysPayload
  logger.info('Processing actor keys in job %s.', job.id)

  const actor = await ActorModel.load(payload.actorId)
  if (!actor) {
    logger.info('Do not generate keys of actor %d that does not exist anymore.', payload.actorId)
    return
  }

  if (actor.publicKey && actor.privateKey) {
    logger.info('Do not generate keys of actor %d that already has keys.', payload.actorId)
    return
  }

  await generateAndSaveActorKeys(actor)
}
