import { each, eachLimit, eachSeries, series, waterfall } from 'async'
import * as request from 'request'
import * as Sequelize from 'sequelize'

import { database as db } from '../initializers/database'
import {
  API_VERSION,
  CONFIG,
  REQUESTS_IN_PARALLEL,
  REQUEST_ENDPOINTS,
  REQUEST_ENDPOINT_ACTIONS,
  REMOTE_SCHEME
} from '../initializers'
import {
  logger,
  getMyPublicCert,
  makeSecureRequest,
  makeRetryRequest,
  createEmptyCallback
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
  RequestVideoQaduType
} from '../../shared'

type QaduParam = { videoId: string, type: RequestVideoQaduType }
type EventParam = { videoId: string, type: RequestVideoEventType }

const ENDPOINT_ACTIONS = REQUEST_ENDPOINT_ACTIONS[REQUEST_ENDPOINTS.VIDEOS]

const requestScheduler = new RequestScheduler()
const requestVideoQaduScheduler = new RequestVideoQaduScheduler()
const requestVideoEventScheduler = new RequestVideoEventScheduler()

function activateSchedulers () {
  requestScheduler.activate()
  requestVideoQaduScheduler.activate()
  requestVideoEventScheduler.activate()
}

function addVideoToFriends (videoData: Object, transaction: Sequelize.Transaction, callback: (err: Error) => void) {
  const options = {
    type: ENDPOINT_ACTIONS.ADD,
    endpoint: REQUEST_ENDPOINTS.VIDEOS,
    data: videoData,
    transaction
  }
  createRequest(options, callback)
}

function updateVideoToFriends (videoData: Object, transaction: Sequelize.Transaction, callback: (err: Error) => void) {
  const options = {
    type: ENDPOINT_ACTIONS.UPDATE,
    endpoint: REQUEST_ENDPOINTS.VIDEOS,
    data: videoData,
    transaction
  }
  createRequest(options, callback)
}

function removeVideoToFriends (videoParams: Object) {
  const options = {
    type: ENDPOINT_ACTIONS.REMOVE,
    endpoint: REQUEST_ENDPOINTS.VIDEOS,
    data: videoParams,
    transaction: null
  }
  createRequest(options)
}

function reportAbuseVideoToFriend (reportData: Object, video: VideoInstance) {
  const options = {
    type: ENDPOINT_ACTIONS.REPORT_ABUSE,
    endpoint: REQUEST_ENDPOINTS.VIDEOS,
    data: reportData,
    toIds: [ video.Author.podId ],
    transaction: null
  }
  createRequest(options)
}

function quickAndDirtyUpdateVideoToFriends (qaduParam: QaduParam, transaction?: Sequelize.Transaction, callback?: (err: Error) => void) {
  const options = {
    videoId: qaduParam.videoId,
    type: qaduParam.type,
    transaction
  }
  return createVideoQaduRequest(options, callback)
}

function quickAndDirtyUpdatesVideoToFriends (
  qadusParams: QaduParam[],
  transaction: Sequelize.Transaction,
  finalCallback: (err: Error) => void
) {
  const tasks = []

  qadusParams.forEach(function (qaduParams) {
    const fun = function (callback) {
      quickAndDirtyUpdateVideoToFriends(qaduParams, transaction, callback)
    }

    tasks.push(fun)
  })

  series(tasks, finalCallback)
}

function addEventToRemoteVideo (eventParam: EventParam, transaction?: Sequelize.Transaction, callback?: (err: Error) => void) {
  const options = {
    videoId: eventParam.videoId,
    type: eventParam.type,
    transaction
  }
  createVideoEventRequest(options, callback)
}

function addEventsToRemoteVideo (eventsParams: EventParam[], transaction: Sequelize.Transaction, finalCallback: (err: Error) => void) {
  const tasks = []

  eventsParams.forEach(function (eventParams) {
    const fun = function (callback) {
      addEventToRemoteVideo(eventParams, transaction, callback)
    }

    tasks.push(fun)
  })

  series(tasks, finalCallback)
}

function hasFriends (callback: (err: Error, hasFriends?: boolean) => void) {
  db.Pod.countAll(function (err, count) {
    if (err) return callback(err)

    const hasFriends = (count !== 0)
    callback(null, hasFriends)
  })
}

