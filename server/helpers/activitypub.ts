import { join } from 'path'
import * as request from 'request'
import * as Sequelize from 'sequelize'
import * as url from 'url'
import { ActivityIconObject } from '../../shared/index'
import { Activity } from '../../shared/models/activitypub/activity'
import { ActivityPubActor } from '../../shared/models/activitypub/activitypub-actor'
import { VideoChannelObject } from '../../shared/models/activitypub/objects/video-channel-object'
import { ResultList } from '../../shared/models/result-list.model'
import { database as db, REMOTE_SCHEME } from '../initializers'
import { ACTIVITY_PUB_ACCEPT_HEADER, CONFIG, STATIC_PATHS } from '../initializers/constants'
import { videoChannelActivityObjectToDBAttributes } from '../lib/activitypub/misc'
import { sendVideoAnnounce } from '../lib/activitypub/send-request'
import { sendVideoChannelAnnounce } from '../lib/index'
import { AccountInstance } from '../models/account/account-interface'
import { VideoChannelInstance } from '../models/video/video-channel-interface'
import { VideoInstance } from '../models/video/video-interface'
import { isRemoteAccountValid } from './custom-validators'
import { isVideoChannelObjectValid } from './custom-validators/activitypub/videos'
import { logger } from './logger'
import { signObject } from './peertube-crypto'
import { doRequest, doRequestAndSaveToFile } from './requests'
import { getServerAccount } from './utils'

function generateThumbnailFromUrl (video: VideoInstance, icon: ActivityIconObject) {
  const thumbnailName = video.getThumbnailName()
  const thumbnailPath = join(CONFIG.STORAGE.THUMBNAILS_DIR, thumbnailName)

  const options = {
    method: 'GET',
    uri: icon.url
  }
  return doRequestAndSaveToFile(options, thumbnailPath)
}

async function shareVideoChannelByServer (videoChannel: VideoChannelInstance, t: Sequelize.Transaction) {
  const serverAccount = await getServerAccount()

  await db.VideoChannelShare.create({
    accountId: serverAccount.id,
    videoChannelId: videoChannel.id
  }, { transaction: t })

  return sendVideoChannelAnnounce(serverAccount, videoChannel, t)
}

async function shareVideoByServer (video: VideoInstance, t: Sequelize.Transaction) {
  const serverAccount = await getServerAccount()

  await db.VideoShare.create({
    accountId: serverAccount.id,
    videoId: video.id
  }, { transaction: t })

  return sendVideoAnnounce(serverAccount, video, t)
}

function getActivityPubUrl (type: 'video' | 'videoChannel' | 'account' | 'videoAbuse', id: string) {
  if (type === 'video') return CONFIG.WEBSERVER.URL + '/videos/watch/' + id
  else if (type === 'videoChannel') return CONFIG.WEBSERVER.URL + '/video-channels/' + id
  else if (type === 'account') return CONFIG.WEBSERVER.URL + '/account/' + id
  else if (type === 'videoAbuse') return CONFIG.WEBSERVER.URL + '/admin/video-abuses/' + id

  return ''
}

async function getOrCreateAccount (accountUrl: string) {
  let account = await db.Account.loadByUrl(accountUrl)

  // We don't have this account in our database, fetch it on remote
  if (!account) {
    const res = await fetchRemoteAccountAndCreateServer(accountUrl)
    if (res === undefined) throw new Error('Cannot fetch remote account.')

    // Save our new account in database
    account = await res.account.save()
  }

  return account
}

async function getOrCreateVideoChannel (ownerAccount: AccountInstance, videoChannelUrl: string) {
  let videoChannel = await db.VideoChannel.loadByUrl(videoChannelUrl)

  // We don't have this account in our database, fetch it on remote
  if (!videoChannel) {
    videoChannel = await fetchRemoteVideoChannel(ownerAccount, videoChannelUrl)
    if (videoChannel === undefined) throw new Error('Cannot fetch remote video channel.')

    // Save our new video channel in database
    await videoChannel.save()
  }

  return videoChannel
}

async function fetchRemoteAccountAndCreateServer (accountUrl: string) {
  const options = {
    uri: accountUrl,
    method: 'GET',
    headers: {
      'Accept': ACTIVITY_PUB_ACCEPT_HEADER
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
  const serverOptions = {
    where: {
      host: accountHost
    },
    defaults: {
      host: accountHost
    }
  }
  const [ server ] = await db.Server.findOrCreate(serverOptions)
  account.set('serverId', server.id)

  return { account, server }
}

async function fetchRemoteVideoChannel (ownerAccount: AccountInstance, videoChannelUrl: string) {
  const options = {
    uri: videoChannelUrl,
    method: 'GET',
    headers: {
      'Accept': ACTIVITY_PUB_ACCEPT_HEADER
    }
  }

  logger.info('Fetching remote video channel %s.', videoChannelUrl)

  let requestResult
  try {
    requestResult = await doRequest(options)
  } catch (err) {
    logger.warn('Cannot fetch remote video channel %s.', videoChannelUrl, err)
    return undefined
  }

  const videoChannelJSON: VideoChannelObject = JSON.parse(requestResult.body)
  if (isVideoChannelObjectValid(videoChannelJSON) === false) {
    logger.debug('Remote video channel JSON is not valid.', { videoChannelJSON })
    return undefined
  }

  const videoChannelAttributes = videoChannelActivityObjectToDBAttributes(videoChannelJSON, ownerAccount)
  const videoChannel = db.VideoChannel.build(videoChannelAttributes)
  videoChannel.Account = ownerAccount

  return videoChannel
}

function fetchRemoteVideoPreview (video: VideoInstance) {
  // FIXME: use url
  const host = video.VideoChannel.Account.Server.host
  const path = join(STATIC_PATHS.PREVIEWS, video.getPreviewName())

  return request.get(REMOTE_SCHEME.HTTP + '://' + host + path)
}

async function fetchRemoteVideoDescription (video: VideoInstance) {
  const options = {
    uri: video.url
  }

  const { body } = await doRequest(options)
  return body.description ? body.description : ''
}

function activityPubContextify <T> (data: T) {
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
        'size': 'http://schema.org/Number',
        'VideoChannel': 'https://peertu.be/ns/VideoChannel'
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

function buildSignedActivity (byAccount: AccountInstance, data: Object) {
  const activity = activityPubContextify(data)

  return signObject(byAccount, activity) as Promise<Activity>
}

// ---------------------------------------------------------------------------

export {
  fetchRemoteAccountAndCreateServer,
  activityPubContextify,
  activityPubCollectionPagination,
  getActivityPubUrl,
  generateThumbnailFromUrl,
  getOrCreateAccount,
  fetchRemoteVideoPreview,
  fetchRemoteVideoDescription,
  shareVideoChannelByServer,
  shareVideoByServer,
  getOrCreateVideoChannel,
  buildSignedActivity
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
