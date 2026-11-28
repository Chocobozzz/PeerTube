import { arrayify } from '@peertube/peertube-core-utils'
import { ActivityIconObject, ActivityPubActor, ActorImageType, ActorImageType_Type } from '@peertube/peertube-models'
import { isActivityPubUrlValid } from '@server/helpers/custom-validators/activitypub/misc.js'
import { ed25519PublicKeyFromMultibase } from '@server/helpers/peertube-integrity-proof.js'
import { MIMETYPES } from '@server/initializers/constants.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { FilteredModelAttributes } from '@server/types/index.js'
import { buildUUID, getLowercaseExtension } from '@peertube/peertube-node-utils'

function getActorAttributesFromObject (
  actorObject: ActivityPubActor,
  followersCount: number,
  followingCount: number
): FilteredModelAttributes<ActorModel> {
  const ed25519Key = getEd25519KeyFromObject(actorObject)

  return {
    type: actorObject.type,
    preferredUsername: actorObject.preferredUsername,
    url: actorObject.id,
    publicKey: actorObject.publicKey.publicKeyPem,
    privateKey: null,
    ed25519PublicKey: ed25519Key?.publicKey ?? null,
    ed25519PrivateKey: null,
    ed25519KeyUrl: ed25519Key?.url ?? null,
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

// FEP-521a: find the Ed25519 key the actor uses to create FEP-8b32 integrity proofs
// Non conformant keys are ignored
function getEd25519KeyFromObject (actorObject: ActivityPubActor) {
  for (const method of arrayify(actorObject.assertionMethod ?? [])) {
    if (!method || typeof method !== 'object') continue
    if (method.type !== 'Multikey' || method.controller !== actorObject.id || !isActivityPubUrlValid(method.id)) continue

    const publicKey = ed25519PublicKeyFromMultibase(method.publicKeyMultibase)
    if (publicKey) return { url: method.id, publicKey }
  }

  return undefined
}

export {
  getActorAttributesFromObject,
  getEd25519KeyFromObject,
  getImagesInfoFromObject,
  getActorDisplayNameFromObject
}

// ---------------------------------------------------------------------------

function normalizeIconOrImage (icon: ActivityIconObject | ActivityIconObject[]): ActivityIconObject[] {
  if (Array.isArray(icon)) return icon
  if (icon) return [ icon ]

  return []
}
