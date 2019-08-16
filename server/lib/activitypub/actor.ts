import * as Bluebird from 'bluebird'
import { Transaction } from 'sequelize'
import * as url from 'url'
import * as uuidv4 from 'uuid/v4'
import { ActivityPubActor, ActivityPubActorType } from '../../../shared/models/activitypub'
import { ActivityPubAttributedTo } from '../../../shared/models/activitypub/objects'
import { checkUrlsSameHost, getAPId } from '../../helpers/activitypub'
import { sanitizeAndCheckActorObject } from '../../helpers/custom-validators/activitypub/actor'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc'
import { retryTransactionWrapper, updateInstanceWithAnother } from '../../helpers/database-utils'
import { logger } from '../../helpers/logger'
import { createPrivateAndPublicKeys } from '../../helpers/peertube-crypto'
import { doRequest } from '../../helpers/requests'
import { getUrlFromWebfinger } from '../../helpers/webfinger'
import { MIMETYPES, WEBSERVER } from '../../initializers/constants'
import { AccountModel } from '../../models/account/account'
import { ActorModel } from '../../models/activitypub/actor'
import { AvatarModel } from '../../models/avatar/avatar'
import { ServerModel } from '../../models/server/server'
import { VideoChannelModel } from '../../models/video/video-channel'
import { JobQueue } from '../job-queue'
import { getServerActor } from '../../helpers/utils'
import { ActorFetchByUrlType, fetchActorByUrl } from '../../helpers/actor'
import { sequelizeTypescript } from '../../initializers/database'

// Set account keys, this could be long so process after the account creation and do not block the client
function setAsyncActorKeys (actor: ActorModel) {
  return createPrivateAndPublicKeys()
    .then(({ publicKey, privateKey }) => {
      actor.set('publicKey', publicKey)
      actor.set('privateKey', privateKey)
      return actor.save()
    })
    .catch(err => {
      logger.error('Cannot set public/private keys of actor %d.', actor.url, { err })
      return actor
    })
}

async function getOrCreateActorAndServerAndModel (
  activityActor: string | ActivityPubActor,
  fetchType: ActorFetchByUrlType = 'actor-and-association-ids',
  recurseIfNeeded = true,
  updateCollections = false
) {
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
    let ownerActor: ActorModel = undefined
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
        logger.error('Cannot get or create account attributed to video channel ' + actor.url)
        throw new Error(err)
      }
    }

    actor = await retryTransactionWrapper(saveActorAndServerAndModelIfNotExist, result, ownerActor)
    created = true
    accountPlaylistsUrl = result.playlists
  }

  if (actor.Account) actor.Account.Actor = actor
  if (actor.VideoChannel) actor.VideoChannel.Actor = actor

  const { actor: actorRefreshed, refreshed } = await retryTransactionWrapper(refreshActorIfNeeded, actor, fetchType)
  if (!actorRefreshed) throw new Error('Actor ' + actorRefreshed.url + ' does not exist anymore.')

  if ((created === true || refreshed === true) && updateCollections === true) {
    const payload = { uri: actor.outboxUrl, type: 'activity' as 'activity' }
    await JobQueue.Instance.createJob({ type: 'activitypub-http-fetcher', payload })
  }

  // We created a new account: fetch the playlists
  if (created === true && actor.Account && accountPlaylistsUrl) {
    const payload = { uri: accountPlaylistsUrl, accountId: actor.Account.id, type: 'account-playlists' as 'account-playlists' }
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
    sharedInboxUrl: WEBSERVER.URL + '/inbox',
    followersUrl: url + '/followers',
    followingUrl: url + '/following'
  })
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
  actorInstance.sharedInboxUrl = attributes.endpoints.sharedInbox
  actorInstance.followersUrl = attributes.followers
  actorInstance.followingUrl = attributes.following
}

