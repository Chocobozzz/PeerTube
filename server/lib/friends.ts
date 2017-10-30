import * as request from 'request'
import * as Sequelize from 'sequelize'
import * as Bluebird from 'bluebird'
import { join } from 'path'

import { database as db } from '../initializers/database'
import {
  API_VERSION,
  CONFIG,
  REQUESTS_IN_PARALLEL,
  REQUEST_ENDPOINTS,
  REQUEST_ENDPOINT_ACTIONS,
  REMOTE_SCHEME,
  STATIC_PATHS
} from '../initializers'
import {
  logger,
  getMyPublicCert,
  makeSecureRequest,
  makeRetryRequest
} from '../helpers'
import {
  RequestScheduler,
  RequestSchedulerOptions,

  RequestVideoQaduScheduler,
  RequestVideoQaduSchedulerOptions,

  RequestVideoEventScheduler,
  RequestVideoEventSchedulerOptions
} from './request'
import {
  PodInstance,
  VideoInstance
} from '../models'
import {
  RequestEndpoint,
  RequestVideoEventType,
  RequestVideoQaduType,
  RemoteVideoCreateData,
  RemoteVideoUpdateData,
  RemoteVideoRemoveData,
  RemoteVideoReportAbuseData,
  ResultList,
  RemoteVideoRequestType,
  Pod as FormattedPod,
  RemoteVideoChannelCreateData,
  RemoteVideoChannelUpdateData,
  RemoteVideoChannelRemoveData,
  RemoteVideoAuthorCreateData,
  RemoteVideoAuthorRemoveData
} from '../../shared'

type QaduParam = { videoId: number, type: RequestVideoQaduType }
type EventParam = { videoId: number, type: RequestVideoEventType }

const ENDPOINT_ACTIONS = REQUEST_ENDPOINT_ACTIONS[REQUEST_ENDPOINTS.VIDEOS]

const requestScheduler = new RequestScheduler()
const requestVideoQaduScheduler = new RequestVideoQaduScheduler()
const requestVideoEventScheduler = new RequestVideoEventScheduler()

function activateSchedulers () {
  requestScheduler.activate()
  requestVideoQaduScheduler.activate()
  requestVideoEventScheduler.activate()
}

function addVideoToFriends (videoData: RemoteVideoCreateData, transaction: Sequelize.Transaction) {
  const options = {
    type: ENDPOINT_ACTIONS.ADD_VIDEO,
    endpoint: REQUEST_ENDPOINTS.VIDEOS,
    data: videoData,
    transaction
  }
  return createRequest(options)
}

function updateVideoToFriends (videoData: RemoteVideoUpdateData, transaction: Sequelize.Transaction) {
  const options = {
    type: ENDPOINT_ACTIONS.UPDATE_VIDEO,
    endpoint: REQUEST_ENDPOINTS.VIDEOS,
    data: videoData,
    transaction
  }
  return createRequest(options)
}

function removeVideoToFriends (videoParams: RemoteVideoRemoveData, transaction?: Sequelize.Transaction) {
  const options = {
    type: ENDPOINT_ACTIONS.REMOVE_VIDEO,
    endpoint: REQUEST_ENDPOINTS.VIDEOS,
    data: videoParams,
    transaction
  }
  return createRequest(options)
}

function addVideoAuthorToFriends (authorData: RemoteVideoAuthorCreateData, transaction: Sequelize.Transaction) {
  const options = {
    type: ENDPOINT_ACTIONS.ADD_AUTHOR,
    endpoint: REQUEST_ENDPOINTS.VIDEOS,
    data: authorData,
    transaction
  }
  return createRequest(options)
}

function removeVideoAuthorToFriends (authorData: RemoteVideoAuthorRemoveData, transaction?: Sequelize.Transaction) {
  const options = {
    type: ENDPOINT_ACTIONS.REMOVE_AUTHOR,
    endpoint: REQUEST_ENDPOINTS.VIDEOS,
    data: authorData,
    transaction
  }
  return createRequest(options)
}

function addVideoChannelToFriends (videoChannelData: RemoteVideoChannelCreateData, transaction: Sequelize.Transaction) {
  const options = {
    type: ENDPOINT_ACTIONS.ADD_CHANNEL,
    endpoint: REQUEST_ENDPOINTS.VIDEOS,
    data: videoChannelData,
    transaction
  }
  return createRequest(options)
}

