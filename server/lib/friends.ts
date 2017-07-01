import { constant, waterfall } from 'async'

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
  Pod as FormatedPod
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
    type: ENDPOINT_ACTIONS.ADD,
    endpoint: REQUEST_ENDPOINTS.VIDEOS,
    data: videoData,
    transaction
  }
  return createRequest(options)
}

function updateVideoToFriends (videoData: RemoteVideoUpdateData, transaction: Sequelize.Transaction) {
  const options = {
    type: ENDPOINT_ACTIONS.UPDATE,
    endpoint: REQUEST_ENDPOINTS.VIDEOS,
    data: videoData,
    transaction
  }
  return createRequest(options)
}

function removeVideoToFriends (videoParams: RemoteVideoRemoveData) {
  const options = {
    type: ENDPOINT_ACTIONS.REMOVE,
    endpoint: REQUEST_ENDPOINTS.VIDEOS,
    data: videoParams,
    transaction: null
  }
  return createRequest(options)
}

function reportAbuseVideoToFriend (reportData: RemoteVideoReportAbuseData, video: VideoInstance, transaction: Sequelize.Transaction) {
  const options = {
    type: ENDPOINT_ACTIONS.REPORT_ABUSE,
    endpoint: REQUEST_ENDPOINTS.VIDEOS,
    data: reportData,
    toIds: [ video.Author.podId ],
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

function sendOwnedVideosToPod (podId: number) {
  db.Video.listOwnedAndPopulateAuthorAndTags()
    .then(videosList => {
      const tasks = []
      videosList.forEach(video => {
        const promise = video.toAddRemoteJSON()
          .then(remoteVideo => {
            const options = {
              type: 'add',
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

function fetchRemotePreview (pod: PodInstance, video: VideoInstance) {
  const host = video.Author.Pod.host
  const path = join(STATIC_PATHS.PREVIEWS, video.getPreviewName())

  return request.get(REMOTE_SCHEME.HTTP + '://' + host + path)
}

function removeFriend (pod: PodInstance, callback: (err: Error) => void) {
  // Stop pool requests
  requestScheduler.deactivate()

  waterfall([
    constant(pod),

    function announceIQuitThisFriend (pod, callbackAsync) {
      const requestParams = {
        method: 'POST' as 'POST',
        path: '/api/' + API_VERSION + '/remote/pods/remove',
        sign: true,
        toPod: pod
      }

      makeSecureRequest(requestParams, function (err) {
        if (err) {
          logger.error('Some errors while quitting friend %s (id: %d).', pod.host, pod.id, { err: err })
          // Continue anyway
        }

        return callbackAsync(null, pod)
      })
    },

    function removePodFromDB (pod, callbackAsync) {
      pod.destroy().asCallback(callbackAsync)
    }
  ], function (err: Error) {
    // Don't forget to re activate the scheduler, even if there was an error
    requestScheduler.activate()

    if (err) return callback(err)

    logger.info('Removed friend.')
    return callback(null)
  })
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
  updateVideoToFriends,
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
  sendOwnedVideosToPod,
  getRequestScheduler,
  getRequestVideoQaduScheduler,
  getRequestVideoEventScheduler,
  fetchRemotePreview
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
  return new Promise< ResultList<FormatedPod> >((res, rej) => {
    const path = '/api/' + API_VERSION + '/pods'

    request.get(REMOTE_SCHEME.HTTP + '://' + host + path, (err, response, body) => {
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
      url: REMOTE_SCHEME.HTTP + '://' + pod.host + '/api/' + API_VERSION + '/pods/',
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
              sendOwnedVideosToPod(podCreated.id)
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
  type: string
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