async function updateActorAvatarInstance (actor: ActorModel, info: { name: string, onDisk: boolean, fileUrl: string }, t: Transaction) {
  if (info.name !== undefined) {
    if (actor.avatarId) {
      try {
        await actor.Avatar.destroy({ transaction: t })
      } catch (err) {
        logger.error('Cannot remove old avatar of actor %s.', actor.url, { err })
      }
    }

    const avatar = await AvatarModel.create({
      filename: info.name,
      onDisk: info.onDisk,
      fileUrl: info.fileUrl
    }, { transaction: t })

    actor.avatarId = avatar.id
    actor.Avatar = avatar
  }

  return actor
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

async function getAvatarInfoIfExists (actorJSON: ActivityPubActor) {
  if (
    actorJSON.icon && actorJSON.icon.type === 'Image' && MIMETYPES.IMAGE.MIMETYPE_EXT[actorJSON.icon.mediaType] !== undefined &&
    isActivityPubUrlValid(actorJSON.icon.url)
  ) {
    const extension = MIMETYPES.IMAGE.MIMETYPE_EXT[actorJSON.icon.mediaType]

    return {
      name: uuidv4() + extension,
      fileUrl: actorJSON.icon.url
    }
  }

  return undefined
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

async function refreshActorIfNeeded (
  actorArg: ActorModel,
  fetchedType: ActorFetchByUrlType
): Promise<{ actor: ActorModel, refreshed: boolean }> {
  if (!actorArg.isOutdated()) return { actor: actorArg, refreshed: false }

  // We need more attributes
  const actor = fetchedType === 'all' ? actorArg : await ActorModel.loadByUrlAndPopulateAccountAndChannel(actorArg.url)

  try {
    let actorUrl: string
    try {
      actorUrl = await getUrlFromWebfinger(actor.preferredUsername + '@' + actor.getHost())
    } catch (err) {
      logger.warn('Cannot get actor URL from webfinger, keeping the old one.', err)
      actorUrl = actor.url
    }

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

      if (result.avatar !== undefined) {
        const avatarInfo = {
          name: result.avatar.name,
          fileUrl: result.avatar.fileUrl,
          onDisk: false
        }

        await updateActorAvatarInstance(actor, avatarInfo, t)
      }

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
    logger.warn('Cannot refresh actor %s.', actor.url, { err })
    return { actor, refreshed: false }
  }
}

export {
  getOrCreateActorAndServerAndModel,
  buildActorInstance,
  setAsyncActorKeys,
  fetchActorTotalItems,
  getAvatarInfoIfExists,
  updateActorInstance,
  refreshActorIfNeeded,
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
    actor.serverId = server.id

    // Avatar?
    if (result.avatar) {
      const avatar = await AvatarModel.create({
        filename: result.avatar.name,
        fileUrl: result.avatar.fileUrl,
        onDisk: false
      }, { transaction: t })

      actor.avatarId = avatar.id
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

    actorCreated.Server = server

    return actorCreated
  }
}

type FetchRemoteActorResult = {
  actor: ActorModel
  name: string
  summary: string
  support?: string
  playlists?: string
  avatar?: {
    name: string,
    fileUrl: string
  }
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

  const requestResult = await doRequest<ActivityPubActor>(options)
  const actorJSON = requestResult.body

  if (sanitizeAndCheckActorObject(actorJSON) === false) {
    logger.debug('Remote actor JSON is not valid.', { actorJSON })
    return { result: undefined, statusCode: requestResult.response.statusCode }
  }

  if (checkUrlsSameHost(actorJSON.id, actorUrl) !== true) {
    logger.warn('Actor url %s has not the same host than its AP id %s', actorUrl, actorJSON.id)
    return { result: undefined, statusCode: requestResult.response.statusCode }
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
    sharedInboxUrl: actorJSON.endpoints.sharedInbox,
    followersUrl: actorJSON.followers,
    followingUrl: actorJSON.following
  })

  const avatarInfo = await getAvatarInfoIfExists(actorJSON)

  const name = actorJSON.name || actorJSON.preferredUsername
  return {
    statusCode: requestResult.response.statusCode,
    result: {
      actor,
      name,
      avatar: avatarInfo,
      summary: actorJSON.summary,
      support: actorJSON.support,
      playlists: actorJSON.playlists,
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
