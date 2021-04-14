import * as Bluebird from 'bluebird'
import { extname } from 'path'
import { Op, Transaction } from 'sequelize'
import { URL } from 'url'
import { v4 as uuidv4 } from 'uuid'
import { getServerActor } from '@server/models/application/application'
import { ActorImageType } from '@shared/models'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'
import { ActivityPubActor, ActivityPubActorType, ActivityPubOrderedCollection } from '../../../shared/models/activitypub'
import { ActivityPubAttributedTo } from '../../../shared/models/activitypub/objects'
import { checkUrlsSameHost, getAPId } from '../../helpers/activitypub'
import { ActorFetchByUrlType, fetchActorByUrl } from '../../helpers/actor'
import { sanitizeAndCheckActorObject } from '../../helpers/custom-validators/activitypub/actor'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc'
import { retryTransactionWrapper, updateInstanceWithAnother } from '../../helpers/database-utils'
import { logger } from '../../helpers/logger'
import { createPrivateAndPublicKeys } from '../../helpers/peertube-crypto'
import { doJSONRequest, PeerTubeRequestError } from '../../helpers/requests'
import { getUrlFromWebfinger } from '../../helpers/webfinger'
import { MIMETYPES, WEBSERVER } from '../../initializers/constants'
import { sequelizeTypescript } from '../../initializers/database'
import { AccountModel } from '../../models/account/account'
import { ActorImageModel } from '../../models/account/actor-image'
import { ActorModel } from '../../models/activitypub/actor'
import { ServerModel } from '../../models/server/server'
import { VideoChannelModel } from '../../models/video/video-channel'
import {
  MAccount,
  MAccountDefault,
  MActor,
  MActorAccountChannelId,
  MActorAccountChannelIdActor,
  MActorAccountId,
  MActorFull,
  MActorFullActor,
  MActorId,
  MActorImage,
  MActorImages,
  MChannel
} from '../../types/models'
import { JobQueue } from '../job-queue'

// Set account keys, this could be long so process after the account creation and do not block the client
async function generateAndSaveActorKeys <T extends MActor> (actor: T) {
  const { publicKey, privateKey } = await createPrivateAndPublicKeys()

  actor.publicKey = publicKey
  actor.privateKey = privateKey

  return actor.save()
}

function getOrCreateActorAndServerAndModel (
  activityActor: string | ActivityPubActor,
  fetchType: 'all',
  recurseIfNeeded?: boolean,
  updateCollections?: boolean
): Promise<MActorFullActor>

function getOrCreateActorAndServerAndModel (
  activityActor: string | ActivityPubActor,
  fetchType?: 'association-ids',
  recurseIfNeeded?: boolean,
  updateCollections?: boolean
): Promise<MActorAccountChannelId>