function updateVideoChannelToFriends (videoChannelData: RemoteVideoChannelUpdateData, transaction: Sequelize.Transaction) {
  const options = {
    type: ENDPOINT_ACTIONS.UPDATE_CHANNEL,
    endpoint: REQUEST_ENDPOINTS.VIDEOS,
    data: videoChannelData,
    transaction
  }
  return createRequest(options)
}

function removeVideoChannelToFriends (videoChannelParams: RemoteVideoChannelRemoveData, transaction?: Sequelize.Transaction) {
  const options = {
    type: ENDPOINT_ACTIONS.REMOVE_CHANNEL,
    endpoint: REQUEST_ENDPOINTS.VIDEOS,
    data: videoChannelParams,
    transaction
  }
  return createRequest(options)
}

function reportAbuseVideoToFriend (reportData: RemoteVideoReportAbuseData, video: VideoInstance, transaction: Sequelize.Transaction) {
  const options = {
    type: ENDPOINT_ACTIONS.REPORT_ABUSE,
    endpoint: REQUEST_ENDPOINTS.VIDEOS,
    data: reportData,
    toIds: [ video.VideoChannel.Author.podId ],
    transaction
  }
  return createRequest(options)
}

function quickAndDirtyUpdateVideoToFriends (qaduParam: QaduParam, transaction?: Sequelize.Transaction) {
  const options = {
    videoId: qaduParam.videoId,
    type: qaduParam.type,
    transaction
  }
  return createVideoQaduRequest(options)
}

function quickAndDirtyUpdatesVideoToFriends (qadusParams: QaduParam[], transaction: Sequelize.Transaction) {
  const tasks = []

  qadusParams.forEach(qaduParams => {
    tasks.push(quickAndDirtyUpdateVideoToFriends(qaduParams, transaction))
  })

  return Promise.all(tasks)
}

function addEventToRemoteVideo (eventParam: EventParam, transaction?: Sequelize.Transaction) {
  const options = {
    videoId: eventParam.videoId,
    type: eventParam.type,
    transaction
  }
  return createVideoEventRequest(options)
}

function addEventsToRemoteVideo (eventsParams: EventParam[], transaction: Sequelize.Transaction) {
  const tasks = []

  for (const eventParams of eventsParams) {
    tasks.push(addEventToRemoteVideo(eventParams, transaction))
  }

  return Promise.all(tasks)
}

async function hasFriends () {
  const count = await db.Pod.countAll()

  return count !== 0
}

async function makeFriends (hosts: string[]) {
  const podsScore = {}

  logger.info('Make friends!')
  const cert = await getMyPublicCert()

  for (const host of hosts) {
    await computeForeignPodsList(host, podsScore)
  }

  logger.debug('Pods scores computed.', { podsScore: podsScore })

  const podsList = computeWinningPods(hosts, podsScore)
  logger.debug('Pods that we keep.', { podsToKeep: podsList })

  return makeRequestsToWinningPods(cert, podsList)
}

async function quitFriends () {
  // Stop pool requests
  requestScheduler.deactivate()

  try {
    await requestScheduler.flush()

    await requestVideoQaduScheduler.flush()

    const pods = await db.Pod.list()
    const requestParams = {
      method: 'POST' as 'POST',
      path: '/api/' + API_VERSION + '/remote/pods/remove',
      toPod: null
    }

    // Announce we quit them
    // We don't care if the request fails
    // The other pod will exclude us automatically after a while
    try {
      await Bluebird.map(pods, pod => {
        requestParams.toPod = pod

        return makeSecureRequest(requestParams)
      }, { concurrency: REQUESTS_IN_PARALLEL })
    } catch (err) { // Don't stop the process
      logger.error('Some errors while quitting friends.', err)
    }

    const tasks = []
    for (const pod of pods) {
      tasks.push(pod.destroy())
    }
    await Promise.all(pods)

    logger.info('Removed all remote videos.')

    requestScheduler.activate()
  } catch (err) {
    // Don't forget to re activate the scheduler, even if there was an error
    requestScheduler.activate()

    throw err
  }
}

async function sendOwnedDataToPod (podId: number) {
  // First send authors
  await sendOwnedAuthorsToPod(podId)
  await sendOwnedChannelsToPod(podId)
  await sendOwnedVideosToPod(podId)
}

