import { getLowercaseExtension } from '@server/helpers/core-utils'
import { isActivityPubUrlValid } from '@server/helpers/custom-validators/activitypub/misc'
import { buildUUID } from '@server/helpers/uuid'
import { MIMETYPES } from '@server/initializers/constants'
import { ActorModel } from '@server/models/actor/actor'
import { FilteredModelAttributes } from '@server/types'
import { ActivityPubActor, ActorImageType } from '@shared/models'

function getActorAttributesFromObject (
  actorObject: ActivityPubActor,
  followersCount: number,
  followingCount: number
): FilteredModelAttributes<ActorModel> {
  return {
    type: actorObject.type,
    preferredUsername: actorObject.preferredUsername,
    url: actorObject.id,
    publicKey: actorObject.publicKey.publicKeyPem,
    privateKey: null,
    followersCount,
    followingCount,
    inboxUrl: actorObject.inbox,
    outboxUrl: actorObject.outbox,
    followersUrl: actorObject.followers,
    followingUrl: actorObject.following,

    sharedInboxUrl: actorObject.endpoints?.sharedInbox
      ? actorObject.endpoints.sharedInbox
      : null
  }
}

function getImageInfoFromObject (actorObject: ActivityPubActor, type: ActorImageType) {
  const mimetypes = MIMETYPES.IMAGE
  const icon = type === ActorImageType.AVATAR
    ? actorObject.icon
    : actorObject.image

  if (!icon || icon.type !== 'Image' || !isActivityPubUrlValid(icon.url)) return undefined

  let extension: string

  if (icon.mediaType) {
    extension = mimetypes.MIMETYPE_EXT[icon.mediaType]
  } else {
    const tmp = getLowercaseExtension(icon.url)

    if (mimetypes.EXT_MIMETYPE[tmp] !== undefined) extension = tmp
  }

  if (!extension) return undefined

  return {
    name: buildUUID() + extension,
    fileUrl: icon.url,
    height: icon.height,
    width: icon.width,
    type
  }
}

function getActorDisplayNameFromObject (actorObject: ActivityPubActor) {
  return actorObject.name || actorObject.preferredUsername
}

export {
  getActorAttributesFromObject,
  getImageInfoFromObject,
  getActorDisplayNameFromObject
}
