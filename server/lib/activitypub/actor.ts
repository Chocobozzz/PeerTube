import * as Bluebird from 'bluebird'
import { join } from 'path'
import { Transaction } from 'sequelize'
import * as url from 'url'
import * as uuidv4 from 'uuid/v4'
import { ActivityPubActor, ActivityPubActorType } from '../../../shared/models/activitypub'
import { ActivityPubAttributedTo } from '../../../shared/models/activitypub/objects'
import { getActorUrl } from '../../helpers/activitypub'
import { isActorObjectValid, normalizeActor } from '../../helpers/custom-validators/activitypub/actor'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc'
import { retryTransactionWrapper, updateInstanceWithAnother } from '../../helpers/database-utils'
import { logger } from '../../helpers/logger'
import { createPrivateAndPublicKeys } from '../../helpers/peertube-crypto'
import { doRequest, doRequestAndSaveToFile } from '../../helpers/requests'
import { getUrlFromWebfinger } from '../../helpers/webfinger'
import { CONFIG, IMAGE_MIMETYPE_EXT, sequelizeTypescript } from '../../initializers'
import { AccountModel } from '../../models/account/account'
import { ActorModel } from '../../models/activitypub/actor'
import { AvatarModel } from '../../models/avatar/avatar'
import { ServerModel } from '../../models/server/server'
import { VideoChannelModel } from '../../models/video/video-channel'
import { JobQueue } from '../job-queue'
import { getServerActor } from '../../helpers/utils'
import { ActorFetchByUrlType, fetchActorByUrl } from '../../helpers/actor'

// Set account keys, this could be long so process after the account creation and do not block the client
function setAsyncActorKeys (actor: ActorModel) {
  return createPrivateAndPublicKeys()
    .then(({ publicKey, privateKey }) => {
      actor.set('publicKey', publicKey)
      actor.set('privateKey', privateKey)
      return actor.save()
    })
    .catch(err => {
      logger.error('Cannot set public/private keys of actor %d.', actor.uuid, { err })
      return actor
    })
}

async function getOrCreateActorAndServerAndModel (
  activityActor: string | ActivityPubActor,
  fetchType: ActorFetchByUrlType = 'actor-and-association-ids',
  recurseIfNeeded = true,
  updateCollections = false
) {
  const actorUrl = getActorUrl(activityActor)
  let created = false

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
    let ownerActor: ActorModel = undefined
    if (recurseIfNeeded === true && result.actor.type === 'Group') {
      const accountAttributedTo = result.attributedTo.find(a => a.type === 'Person')
      if (!accountAttributedTo) throw new Error('Cannot find account attributed to video channel ' + actor.url)

      try {
        // Assert we don't recurse another time
        ownerActor = await getOrCreateActorAndServerAndModel(accountAttributedTo.id, 'all', false)
      } catch (err) {
        logger.error('Cannot get or create account attributed to video channel ' + actor.url)
        throw new Error(err)
      }
    }

    actor = await retryTransactionWrapper(saveActorAndServerAndModelIfNotExist, result, ownerActor)
    created = true
  }

  if (actor.Account) actor.Account.Actor = actor
  if (actor.VideoChannel) actor.VideoChannel.Actor = actor

  const { actor: actorRefreshed, refreshed } = await retryTransactionWrapper(refreshActorIfNeeded, actor, fetchType)
  if (!actorRefreshed) throw new Error('Actor ' + actorRefreshed.url + ' does not exist anymore.')

  if ((created === true || refreshed === true) && updateCollections === true) {
    const payload = { uri: actor.outboxUrl, type: 'activity' as 'activity' }
    await JobQueue.Instance.createJob({ type: 'activitypub-http-fetcher', payload })
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
    sharedInboxUrl: CONFIG.WEBSERVER.URL + '/inbox',
    followersUrl: url + '/followers',
    followingUrl: url + '/following'
  })
}