function makeFriends (hosts: string[], callback: (err: Error) => void) {
  const podsScore = {}

  logger.info('Make friends!')
  getMyPublicCert(function (err, cert) {
    if (err) {
      logger.error('Cannot read public cert.')
      return callback(err)
    }

    eachSeries(hosts, function (host, callbackEach) {
      computeForeignPodsList(host, podsScore, callbackEach)
    }, function (err: Error) {
      if (err) return callback(err)

      logger.debug('Pods scores computed.', { podsScore: podsScore })
      const podsList = computeWinningPods(hosts, podsScore)
      logger.debug('Pods that we keep.', { podsToKeep: podsList })

      makeRequestsToWinningPods(cert, podsList, callback)
    })
  })
}

function quitFriends (callback: (err: Error) => void) {
  // Stop pool requests
  requestScheduler.deactivate()

  waterfall([
    function flushRequests (callbackAsync) {
      requestScheduler.flush(err => callbackAsync(err))
    },

    function flushVideoQaduRequests (callbackAsync) {
      requestVideoQaduScheduler.flush(err => callbackAsync(err))
    },

    function getPodsList (callbackAsync) {
      return db.Pod.list(callbackAsync)
    },

    function announceIQuitMyFriends (pods, callbackAsync) {
      const requestParams = {
        method: 'POST' as 'POST',
        path: '/api/' + API_VERSION + '/remote/pods/remove',
        sign: true,
        toPod: null
      }

      // Announce we quit them
      // We don't care if the request fails
      // The other pod will exclude us automatically after a while
      eachLimit(pods, REQUESTS_IN_PARALLEL, function (pod, callbackEach) {
        requestParams.toPod = pod
        makeSecureRequest(requestParams, callbackEach)
      }, function (err) {
        if (err) {
          logger.error('Some errors while quitting friends.', { err: err })
          // Don't stop the process
        }

        return callbackAsync(null, pods)
      })
    },

    function removePodsFromDB (pods, callbackAsync) {
      each(pods, function (pod: any, callbackEach) {
        pod.destroy().asCallback(callbackEach)
      }, callbackAsync)
    }
  ], function (err: Error) {
    // Don't forget to re activate the scheduler, even if there was an error
    requestScheduler.activate()

    if (err) return callback(err)

    logger.info('Removed all remote videos.')
    return callback(null)
  })
}