async function getOrCreateActorAndServerAndModel (
  activityActor: string | ActivityPubActor,
  fetchType: ActorFetchByUrlType = 'association-ids',
  recurseIfNeeded = true,
  updateCollections = false
): Promise<MActorFullActor | MActorAccountChannelId> {
  const actorUrl = getAPId(activityActor)
  let created = false
  let accountPlaylistsUrl: string

  let actor = await fetchActorByUrl(actorUrl, fetchType)
  // Orphan actor (not associated to an account of channel) so recreate it
  if (actor && (!actor.Account && !actor.VideoChannel)) {
    await actor.destroy()
    actor = null
  }

  // We don't have this actor in our database, fetch it on remote
  if (!actor) {
    const { result } = await fetchRemoteActor(actorUrl)
    if (result === undefined) throw new Error('Cannot fetch remote actor ' + actorUrl)

    // Create the attributed to actor
    // In PeerTube a video channel is owned by an account
    let ownerActor: MActorFullActor
    if (recurseIfNeeded === true && result.actor.type === 'Group') {
      const accountAttributedTo = result.attributedTo.find(a => a.type === 'Person')
      if (!accountAttributedTo) throw new Error('Cannot find account attributed to video channel ' + actor.url)

      if (checkUrlsSameHost(accountAttributedTo.id, actorUrl) !== true) {
        throw new Error(`Account attributed to ${accountAttributedTo.id} does not have the same host than actor url ${actorUrl}`)
      }

      try {
        // Don't recurse another time
        const recurseIfNeeded = false
        ownerActor = await getOrCreateActorAndServerAndModel(accountAttributedTo.id, 'all', recurseIfNeeded)
      } catch (err) {
        logger.error('Cannot get or create account attributed to video channel ' + actorUrl)
        throw new Error(err)
      }
    }

    actor = await retryTransactionWrapper(saveActorAndServerAndModelIfNotExist, result, ownerActor)
    created = true
    accountPlaylistsUrl = result.playlists
  }

  if (actor.Account) (actor as MActorAccountChannelIdActor).Account.Actor = actor
  if (actor.VideoChannel) (actor as MActorAccountChannelIdActor).VideoChannel.Actor = actor

  const { actor: actorRefreshed, refreshed } = await retryTransactionWrapper(refreshActorIfNeeded, actor, fetchType)
  if (!actorRefreshed) throw new Error('Actor ' + actor.url + ' does not exist anymore.')

  if ((created === true || refreshed === true) && updateCollections === true) {
    const payload = { uri: actor.outboxUrl, type: 'activity' as 'activity' }
    await JobQueue.Instance.createJobWithPromise({ type: 'activitypub-http-fetcher', payload })
  }

  // We created a new account: fetch the playlists
  if (created === true && actor.Account && accountPlaylistsUrl) {
    const payload = { uri: accountPlaylistsUrl, accountId: actor.Account.id, type: 'account-playlists' as 'account-playlists' }
    await JobQueue.Instance.createJobWithPromise({ type: 'activitypub-http-fetcher', payload })
  }

  return actorRefreshed
}

function buildActorInstance (type: ActivityPubActorType, url: string, preferredUsername: string, uuid?: string) {
  return new ActorModel({
    type,
    url,
    preferredUsername,
    uuid,
    publicKey: null,
    privateKey: null,
    followersCount: 0,
    followingCount: 0,
    inboxUrl: url + '/inbox',
    outboxUrl: url + '/outbox',
    sharedInboxUrl: WEBSERVER.URL + '/inbox',
    followersUrl: url + '/followers',
    followingUrl: url + '/following'
  }) as MActor
}

async function updateActorInstance (actorInstance: ActorModel, attributes: ActivityPubActor) {
  const followersCount = await fetchActorTotalItems(attributes.followers)
  const followingCount = await fetchActorTotalItems(attributes.following)

  actorInstance.type = attributes.type
  actorInstance.preferredUsername = attributes.preferredUsername
  actorInstance.url = attributes.id
  actorInstance.publicKey = attributes.publicKey.publicKeyPem
  actorInstance.followersCount = followersCount
  actorInstance.followingCount = followingCount
  actorInstance.inboxUrl = attributes.inbox
  actorInstance.outboxUrl = attributes.outbox
  actorInstance.followersUrl = attributes.followers
  actorInstance.followingUrl = attributes.following

  if (attributes.endpoints?.sharedInbox) {
    actorInstance.sharedInboxUrl = attributes.endpoints.sharedInbox
  }
}

type ImageInfo = {
  name: string
  fileUrl: string
  height: number
  width: number
  onDisk?: boolean
}
async function updateActorImageInstance (actor: MActorImages, type: ActorImageType, imageInfo: ImageInfo | null, t: Transaction) {
  const oldImageModel = type === ActorImageType.AVATAR
    ? actor.Avatar
    : actor.Banner

  if (oldImageModel) {
    // Don't update the avatar if the file URL did not change
    if (imageInfo?.fileUrl && oldImageModel.fileUrl === imageInfo.fileUrl) return actor

    try {
      await oldImageModel.destroy({ transaction: t })

      setActorImage(actor, type, null)
    } catch (err) {
      logger.error('Cannot remove old actor image of actor %s.', actor.url, { err })
    }
  }

  if (imageInfo) {
    const imageModel = await ActorImageModel.create({
      filename: imageInfo.name,
      onDisk: imageInfo.onDisk ?? false,
      fileUrl: imageInfo.fileUrl,
      height: imageInfo.height,
      width: imageInfo.width,
      type
    }, { transaction: t })

    setActorImage(actor, type, imageModel)
  }

  return actor
}