async function updateActorInstance (actorInstance: ActorModel, attributes: ActivityPubActor) {
  const followersCount = await fetchActorTotalItems(attributes.followers)
  const followingCount = await fetchActorTotalItems(attributes.following)

  actorInstance.set('type', attributes.type)
  actorInstance.set('uuid', attributes.uuid)
  actorInstance.set('preferredUsername', attributes.preferredUsername)
  actorInstance.set('url', attributes.id)
  actorInstance.set('publicKey', attributes.publicKey.publicKeyPem)
  actorInstance.set('followersCount', followersCount)
  actorInstance.set('followingCount', followingCount)
  actorInstance.set('inboxUrl', attributes.inbox)
  actorInstance.set('outboxUrl', attributes.outbox)
  actorInstance.set('sharedInboxUrl', attributes.endpoints.sharedInbox)
  actorInstance.set('followersUrl', attributes.followers)
  actorInstance.set('followingUrl', attributes.following)
}

async function updateActorAvatarInstance (actorInstance: ActorModel, avatarName: string, t: Transaction) {
  if (avatarName !== undefined) {
    if (actorInstance.avatarId) {
      try {
        await actorInstance.Avatar.destroy({ transaction: t })
      } catch (err) {
        logger.error('Cannot remove old avatar of actor %s.', actorInstance.url, { err })
      }
    }

    const avatar = await AvatarModel.create({
      filename: avatarName
    }, { transaction: t })

    actorInstance.set('avatarId', avatar.id)
    actorInstance.Avatar = avatar
  }

  return actorInstance
}

async function fetchActorTotalItems (url: string) {
  const options = {
    uri: url,
    method: 'GET',
    json: true,
    activityPub: true
  }

  try {
    const { body } = await doRequest(options)
    return body.totalItems ? body.totalItems : 0
  } catch (err) {
    logger.warn('Cannot fetch remote actor count %s.', url, { err })
    return 0
  }
}

async function fetchAvatarIfExists (actorJSON: ActivityPubActor) {
  if (
    actorJSON.icon && actorJSON.icon.type === 'Image' && IMAGE_MIMETYPE_EXT[actorJSON.icon.mediaType] !== undefined &&
    isActivityPubUrlValid(actorJSON.icon.url)
  ) {
    const extension = IMAGE_MIMETYPE_EXT[actorJSON.icon.mediaType]

    const avatarName = uuidv4() + extension
    const destPath = join(CONFIG.STORAGE.AVATARS_DIR, avatarName)

    await doRequestAndSaveToFile({
      method: 'GET',
      uri: actorJSON.icon.url
    }, destPath)

    return avatarName
  }

  return undefined
}