function removeFriend (podId: number, callback: (err: Error) => void) {
  // Stop pool requests
  requestScheduler.deactivate()

  waterfall([
    function flushRequests (callbackAsync) {
      requestScheduler.flush(err => callbackAsync(err))
    },

    function flushVideoQaduRequests (callbackAsync) {
      requestVideoQaduScheduler.flush(err => callbackAsync(err))
    },

    function getPod (callbackAsync) {
      return db.Pod.load(podId, callbackAsync)
    },

    function announceIQuitThisFriend (pod, callbackAsync) {
      const requestParams = {
        method: 'POST' as 'POST',
        path: '/api/' + API_VERSION + '/remote/pods/remove',
        sign: true,
        toPod: pod
      }

      makeSecureRequest(requestParams, function (err) {
        if (err) {
          logger.error('Some errors while quitting friend.', { err: err })
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

function sendOwnedVideosToPod (podId) {
  db.Video.listOwnedAndPopulateAuthorAndTags(function (err, videosList) {
    if (err) {
      logger.error('Cannot get the list of videos we own.')
      return
    }

    videosList.forEach(function (video) {
      video.toAddRemoteJSON(function (err, remoteVideo) {
        if (err) {
          logger.error('Cannot convert video to remote.', { error: err })
          // Don't break the process
          return
        }

        const options = {
          type: 'add',
          endpoint: REQUEST_ENDPOINTS.VIDEOS,
          data: remoteVideo,
          toIds: [ podId ],
          transaction: null
        }
        createRequest(options)
      })
    })
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
  getRequestVideoEventScheduler
}

// ---------------------------------------------------------------------------

function computeForeignPodsList (host: string, podsScore: { [ host: string ]: number }, callback: (err: Error) => void) {
  getForeignPodsList(host, function (err, res) {
    if (err) return callback(err)

    const foreignPodsList = res.data

    // Let's give 1 point to the pod we ask the friends list
    foreignPodsList.push({ host })

    foreignPodsList.forEach(function (foreignPod) {
      const foreignPodHost = foreignPod.host

      if (podsScore[foreignPodHost]) podsScore[foreignPodHost]++
      else podsScore[foreignPodHost] = 1
    })

    return callback(null)
  })
}

function computeWinningPods (hosts: string[], podsScore: { [ host: string ]: number }) {
  // Build the list of pods to add
  // Only add a pod if it exists in more than a half base pods
  const podsList = []
  const baseScore = hosts.length / 2

  Object.keys(podsScore).forEach(function (podHost) {
    // If the pod is not me and with a good score we add it
    if (isMe(podHost) === false && podsScore[podHost] > baseScore) {
      podsList.push({ host: podHost })
    }
  })

  return podsList
}

function getForeignPodsList (host: string, callback: (err: Error, foreignPodsList?: any) => void) {
  const path = '/api/' + API_VERSION + '/pods'

  request.get(REMOTE_SCHEME.HTTP + '://' + host + path, function (err, response, body) {
    if (err) return callback(err)

    try {
      const json = JSON.parse(body)
      return callback(null, json)
    } catch (err) {
      return callback(err)
    }
  })
}

function makeRequestsToWinningPods (cert: string, podsList: PodInstance[], callback: (err: Error) => void) {
  // Stop pool requests
  requestScheduler.deactivate()
  // Flush pool requests
  requestScheduler.forceSend()

  eachLimit(podsList, REQUESTS_IN_PARALLEL, function (pod: PodInstance, callbackEach) {
    const params = {
      url: REMOTE_SCHEME.HTTP + '://' + pod.host + '/api/' + API_VERSION + '/pods/',
      method: 'POST' as 'POST',
      json: {
        host: CONFIG.WEBSERVER.HOST,
        email: CONFIG.ADMIN.EMAIL,
        publicKey: cert
      }
    }

    makeRetryRequest(params, function (err, res, body: { cert: string, email: string }) {
      if (err) {
        logger.error('Error with adding %s pod.', pod.host, { error: err })
        // Don't break the process
        return callbackEach()
      }

      if (res.statusCode === 200) {
        const podObj = db.Pod.build({ host: pod.host, publicKey: body.cert, email: body.email })
        podObj.save().asCallback(function (err, podCreated) {
          if (err) {
            logger.error('Cannot add friend %s pod.', pod.host, { error: err })
            return callbackEach()
          }

          // Add our videos to the request scheduler
          sendOwnedVideosToPod(podCreated.id)

          return callbackEach()
        })
      } else {
        logger.error('Status not 200 for %s pod.', pod.host)
        return callbackEach()
      }
    })
  }, function endRequests () {
    // Final callback, we've ended all the requests
    // Now we made new friends, we can re activate the pool of requests
    requestScheduler.activate()

    logger.debug('makeRequestsToWinningPods finished.')
    return callback(null)
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
function createRequest (options: CreateRequestOptions, callback?: (err: Error) => void) {
  if (!callback) callback = function () { /* empty */ }

  if (options.toIds !== undefined) return requestScheduler.createRequest(options as RequestSchedulerOptions, callback)

  // If the "toIds" pods is not specified, we send the request to all our friends
  db.Pod.listAllIds(options.transaction, function (err, podIds) {
    if (err) {
      logger.error('Cannot get pod ids', { error: err })
      return
    }

    const newOptions = Object.assign(options, { toIds: podIds })
    return requestScheduler.createRequest(newOptions, callback)
  })
}

function createVideoQaduRequest (options: RequestVideoQaduSchedulerOptions, callback: (err: Error) => void) {
  if (!callback) callback = createEmptyCallback()

  requestVideoQaduScheduler.createRequest(options, callback)
}

function createVideoEventRequest (options: RequestVideoEventSchedulerOptions, callback: (err: Error) => void) {
  if (!callback) callback = createEmptyCallback()

  requestVideoEventScheduler.createRequest(options, callback)
}

function isMe (host: string) {
  return host === CONFIG.WEBSERVER.HOST
}