async function sendOwnedChannelsToPod (podId: number) {
  const videoChannels = await db.VideoChannel.listOwned()

  const tasks: Promise<any>[] = []
  for (const videoChannel of videoChannels) {
    const remoteVideoChannel = videoChannel.toAddRemoteJSON()
    const options = {
      type: 'add-channel' as 'add-channel',
      endpoint: REQUEST_ENDPOINTS.VIDEOS,
      data: remoteVideoChannel,
      toIds: [ podId ],
      transaction: null
    }

    const p = createRequest(options)
    tasks.push(p)
  }

  await Promise.all(tasks)
}

async function sendOwnedAuthorsToPod (podId: number) {
  const authors = await db.Author.listOwned()
  const tasks: Promise<any>[] = []

  for (const author of authors) {
    const remoteAuthor = author.toAddRemoteJSON()
    const options = {
      type: 'add-author' as 'add-author',
      endpoint: REQUEST_ENDPOINTS.VIDEOS,
      data: remoteAuthor,
      toIds: [ podId ],
      transaction: null
    }

    const p = createRequest(options)
    tasks.push(p)
  }

  await Promise.all(tasks)
}

async function sendOwnedVideosToPod (podId: number) {
  const videosList = await db.Video.listOwnedAndPopulateAuthorAndTags()
  const tasks: Bluebird<any>[] = []

  for (const video of videosList) {
    const promise = video.toAddRemoteJSON()
      .then(remoteVideo => {
        const options = {
          type: 'add-video' as 'add-video',
          endpoint: REQUEST_ENDPOINTS.VIDEOS,
          data: remoteVideo,
          toIds: [ podId ],
          transaction: null
        }
        return createRequest(options)
      })
      .catch(err => {
        logger.error('Cannot convert video to remote.', err)
        // Don't break the process
        return undefined
      })

    tasks.push(promise)
  }

  await Promise.all(tasks)
}

function fetchRemotePreview (video: VideoInstance) {
  const host = video.VideoChannel.Author.Pod.host
  const path = join(STATIC_PATHS.PREVIEWS, video.getPreviewName())

  return request.get(REMOTE_SCHEME.HTTP + '://' + host + path)
}

function fetchRemoteDescription (video: VideoInstance) {
  const host = video.VideoChannel.Author.Pod.host
  const path = video.getDescriptionPath()

  const requestOptions = {
    url: REMOTE_SCHEME.HTTP + '://' + host + path,
    json: true
  }

  return new Promise<string>((res, rej) => {
    request.get(requestOptions, (err, response, body) => {
      if (err) return rej(err)

      return res(body.description ? body.description : '')
    })
  })
}

async function removeFriend (pod: PodInstance) {
  const requestParams = {
    method: 'POST' as 'POST',
    path: '/api/' + API_VERSION + '/remote/pods/remove',
    toPod: pod
  }

  try {
    await makeSecureRequest(requestParams)
  } catch (err) {
    logger.warn('Cannot notify friends %s we are quitting him.', pod.host, err)
  }

  try {
    await pod.destroy()

    logger.info('Removed friend %s.', pod.host)
  } catch (err) {
    logger.error('Cannot destroy friend %s.', pod.host, err)
  }
}

function getRequestScheduler () {
  return requestScheduler
}

function getRequestVideoQaduScheduler () {
  return requestVideoQaduScheduler
}

function getRequestVideoEventScheduler () {
  return requestVideoEventScheduler
}

// ---------------------------------------------------------------------------

export {
  activateSchedulers,
  addVideoToFriends,
  removeVideoAuthorToFriends,
  updateVideoToFriends,
  addVideoAuthorToFriends,
  reportAbuseVideoToFriend,
  quickAndDirtyUpdateVideoToFriends,
  quickAndDirtyUpdatesVideoToFriends,
  addEventToRemoteVideo,
  addEventsToRemoteVideo,
  hasFriends,
  makeFriends,
  quitFriends,
  removeFriend,
  removeVideoToFriends,
  sendOwnedDataToPod,
  getRequestScheduler,
  getRequestVideoQaduScheduler,
  getRequestVideoEventScheduler,
  fetchRemotePreview,
  addVideoChannelToFriends,
  fetchRemoteDescription,
  updateVideoChannelToFriends,
  removeVideoChannelToFriends
}

