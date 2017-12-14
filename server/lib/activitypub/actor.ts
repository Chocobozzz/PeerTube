import * as Bluebird from 'bluebird'
import { Transaction } from 'sequelize'
import * as url from 'url'
import { ActivityPubActor, ActivityPubActorType } from '../../../shared/models/activitypub'
import { ActivityPubAttributedTo } from '../../../shared/models/activitypub/objects'
import { createPrivateAndPublicKeys, doRequest, logger, retryTransactionWrapper } from '../../helpers'
import { isRemoteActorValid } from '../../helpers/custom-validators/activitypub'
import { ACTIVITY_PUB, CONFIG, sequelizeTypescript } from '../../initializers'
import { AccountModel } from '../../models/account/account'
import { ActorModel } from '../../models/activitypub/actor'
import { ServerModel } from '../../models/server/server'
import { VideoChannelModel } from '../../models/video/video-channel'

  // Set account keys, this could be long so process after the account creation and do not block the client
function setAsyncActorKeys (actor: ActorModel) {
  return createPrivateAndPublicKeys()
    .then(({ publicKey, privateKey }) => {
      actor.set('publicKey', publicKey)
      actor.set('privateKey', privateKey)
      return actor.save()
    })
    .catch(err => {
      logger.error('Cannot set public/private keys of actor %d.', actor.uuid, err)
      return actor
    })
}

async function getOrCreateActorAndServerAndModel (actorUrl: string, recurseIfNeeded = true) {
  let actor = await ActorModel.loadByUrl(actorUrl)

  // We don't have this actor in our database, fetch it on remote
  if (!actor) {
    const result = await fetchRemoteActor(actorUrl)
    if (result === undefined) throw new Error('Cannot fetch remote actor.')

    // Create the attributed to actor
    // In PeerTube a video channel is owned by an account
    let ownerActor: ActorModel = undefined
    if (recurseIfNeeded === true && result.actor.type === 'Group') {
      const accountAttributedTo = result.attributedTo.find(a => a.type === 'Person')
      if (!accountAttributedTo) throw new Error('Cannot find account attributed to video channel ' + actor.url)

      try {
        // Assert we don't recurse another time
        ownerActor = await getOrCreateActorAndServerAndModel(accountAttributedTo.id, false)
      } catch (err) {
        logger.error('Cannot get or create account attributed to video channel ' + actor.url)
        throw new Error(err)
      }
    }

    const options = {
      arguments: [ result, ownerActor ],
      errorMessage: 'Cannot save actor and server with many retries.'
    }
    actor = await retryTransactionWrapper(saveActorAndServerAndModelIfNotExist, options)
  }

  return actor
}

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

    // Force the actor creation, sometimes Sequelize skips the save() when it thinks the instance already exists
    // (which could be false in a retried query)
    const actorCreated = await ActorModel.create(actor.toJSON(), { transaction: t })

    if (actorCreated.type === 'Person' || actorCreated.type === 'Application') {
      const account = await saveAccount(actorCreated, result, t)
      actorCreated.Account = account
      actorCreated.Account.Actor = actorCreated
    } else if (actorCreated.type === 'Group') { // Video channel
      const videoChannel = await saveVideoChannel(actorCreated, result, ownerActor, t)
      actorCreated.VideoChannel = videoChannel
      actorCreated.VideoChannel.Actor = actorCreated
    }

    return actorCreated
  }
}

type FetchRemoteActorResult = {
  actor: ActorModel
  preferredUsername: string
  summary: string
  attributedTo: ActivityPubAttributedTo[]
}
async function fetchRemoteActor (actorUrl: string): Promise<FetchRemoteActorResult> {
  const options = {
    uri: actorUrl,
    method: 'GET',
    headers: {
      'Accept': ACTIVITY_PUB.ACCEPT_HEADER
    }
  }

  logger.info('Fetching remote actor %s.', actorUrl)

  let requestResult
  try {
    requestResult = await doRequest(options)
  } catch (err) {
    logger.warn('Cannot fetch remote actor %s.', actorUrl, err)
    return undefined
  }

  const actorJSON: ActivityPubActor = JSON.parse(requestResult.body)
  if (isRemoteActorValid(actorJSON) === false) {
    logger.debug('Remote actor JSON is not valid.', { actorJSON: actorJSON })
    return undefined
  }

  const followersCount = await fetchActorTotalItems(actorJSON.followers)
  const followingCount = await fetchActorTotalItems(actorJSON.following)

  const actor = new ActorModel({
    type: actorJSON.type,
    uuid: actorJSON.uuid,
    name: actorJSON.name,
    url: actorJSON.url,
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

  return {
    actor,
    preferredUsername: actorJSON.preferredUsername,
    summary: actorJSON.summary,
    attributedTo: actorJSON.attributedTo
  }
}

function buildActorInstance (type: ActivityPubActorType, url: string, name: string, uuid?: string) {
  return new ActorModel({
    type,
    url,
    name,
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

export {
  getOrCreateActorAndServerAndModel,
  saveActorAndServerAndModelIfNotExist,
  fetchRemoteActor,
  buildActorInstance,
  setAsyncActorKeys
}

// ---------------------------------------------------------------------------

async function fetchActorTotalItems (url: string) {
  const options = {
    uri: url,
    method: 'GET'
  }

  let requestResult
  try {
    requestResult = await doRequest(options)
  } catch (err) {
    logger.warn('Cannot fetch remote actor count %s.', url, err)
    return undefined
  }

  return requestResult.totalItems ? requestResult.totalItems : 0
}

function saveAccount (actor: ActorModel, result: FetchRemoteActorResult, t: Transaction) {
  const account = new AccountModel({
    name: result.preferredUsername,
    actorId: actor.id
  })

  return account.save({ transaction: t })
}

async function saveVideoChannel (actor: ActorModel, result: FetchRemoteActorResult, ownerActor: ActorModel, t: Transaction) {
  const videoChannel = new VideoChannelModel({
    name: result.preferredUsername,
    description: result.summary,
    actorId: actor.id,
    accountId: ownerActor.Account.id
  })

  return videoChannel.save({ transaction: t })
}
