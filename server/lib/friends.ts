import * as request from 'request'
import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'
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

function removeVideoToFriends (videoParams: RemoteVideoRemoveData, transaction: Sequelize.Transaction) {
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

function removeVideoAuthorToFriends (authorData: RemoteVideoAuthorRemoveData, transaction: Sequelize.Transaction) {
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

function removeVideoChannelToFriends (videoChannelParams: RemoteVideoChannelRemoveData, transaction: Sequelize.Transaction) {
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

  eventsParams.forEach(eventParams => {
    tasks.push(addEventToRemoteVideo(eventParams, transaction))
  })

  return Promise.all(tasks)
}

function hasFriends () {
  return db.Pod.countAll().then(count => count !== 0)
}

function makeFriends (hosts: string[]) {
  const podsScore = {}

  logger.info('Make friends!')
  return getMyPublicCert()
    .then(cert => {
      return Promise.each(hosts, host => computeForeignPodsList(host, podsScore)).then(() => cert)
    })
    .then(cert => {
      logger.debug('Pods scores computed.', { podsScore: podsScore })
      const podsList = computeWinningPods(hosts, podsScore)
      logger.debug('Pods that we keep.', { podsToKeep: podsList })

      return makeRequestsToWinningPods(cert, podsList)
    })
}

function quitFriends () {
  // Stop pool requests
  requestScheduler.deactivate()

  return requestScheduler.flush()
    .then(() => {
      return requestVideoQaduScheduler.flush()
    })
    .then(() => {
      return db.Pod.list()
    })
    .then(pods => {
      const requestParams = {
        method: 'POST' as 'POST',
        path: '/api/' + API_VERSION + '/remote/pods/remove',
        toPod: null
      }

      // Announce we quit them
      // We don't care if the request fails
      // The other pod will exclude us automatically after a while
      return Promise.map(pods, pod => {
        requestParams.toPod = pod

        return makeSecureRequest(requestParams)
      }, { concurrency: REQUESTS_IN_PARALLEL })
      .then(() => pods)
      .catch(err => {
        logger.error('Some errors while quitting friends.', err)
        // Don't stop the process
        return pods
      })
    })
    .then(pods => {
      const tasks = []
      pods.forEach(pod => tasks.push(pod.destroy()))

      return Promise.all(pods)
    })
    .then(() => {
      logger.info('Removed all remote videos.')
      // Don't forget to re activate the scheduler, even if there was an error
      return requestScheduler.activate()
    })
    .finally(() => requestScheduler.activate())
}

function sendOwnedDataToPod (podId: number) {
  // First send authors
  return sendOwnedAuthorsToPod(podId)
    .then(() => sendOwnedChannelsToPod(podId))
    .then(() => sendOwnedVideosToPod(podId))
}

function sendOwnedChannelsToPod (podId: number) {
  return db.VideoChannel.listOwned()
    .then(videoChannels => {
      const tasks = []
      videoChannels.forEach(videoChannel => {
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
      })

      return Promise.all(tasks)
    })
}

function sendOwnedAuthorsToPod (podId: number) {
  return db.Author.listOwned()
    .then(authors => {
      const tasks = []
      authors.forEach(author => {
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
      })

      return Promise.all(tasks)
    })
}

function sendOwnedVideosToPod (podId: number) {
  return db.Video.listOwnedAndPopulateAuthorAndTags()
    .then(videosList => {
      const tasks = []
      videosList.forEach(video => {
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
      })

      return Promise.all(tasks)
    })
}

function fetchRemotePreview (video: VideoInstance) {
  const host = video.VideoChannel.Author.Pod.host
  const path = join(STATIC_PATHS.PREVIEWS, video.getPreviewName())

  return request.get(REMOTE_SCHEME.HTTP + '://' + host + path)
}

function removeFriend (pod: PodInstance) {
  const requestParams = {
    method: 'POST' as 'POST',
    path: '/api/' + API_VERSION + '/remote/pods/remove',
    toPod: pod
  }

  return makeSecureRequest(requestParams)
    .catch(err => logger.warn('Cannot notify friends %s we are quitting him.', pod.host, err))
    .then(() => pod.destroy())
    .then(() => logger.info('Removed friend %s.', pod.host))
    .catch(err => logger.error('Cannot destroy friend %s.', pod.host, err))
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
  updateVideoChannelToFriends,
  removeVideoChannelToFriends
}

// ---------------------------------------------------------------------------

function computeForeignPodsList (host: string, podsScore: { [ host: string ]: number }) {
  // TODO: type res
  return getForeignPodsList(host).then(res => {
    const foreignPodsList: { host: string }[] = res.data

    // Let's give 1 point to the pod we ask the friends list
    foreignPodsList.push({ host })

    foreignPodsList.forEach(foreignPod => {
      const foreignPodHost = foreignPod.host

      if (podsScore[foreignPodHost]) podsScore[foreignPodHost]++
      else podsScore[foreignPodHost] = 1
    })

    return undefined
  })
}

function computeWinningPods (hosts: string[], podsScore: { [ host: string ]: number }) {
  // Build the list of pods to add
  // Only add a pod if it exists in more than a half base pods
  const podsList = []
  const baseScore = hosts.length / 2

  Object.keys(podsScore).forEach(podHost => {
    // If the pod is not me and with a good score we add it
    if (isMe(podHost) === false && podsScore[podHost] > baseScore) {
      podsList.push({ host: podHost })
    }
  })

  return podsList
}

function getForeignPodsList (host: string) {
  return new Promise< ResultList<FormattedPod> >((res, rej) => {
    const path = '/api/' + API_VERSION + '/remote/pods/list'

    request.post(REMOTE_SCHEME.HTTP + '://' + host + path, (err, response, body) => {
      if (err) return rej(err)

      try {
        const json = JSON.parse(body)
        return res(json)
      } catch (err) {
        return rej(err)
      }
    })
  })
}

function makeRequestsToWinningPods (cert: string, podsList: PodInstance[]) {
  // Stop pool requests
  requestScheduler.deactivate()
  // Flush pool requests
  requestScheduler.forceSend()

  return Promise.map(podsList, pod => {
    const params = {
      url: REMOTE_SCHEME.HTTP + '://' + pod.host + '/api/' + API_VERSION + '/remote/pods/add',
      method: 'POST' as 'POST',
      json: {
        host: CONFIG.WEBSERVER.HOST,
        email: CONFIG.ADMIN.EMAIL,
        publicKey: cert
      }
    }

    return makeRetryRequest(params)
      .then(({ response, body }) => {
        body = body as { cert: string, email: string }

        if (response.statusCode === 200) {
          const podObj = db.Pod.build({ host: pod.host, publicKey: body.cert, email: body.email })
          return podObj.save()
            .then(podCreated => {

              // Add our videos to the request scheduler
              sendOwnedDataToPod(podCreated.id)
            })
            .catch(err => {
              logger.error('Cannot add friend %s pod.', pod.host, err)
            })
        } else {
          logger.error('Status not 200 for %s pod.', pod.host)
        }
      })
      .catch(err => {
        logger.error('Error with adding %s pod.', pod.host, { error: err.stack })
        // Don't break the process
      })
  }, { concurrency: REQUESTS_IN_PARALLEL })
  .then(() => logger.debug('makeRequestsToWinningPods finished.'))
  .finally(() => {
    // Final callback, we've ended all the requests
    // Now we made new friends, we can re activate the pool of requests
    requestScheduler.activate()
  })
}

// Wrapper that populate "toIds" argument with all our friends if it is not specified
type CreateRequestOptions = {
  type: RemoteVideoRequestType
  endpoint: RequestEndpoint
  data: Object
  toIds?: number[]
  transaction: Sequelize.Transaction
}
function createRequest (options: CreateRequestOptions) {
  if (options.toIds !== undefined) return requestScheduler.createRequest(options as RequestSchedulerOptions)

  // If the "toIds" pods is not specified, we send the request to all our friends
  return db.Pod.listAllIds(options.transaction).then(podIds => {
    const newOptions = Object.assign(options, { toIds: podIds })
    return requestScheduler.createRequest(newOptions)
  })
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