// ---------------------------------------------------------------------------

async function computeForeignPodsList (host: string, podsScore: { [ host: string ]: number }) {
  const result = await getForeignPodsList(host)
  const foreignPodsList: { host: string }[] = result.data

  // Let's give 1 point to the pod we ask the friends list
  foreignPodsList.push({ host })

  for (const foreignPod of foreignPodsList) {
    const foreignPodHost = foreignPod.host

    if (podsScore[foreignPodHost]) podsScore[foreignPodHost]++
    else podsScore[foreignPodHost] = 1
  }

  return undefined
}

function computeWinningPods (hosts: string[], podsScore: { [ host: string ]: number }) {
  // Build the list of pods to add
  // Only add a pod if it exists in more than a half base pods
  const podsList = []
  const baseScore = hosts.length / 2

  for (const podHost of Object.keys(podsScore)) {
    // If the pod is not me and with a good score we add it
    if (isMe(podHost) === false && podsScore[podHost] > baseScore) {
      podsList.push({ host: podHost })
    }
  }

  return podsList
}

function getForeignPodsList (host: string) {
  return new Promise< ResultList<FormattedPod> >((res, rej) => {
    const path = '/api/' + API_VERSION + '/remote/pods/list'

    request.post(REMOTE_SCHEME.HTTP + '://' + host + path, (err, response, body) => {
      if (err) return rej(err)

      try {
        const json: ResultList<FormattedPod> = JSON.parse(body)
        return res(json)
      } catch (err) {
        return rej(err)
      }
    })
  })
}

async function makeRequestsToWinningPods (cert: string, podsList: PodInstance[]) {
  // Stop pool requests
  requestScheduler.deactivate()
  // Flush pool requests
  requestScheduler.forceSend()

  try {
    await Bluebird.map(podsList, async pod => {
      const params = {
        url: REMOTE_SCHEME.HTTP + '://' + pod.host + '/api/' + API_VERSION + '/remote/pods/add',
        method: 'POST' as 'POST',
        json: {
          host: CONFIG.WEBSERVER.HOST,
          email: CONFIG.ADMIN.EMAIL,
          publicKey: cert
        }
      }

      const { response, body } = await makeRetryRequest(params)
      const typedBody = body as { cert: string, email: string }

      if (response.statusCode === 200) {
        const podObj = db.Pod.build({ host: pod.host, publicKey: typedBody.cert, email: typedBody.email })

        let podCreated: PodInstance
        try {
          podCreated = await podObj.save()
        } catch (err) {
          logger.error('Cannot add friend %s pod.', pod.host, err)
        }

        // Add our videos to the request scheduler
        sendOwnedDataToPod(podCreated.id)
          .catch(err => logger.warn('Cannot send owned data to pod %d.', podCreated.id, err))
      } else {
        logger.error('Status not 200 for %s pod.', pod.host)
      }
    }, { concurrency: REQUESTS_IN_PARALLEL })

    logger.debug('makeRequestsToWinningPods finished.')

    requestScheduler.activate()
  } catch (err) {
    // Final callback, we've ended all the requests
    // Now we made new friends, we can re activate the pool of requests
    requestScheduler.activate()
  }
}

// Wrapper that populate "toIds" argument with all our friends if it is not specified
type CreateRequestOptions = {
  type: RemoteVideoRequestType
  endpoint: RequestEndpoint
  data: Object
  toIds?: number[]
  transaction: Sequelize.Transaction
}
async function createRequest (options: CreateRequestOptions) {
  if (options.toIds !== undefined) {
    await requestScheduler.createRequest(options as RequestSchedulerOptions)
    return undefined
  }

  // If the "toIds" pods is not specified, we send the request to all our friends
  const podIds = await db.Pod.listAllIds(options.transaction)

  const newOptions = Object.assign(options, { toIds: podIds })
  await requestScheduler.createRequest(newOptions)

  return undefined
}

function createVideoQaduRequest (options: RequestVideoQaduSchedulerOptions) {
  return requestVideoQaduScheduler.createRequest(options)
}

function createVideoEventRequest (options: RequestVideoEventSchedulerOptions) {
  return requestVideoEventScheduler.createRequest(options)
}

function isMe (host: string) {
  return host === CONFIG.WEBSERVER.HOST
}