async function addFetchOutboxJob (actor: ActorModel) {
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

export {
  getOrCreateActorAndServerAndModel,
  buildActorInstance,
  setAsyncActorKeys,
  fetchActorTotalItems,
  fetchAvatarIfExists,
  updateActorInstance,
  updateActorAvatarInstance,
  addFetchOutboxJob
}

// ---------------------------------------------------------------------------

function saveActorAndServerAndModelIfNotExist (
  result: FetchRemoteActorResult,
  ownerActor?: ActorModel,
  t?: Transaction
): Bluebird<ActorModel> | Promise<ActorModel> {
  let actor = result.actor

  if (t !== undefined) return save(t)

  return sequelizeTypescript.transaction(t => save(t))

  async function save (t: Transaction) {
    const actorHost = url.parse(actor.url).host

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
    actor.set('serverId', server.id)

    // Avatar?
    if (result.avatarName) {
      const avatar = await AvatarModel.create({
        filename: result.avatarName
      }, { transaction: t })
      actor.set('avatarId', avatar.id)
    }

    // Force the actor creation, sometimes Sequelize skips the save() when it thinks the instance already exists
    // (which could be false in a retried query)
    const [ actorCreated ] = await ActorModel.findOrCreate({
      defaults: actor.toJSON(),
      where: {
        url: actor.url
      },
      transaction: t
    })

    if (actorCreated.type === 'Person' || actorCreated.type === 'Application') {
      actorCreated.Account = await saveAccount(actorCreated, result, t)
      actorCreated.Account.Actor = actorCreated
    } else if (actorCreated.type === 'Group') { // Video channel
      actorCreated.VideoChannel = await saveVideoChannel(actorCreated, result, ownerActor, t)
      actorCreated.VideoChannel.Actor = actorCreated
      actorCreated.VideoChannel.Account = ownerActor.Account
    }

    return actorCreated
  }
}

type FetchRemoteActorResult = {
  actor: ActorModel
  name: string
  summary: string
  support?: string
  avatarName?: string
  attributedTo: ActivityPubAttributedTo[]
}
async function fetchRemoteActor (actorUrl: string): Promise<{ statusCode?: number, result: FetchRemoteActorResult }> {
  const options = {
    uri: actorUrl,
    method: 'GET',
    json: true,
    activityPub: true
  }

  logger.info('Fetching remote actor %s.', actorUrl)

  const requestResult = await doRequest(options)
  normalizeActor(requestResult.body)

  const actorJSON: ActivityPubActor = requestResult.body

  if (isActorObjectValid(actorJSON) === false) {
    logger.debug('Remote actor JSON is not valid.', { actorJSON: actorJSON })
    return { result: undefined, statusCode: requestResult.response.statusCode }
  }

  const followersCount = await fetchActorTotalItems(actorJSON.followers)
  const followingCount = await fetchActorTotalItems(actorJSON.following)

  const actor = new ActorModel({
    type: actorJSON.type,
    uuid: actorJSON.uuid,
    preferredUsername: actorJSON.preferredUsername,
    url: actorJSON.id,
    publicKey: actorJSON.publicKey.publicKeyPem,
    privateKey: null,
    followersCount: followersCount,
    followingCount: followingCount,
    inboxUrl: actorJSON.inbox,
    outboxUrl: actorJSON.outbox,
    sharedInboxUrl: actorJSON.endpoints.sharedInbox,
    followersUrl: actorJSON.followers,
    followingUrl: actorJSON.following
  })

  const avatarName = await fetchAvatarIfExists(actorJSON)

  const name = actorJSON.name || actorJSON.preferredUsername
  return {
    statusCode: requestResult.response.statusCode,
    result: {
      actor,
      name,
      avatarName,
      summary: actorJSON.summary,
      support: actorJSON.support,
      attributedTo: actorJSON.attributedTo
    }
  }
}

async function saveAccount (actor: ActorModel, result: FetchRemoteActorResult, t: Transaction) {
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

  return accountCreated
}

async function saveVideoChannel (actor: ActorModel, result: FetchRemoteActorResult, ownerActor: ActorModel, t: Transaction) {
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

  return videoChannelCreated
}

async function refreshActorIfNeeded (
  actorArg: ActorModel,
  fetchedType: ActorFetchByUrlType
): Promise<{ actor: ActorModel, refreshed: boolean }> {
  if (!actorArg.isOutdated()) return { actor: actorArg, refreshed: false }

  // We need more attributes
  const actor = fetchedType === 'all' ? actorArg : await ActorModel.loadByUrlAndPopulateAccountAndChannel(actorArg.url)

  try {
    const actorUrl = await getUrlFromWebfinger(actor.preferredUsername + '@' + actor.getHost())
    const { result, statusCode } = await fetchRemoteActor(actorUrl)

    if (statusCode === 404) {
      logger.info('Deleting actor %s because there is a 404 in refresh actor.', actor.url)
      actor.Account ? actor.Account.destroy() : actor.VideoChannel.destroy()
      return { actor: undefined, refreshed: false }
    }

    if (result === undefined) {
      logger.warn('Cannot fetch remote actor in refresh actor.')
      return { actor, refreshed: false }
    }

    return sequelizeTypescript.transaction(async t => {
      updateInstanceWithAnother(actor, result.actor)

      if (result.avatarName !== undefined) {
        await updateActorAvatarInstance(actor, result.avatarName, t)
      }

      // Force update
      actor.setDataValue('updatedAt', new Date())
      await actor.save({ transaction: t })

      if (actor.Account) {
        actor.Account.set('name', result.name)
        actor.Account.set('description', result.summary)

        await actor.Account.save({ transaction: t })
      } else if (actor.VideoChannel) {
        actor.VideoChannel.set('name', result.name)
        actor.VideoChannel.set('description', result.summary)
        actor.VideoChannel.set('support', result.support)

        await actor.VideoChannel.save({ transaction: t })
      }

      return { refreshed: true, actor }
    })
  } catch (err) {
    logger.warn('Cannot refresh actor.', { err })
    return { actor, refreshed: false }
  }
}
