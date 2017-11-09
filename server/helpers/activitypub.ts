import * as url from 'url'

import { database as db } from '../initializers'
import { logger } from './logger'
import { doRequest } from './requests'
import { isRemoteAccountValid } from './custom-validators'
import { ActivityPubActor } from '../../shared/models/activitypub/activitypub-actor'
import { ResultList } from '../../shared/models/result-list.model'

async function fetchRemoteAccountAndCreatePod (accountUrl: string) {
  const options = {
    uri: accountUrl,
    method: 'GET'
  }

  let requestResult
  try {
    requestResult = await doRequest(options)
  } catch (err) {
    logger.warning('Cannot fetch remote account %s.', accountUrl, err)
    return undefined
  }

  const accountJSON: ActivityPubActor = requestResult.body
  if (isRemoteAccountValid(accountJSON) === false) return undefined

  const followersCount = await fetchAccountCount(accountJSON.followers)
  const followingCount = await fetchAccountCount(accountJSON.following)

  const account = db.Account.build({
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

  const accountHost = url.parse(account.url).host
  const podOptions = {
    where: {
      host: accountHost
    },
    defaults: {
      host: accountHost
    }
  }
  const pod = await db.Pod.findOrCreate(podOptions)

  return { account, pod }
}

function activityPubContextify (data: object) {
  return Object.assign(data,{
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1',
      {
        'Hashtag': 'as:Hashtag',
        'uuid': 'http://schema.org/identifier',
        'category': 'http://schema.org/category',
        'licence': 'http://schema.org/license',
        'nsfw': 'as:sensitive',
        'language': 'http://schema.org/inLanguage',
        'views': 'http://schema.org/Number',
        'size': 'http://schema.org/Number'
      }
    ]
  })
}

function activityPubCollectionPagination (url: string, page: number, result: ResultList<any>) {
  const baseUrl = url.split('?').shift

  const obj = {
    id: baseUrl,
    type: 'Collection',
    totalItems: result.total,
    first: {
      id: baseUrl + '?page=' + page,
      type: 'CollectionPage',
      totalItems: result.total,
      next: baseUrl + '?page=' + (page + 1),
      partOf: baseUrl,
      items: result.data
    }
  }

  return activityPubContextify(obj)
}

// ---------------------------------------------------------------------------

export {
  fetchRemoteAccountAndCreatePod,
  activityPubContextify,
  activityPubCollectionPagination
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
    logger.warning('Cannot fetch remote account count %s.', url, err)
    return undefined
  }

  return requestResult.totalItems ? requestResult.totalItems : 0
}
