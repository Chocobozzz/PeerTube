import { FileStorageType } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { sendUpdateActor } from '@server/lib/activitypub/send/index.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { getServerActor } from '@server/models/application/application.js'
import { ModelCache } from '@server/models/shared/model-cache.js'
import { moveCommonFile } from './move-common-file.js'

const logger = createLogger()

// Move all the images of an actor at once, so the actor is federated only once
export async function moveActorImagesToStorage (options: {
  actorId: number
  targetStorage: FileStorageType
}) {
  const { actorId, targetStorage } = options

  const actor = await ActorModel.loadFull(actorId)

  if (!actor) {
    logger.info(`Can't process images of actor ${actorId}, actor does not exist anymore.`)
    return
  }

  // Remote images are cached by our instance, they never live in our object storage
  if (!actor.isLocal()) {
    logger.info(`Can't process images of actor ${actorId}, actor is remote.`)
    return
  }

  const images = [ ...(actor.Avatars || []), ...(actor.Banners || []) ]
    .filter(i => i.isLocal() && i.storage !== targetStorage)

  if (images.length === 0) {
    logger.info(`No images to move for actor ${actorId}.`)
    return
  }

  let moved = false

  for (const image of images) {
    if (!await moveCommonFile({ type: 'avatars', filename: image.filename, fsPath: image.getFSPath(), targetStorage })) continue

    // Update the instance, so the actor below is federated with the new URLs
    image.storage = targetStorage
    moved = true
  }

  if (!moved) return

  // The server actor caches its avatars/banners, and their URL just changed
  if (actor.id === (await getServerActor()).id) {
    ModelCache.Instance.clearCache('server-account')
  }

  const accountOrChannel = actor.Account || actor.VideoChannel
  if (!accountOrChannel) return

  await sequelizeTypescript.transaction(t => sendUpdateActor(Object.assign(accountOrChannel, { Actor: actor }), t))
}
