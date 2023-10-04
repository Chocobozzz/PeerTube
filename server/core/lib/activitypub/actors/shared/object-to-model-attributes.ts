import { ActivityIconObject, ActivityPubActor, ActorImageType, ActorImageType_Type } from '@peertube/peertube-models'
import { isActivityPubUrlValid } from '@server/helpers/custom-validators/activitypub/misc.js'
import { MIMETYPES } from '@server/initializers/constants.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { FilteredModelAttributes } from '@server/types/index.js'
import { buildUUID, getLowercaseExtension } from '@peertube/peertube-node-utils'

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

function getImagesInfoFromObject (actorObject: ActivityPubActor, type: ActorImageType_Type) {
  const iconsOrImages = type === ActorImageType.AVATAR
    ? actorObject.icon
    : actorObject.image

  return normalizeIconOrImage(iconsOrImages)
    .map(iconOrImage => {
      const mimetypes = MIMETYPES.IMAGE

      if (iconOrImage.type !== 'Image' || !isActivityPubUrlValid(iconOrImage.url)) return undefined

      let extension: string

      if (iconOrImage.mediaType) {
        extension = mimetypes.MIMETYPE_EXT[iconOrImage.mediaType]
      } else {
        const tmp = getLowercaseExtension(iconOrImage.url)

        if (mimetypes.EXT_MIMETYPE[tmp] !== undefined) extension = tmp
      }

      if (!extension) return undefined

      return {
        name: buildUUID() + extension,
        fileUrl: iconOrImage.url,
        height: iconOrImage.height,
        width: iconOrImage.width,
        type
      }
    })
    .filter(i => !!i)
}

function getActorDisplayNameFromObject (actorObject: ActivityPubActor) {
  return actorObject.name || actorObject.preferredUsername
}

export {
  getActorAttributesFromObject,
  getImagesInfoFromObject,
  getActorDisplayNameFromObject
}

// ---------------------------------------------------------------------------

function normalizeIconOrImage (icon: ActivityIconObject | ActivityIconObject[]): ActivityIconObject[] {
  if (Array.isArray(icon)) return icon
  if (icon) return [ icon ]

  return []
}