async function deleteActorImageInstance (actor: MActorImages, type: ActorImageType, t: Transaction) {
  try {
    if (type === ActorImageType.AVATAR) {
      await actor.Avatar.destroy({ transaction: t })

      actor.avatarId = null
      actor.Avatar = null
    } else {
      await actor.Banner.destroy({ transaction: t })

      actor.bannerId = null
      actor.Banner = null
    }
  } catch (err) {
    logger.error('Cannot remove old image of actor %s.', actor.url, { err })
  }

  return actor
}

async function fetchActorTotalItems (url: string) {
  try {
    const { body } = await doJSONRequest<ActivityPubOrderedCollection<unknown>>(url, { activityPub: true })

    return body.totalItems || 0
  } catch (err) {
    logger.warn('Cannot fetch remote actor count %s.', url, { err })
    return 0
  }
}

function getImageInfoIfExists (actorJSON: ActivityPubActor, type: ActorImageType) {
  const mimetypes = MIMETYPES.IMAGE
  const icon = type === ActorImageType.AVATAR
    ? actorJSON.icon
    : actorJSON.image

  if (!icon || icon.type !== 'Image' || !isActivityPubUrlValid(icon.url)) return undefined

  let extension: string

  if (icon.mediaType) {
    extension = mimetypes.MIMETYPE_EXT[icon.mediaType]
  } else {
    const tmp = extname(icon.url)

    if (mimetypes.EXT_MIMETYPE[tmp] !== undefined) extension = tmp
  }

  if (!extension) return undefined

  return {
    name: uuidv4() + extension,
    fileUrl: icon.url,
    height: icon.height,
    width: icon.width,
    type
  }
}

async function addFetchOutboxJob (actor: Pick<ActorModel, 'id' | 'outboxUrl'>) {
  // Don't fetch ourselves
  const serverActor = await getServerActor()
  if (serverActor.id === actor.id) {
    logger.error('Cannot fetch our own outbox!')
    return undefined
  }

  const payload = {
    uri: actor.outboxUrl,
    type: 'activity' as 'activity'
  }

  return JobQueue.Instance.createJob({ type: 'activitypub-http-fetcher', payload })
}

async function refreshActorIfNeeded <T extends MActorFull | MActorAccountChannelId> (
  actorArg: T,
  fetchedType: ActorFetchByUrlType
): Promise<{ actor: T | MActorFull, refreshed: boolean }> {
  if (!actorArg.isOutdated()) return { actor: actorArg, refreshed: false }

  // We need more attributes
  const actor = fetchedType === 'all'
    ? actorArg as MActorFull
    : await ActorModel.loadByUrlAndPopulateAccountAndChannel(actorArg.url)

  try {
    let actorUrl: string
    try {
      actorUrl = await getUrlFromWebfinger(actor.preferredUsername + '@' + actor.getHost())
    } catch (err) {
      logger.warn('Cannot get actor URL from webfinger, keeping the old one.', err)
      actorUrl = actor.url
    }

    const { result } = await fetchRemoteActor(actorUrl)

    if (result === undefined) {
      logger.warn('Cannot fetch remote actor in refresh actor.')
      return { actor, refreshed: false }
    }

    return sequelizeTypescript.transaction(async t => {
      updateInstanceWithAnother(actor, result.actor)

      await updateActorImageInstance(actor, ActorImageType.AVATAR, result.avatar, t)
      await updateActorImageInstance(actor, ActorImageType.BANNER, result.banner, t)

      // Force update
      actor.setDataValue('updatedAt', new Date())
      await actor.save({ transaction: t })

      if (actor.Account) {
        actor.Account.name = result.name
        actor.Account.description = result.summary

        await actor.Account.save({ transaction: t })
      } else if (actor.VideoChannel) {
        actor.VideoChannel.name = result.name
        actor.VideoChannel.description = result.summary
        actor.VideoChannel.support = result.support

        await actor.VideoChannel.save({ transaction: t })
      }

      return { refreshed: true, actor }
    })
  } catch (err) {
    if ((err as PeerTubeRequestError).statusCode === HttpStatusCode.NOT_FOUND_404) {
      logger.info('Deleting actor %s because there is a 404 in refresh actor.', actor.url)
      actor.Account
        ? await actor.Account.destroy()
        : await actor.VideoChannel.destroy()

      return { actor: undefined, refreshed: false }
    }

    logger.warn('Cannot refresh actor %s.', actor.url, { err })
    return { actor, refreshed: false }
  }
}

