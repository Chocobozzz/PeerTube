import * as Bluebird from 'bluebird'
import { Transaction } from 'sequelize'
import * as url from 'url'
import { ActivityPubActor } from '../../../shared/models/activitypub'
import { doRequest, logger, retryTransactionWrapper } from '../../helpers'
import { isRemoteAccountValid } from '../../helpers/custom-validators/activitypub'
import { ACTIVITY_PUB, sequelizeTypescript } from '../../initializers'
import { AccountModel } from '../../models/account/account'
import { ServerModel } from '../../models/server/server'

async function getOrCreateAccountAndServer (accountUrl: string) {
  let account = await AccountModel.loadByUrl(accountUrl)

  // We don't have this account in our database, fetch it on remote
  if (!account) {
    account = await fetchRemoteAccount(accountUrl)
    if (account === undefined) throw new Error('Cannot fetch remote account.')

    const options = {
      arguments: [ account ],
      errorMessage: 'Cannot save account and server with many retries.'
    }
    account = await retryTransactionWrapper(saveAccountAndServerIfNotExist, options)
  }

  return account
}

function saveAccountAndServerIfNotExist (account: AccountModel, t?: Transaction): Bluebird<AccountModel> | Promise<AccountModel> {
  if (t !== undefined) {
    return save(t)
  } else {
    return sequelizeTypescript.transaction(t => {
      return save(t)
    })
  }

  async function save (t: Transaction) {
    const accountHost = url.parse(account.url).host

    const serverOptions = {
      where: {
        host: accountHost
      },
      defaults: {
        host: accountHost
      },
      transaction: t
    }
    const [ server ] = await ServerModel.findOrCreate(serverOptions)

    // Save our new account in database
    account.set('serverId', server.id)
    account = await account.save({ transaction: t })

    return account
  }
}

async function fetchRemoteAccount (accountUrl: string) {
  const options = {
    uri: accountUrl,
    method: 'GET',
    headers: {
      'Accept': ACTIVITY_PUB.ACCEPT_HEADER
    }
  }

  logger.info('Fetching remote account %s.', accountUrl)

  let requestResult
  try {
    requestResult = await doRequest(options)
  } catch (err) {
    logger.warn('Cannot fetch remote account %s.', accountUrl, err)
    return undefined
  }

  const accountJSON: ActivityPubActor = JSON.parse(requestResult.body)
  if (isRemoteAccountValid(accountJSON) === false) {
    logger.debug('Remote account JSON is not valid.', { accountJSON })
    return undefined
  }

  const followersCount = await fetchAccountCount(accountJSON.followers)
  const followingCount = await fetchAccountCount(accountJSON.following)

  return new AccountModel({
    uuid: accountJSON.uuid,
    name: accountJSON.preferredUsername,
    url: accountJSON.url,
    publicKey: accountJSON.publicKey.publicKeyPem,
    privateKey: null,
    followersCount: followersCount,
    followingCount: followingCount,
    inboxUrl: accountJSON.inbox,
    outboxUrl: accountJSON.outbox,
    sharedInboxUrl: accountJSON.endpoints.sharedInbox,
    followersUrl: accountJSON.followers,
    followingUrl: accountJSON.following
  })
}

export {
  getOrCreateAccountAndServer,
  fetchRemoteAccount,
  saveAccountAndServerIfNotExist
}

// ---------------------------------------------------------------------------

async function fetchAccountCount (url: string) {
  const options = {
    uri: url,
    method: 'GET'
  }

  let requestResult
  try {
    requestResult = await doRequest(options)
  } catch (err) {
    logger.warn('Cannot fetch remote account count %s.', url, err)
    return undefined
  }

  return requestResult.totalItems ? requestResult.totalItems : 0
}
