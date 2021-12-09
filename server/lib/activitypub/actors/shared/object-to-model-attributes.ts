import { isActivityPubUrlValid } from '@server/helpers/custom-validators/activitypub/misc'
import { ACTOR_IMAGES_SIZE, MIMETYPES } from '@server/initializers/constants'
import { ActorModel } from '@server/models/actor/actor'
import { FilteredModelAttributes } from '@server/types'
import { getLowercaseExtension } from '@shared/core-utils'
import { buildUUID } from '@shared/extra-utils'
import { ActivityIconObject, ActivityPubActor, ActorImageType } from '@shared/models'

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

function normalizeIcon (icon: ActivityIconObject | ActivityIconObject[]): ActivityIconObject[] {
  if (Array.isArray(icon) === true) return icon as ActivityIconObject[]

  return [ icon ] as ActivityIconObject[]
}

function getImageInfoFromObject (actorObject: ActivityPubActor, type: ActorImageType) {
  const mimetypes = MIMETYPES.IMAGE
  const nIcon = normalizeIcon(actorObject.icon)
  const icon = [ ActorImageType.AVATAR, ActorImageType.AVATAR_MINIATURE ].includes(type)
    ? (nIcon.length > 1 ? nIcon.find(icon => icon?.height === ACTOR_IMAGES_SIZE[type].height) : nIcon[0]) // Backward compatibility
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