export {
  getOrCreateActorAndServerAndModel,
  buildActorInstance,
  generateAndSaveActorKeys,
  fetchActorTotalItems,
  getImageInfoIfExists,
  updateActorInstance,
  deleteActorImageInstance,
  refreshActorIfNeeded,
  updateActorImageInstance,
  addFetchOutboxJob
}

// ---------------------------------------------------------------------------

function setActorImage (actorModel: MActorImages, type: ActorImageType, imageModel: MActorImage) {
  const id = imageModel
    ? imageModel.id
    : null

  if (type === ActorImageType.AVATAR) {
    actorModel.avatarId = id
    actorModel.Avatar = imageModel
  } else {
    actorModel.bannerId = id
    actorModel.Banner = imageModel
  }

  return actorModel
}

function saveActorAndServerAndModelIfNotExist (
  result: FetchRemoteActorResult,
  ownerActor?: MActorFullActor,
  t?: Transaction
): Bluebird<MActorFullActor> | Promise<MActorFullActor> {
  const actor = result.actor

  if (t !== undefined) return save(t)

  return sequelizeTypescript.transaction(t => save(t))

  async function save (t: Transaction) {
    const actorHost = new URL(actor.url).host

    const serverOptions = {
      where: {
        host: actorHost
      },
      defaults: {
        host: actorHost
      },
      transaction: t
    }
    const [ server ] = await ServerModel.findOrCreate(serverOptions)

    // Save our new account in database
    actor.serverId = server.id

    // Avatar?
    if (result.avatar) {
      const avatar = await ActorImageModel.create({
        filename: result.avatar.name,
        fileUrl: result.avatar.fileUrl,
        width: result.avatar.width,
        height: result.avatar.height,
        onDisk: false,
        type: ActorImageType.AVATAR
      }, { transaction: t })

      actor.avatarId = avatar.id
    }

    // Banner?
    if (result.banner) {
      const banner = await ActorImageModel.create({
        filename: result.banner.name,
        fileUrl: result.banner.fileUrl,
        width: result.banner.width,
        height: result.banner.height,
        onDisk: false,
        type: ActorImageType.BANNER
      }, { transaction: t })

      actor.bannerId = banner.id
    }

    // Force the actor creation, sometimes Sequelize skips the save() when it thinks the instance already exists
    // (which could be false in a retried query)
    const [ actorCreated, created ] = await ActorModel.findOrCreate<MActorFullActor>({
      defaults: actor.toJSON(),
      where: {
        [Op.or]: [
          {
            url: actor.url
          },
          {
            serverId: actor.serverId,
            preferredUsername: actor.preferredUsername
          }
        ]
      },
      transaction: t
    })

    // Try to fix non HTTPS accounts of remote instances that fixed their URL afterwards
    if (created !== true && actorCreated.url !== actor.url) {
      // Only fix http://example.com/account/djidane to https://example.com/account/djidane
      if (actorCreated.url.replace(/^http:\/\//, '') !== actor.url.replace(/^https:\/\//, '')) {
        throw new Error(`Actor from DB with URL ${actorCreated.url} does not correspond to actor ${actor.url}`)
      }

      actorCreated.url = actor.url
      await actorCreated.save({ transaction: t })
    }

    if (actorCreated.type === 'Person' || actorCreated.type === 'Application') {
      actorCreated.Account = await saveAccount(actorCreated, result, t) as MAccountDefault
      actorCreated.Account.Actor = actorCreated
    } else if (actorCreated.type === 'Group') { // Video channel
      const channel = await saveVideoChannel(actorCreated, result, ownerActor, t)
      actorCreated.VideoChannel = Object.assign(channel, { Actor: actorCreated, Account: ownerActor.Account })
    }

    actorCreated.Server = server

    return actorCreated
  }
}

type ImageResult = {
  name: string
  fileUrl: string
  height: number
  width: number
}

type FetchRemoteActorResult = {
  actor: MActor
  name: string
  summary: string
  support?: string
  playlists?: string
  avatar?: ImageResult
  banner?: ImageResult
  attributedTo: ActivityPubAttributedTo[]
}
async function fetchRemoteActor (actorUrl: string): Promise<{ statusCode?: number, result: FetchRemoteActorResult }> {
  logger.info('Fetching remote actor %s.', actorUrl)

  const requestResult = await doJSONRequest<ActivityPubActor>(actorUrl, { activityPub: true })
  const actorJSON = requestResult.body

  if (sanitizeAndCheckActorObject(actorJSON) === false) {
    logger.debug('Remote actor JSON is not valid.', { actorJSON })
    return { result: undefined, statusCode: requestResult.statusCode }
  }

  if (checkUrlsSameHost(actorJSON.id, actorUrl) !== true) {
    logger.warn('Actor url %s has not the same host than its AP id %s', actorUrl, actorJSON.id)
    return { result: undefined, statusCode: requestResult.statusCode }
  }

  const followersCount = await fetchActorTotalItems(actorJSON.followers)
  const followingCount = await fetchActorTotalItems(actorJSON.following)

  const actor = new ActorModel({
    type: actorJSON.type,
    preferredUsername: actorJSON.preferredUsername,
    url: actorJSON.id,
    publicKey: actorJSON.publicKey.publicKeyPem,
    privateKey: null,
    followersCount: followersCount,
    followingCount: followingCount,
    inboxUrl: actorJSON.inbox,
    outboxUrl: actorJSON.outbox,
    followersUrl: actorJSON.followers,
    followingUrl: actorJSON.following,

    sharedInboxUrl: actorJSON.endpoints?.sharedInbox
      ? actorJSON.endpoints.sharedInbox
      : null
  })

  const avatarInfo = getImageInfoIfExists(actorJSON, ActorImageType.AVATAR)
  const bannerInfo = getImageInfoIfExists(actorJSON, ActorImageType.BANNER)

  const name = actorJSON.name || actorJSON.preferredUsername
  return {
    statusCode: requestResult.statusCode,
    result: {
      actor,
      name,
      avatar: avatarInfo,
      banner: bannerInfo,
      summary: actorJSON.summary,
      support: actorJSON.support,
      playlists: actorJSON.playlists,
      attributedTo: actorJSON.attributedTo
    }
  }
}

async function saveAccount (actor: MActorId, result: FetchRemoteActorResult, t: Transaction) {
  const [ accountCreated ] = await AccountModel.findOrCreate({
    defaults: {
      name: result.name,
      description: result.summary,
      actorId: actor.id
    },
    where: {
      actorId: actor.id
    },
    transaction: t
  })

  return accountCreated as MAccount
}

async function saveVideoChannel (actor: MActorId, result: FetchRemoteActorResult, ownerActor: MActorAccountId, t: Transaction) {
  const [ videoChannelCreated ] = await VideoChannelModel.findOrCreate({
    defaults: {
      name: result.name,
      description: result.summary,
      support: result.support,
      actorId: actor.id,
      accountId: ownerActor.Account.id
    },
    where: {
      actorId: actor.id
    },
    transaction: t
  })

  return videoChannelCreated as MChannel
}
