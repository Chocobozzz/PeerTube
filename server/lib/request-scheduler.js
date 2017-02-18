'use strict'

const eachLimit = require('async/eachLimit')

const constants = require('../initializers/constants')
const db = require('../initializers/database')
const logger = require('../helpers/logger')
const requests = require('../helpers/requests')

module.exports = class RequestScheduler {

  constructor (name) {
    this.name = name

    this.lastRequestTimestamp = 0
    this.timer = null
  }

  activate () {
    logger.info('Requests scheduler activated.')
    this.lastRequestTimestamp = Date.now()

    this.timer = setInterval(() => {
      this.lastRequestTimestamp = Date.now()
      this.makeRequests()
    }, constants.REQUESTS_INTERVAL)
  }

  deactivate () {
    logger.info('Requests scheduler deactivated.')
    clearInterval(this.timer)
    this.timer = null
  }

  forceSend () {
    logger.info('Force requests scheduler sending.')
    this.makeRequests()
  }

  remainingMilliSeconds () {
    if (this.timer === null) return -1

    return constants.REQUESTS_INTERVAL - (Date.now() - this.lastRequestTimestamp)
  }

  // { type, endpoint, data, toIds, transaction }
  createRequest (options, callback) {
    const type = options.type
    const endpoint = options.endpoint
    const data = options.data
    const toIds = options.toIds
    const transaction = options.transaction

    const pods = []

    // If there are no destination pods abort
    if (toIds.length === 0) return callback(null)

    toIds.forEach(toPod => {
      pods.push(db.Pod.build({ id: toPod }))
    })

    const createQuery = {
      endpoint,
      request: {
        type: type,
        data: data
      }
    }

    const dbRequestOptions = {
      transaction
    }

    return db.Request.create(createQuery, dbRequestOptions).asCallback((err, request) => {
      if (err) return callback(err)

      return request.setPods(pods, dbRequestOptions).asCallback(callback)
    })
  }

  // ---------------------------------------------------------------------------

  // Make all the requests of the scheduler
  makeRequests () {
    // We limit the size of the requests
    // We don't want to stuck with the same failing requests so we get a random list
    db.Request.listWithLimitAndRandom(constants.REQUESTS_LIMIT_PODS, constants.REQUESTS_LIMIT_PER_POD, (err, requests) => {
      if (err) {
        logger.error('Cannot get the list of requests.', { err: err })
        return // Abort
      }

      // If there are no requests, abort
      if (requests.length === 0) {
        logger.info('No requests to make.')
        return
      }

      // We want to group requests by destinations pod and endpoint
      const requestsToMakeGrouped = this.buildRequestObjects(requests)

      logger.info('Making requests to friends.')

      const goodPods = []
      const badPods = []

      eachLimit(Object.keys(requestsToMakeGrouped), constants.REQUESTS_IN_PARALLEL, (hashKey, callbackEach) => {
        const requestToMake = requestsToMakeGrouped[hashKey]
        const toPod = requestToMake.toPod

        // Maybe the pod is not our friend anymore so simply remove it
        if (!toPod) {
          const requestIdsToDelete = requestToMake.ids

          logger.info('Removing %d requests of unexisting pod %s.', requestIdsToDelete.length, requestToMake.toPod.id)
          return db.RequestToPod.removePodOf(requestIdsToDelete, requestToMake.toPod.id, callbackEach)
        }

        this.makeRequest(toPod, requestToMake.endpoint, requestToMake.datas, (success) => {
          if (success === false) {
            badPods.push(requestToMake.toPod.id)
            return callbackEach()
          }

          logger.debug('Removing requests for pod %s.', requestToMake.toPod.id, { requestsIds: requestToMake.ids })
          goodPods.push(requestToMake.toPod.id)

          // Remove the pod id of these request ids
          db.RequestToPod.removePodOf(requestToMake.ids, requestToMake.toPod.id, callbackEach)
        })
      }, () => {
        // All the requests were made, we update the pods score
        db.Request.updatePodsScore(goodPods, badPods)
        // Flush requests with no pod
        db.Request.removeWithEmptyTo(err => {
          if (err) logger.error('Error when removing requests with no pods.', { error: err })
        })
      })
    })
  }

  // Make a requests to friends of a certain type
  makeRequest (toPod, requestEndpoint, requestsToMake, callback) {
    if (!callback) callback = function () {}

    const params = {
      toPod: toPod,
      sign: true, // Prove our identity
      method: 'POST',
      path: '/api/' + constants.API_VERSION + '/remote/' + requestEndpoint,
      data: requestsToMake // Requests we need to make
    }

    // Make multiple retry requests to all of pods
    // The function fire some useful callbacks
    requests.makeSecureRequest(params, (err, res) => {
      if (err || (res.statusCode !== 200 && res.statusCode !== 201 && res.statusCode !== 204)) {
        err = err ? err.message : 'Status code not 20x : ' + res.statusCode
        logger.error('Error sending secure request to %s pod.', toPod.host, { error: err })

        return callback(false)
      }

      return callback(true)
    })
  }

  buildRequestObjects (requests) {
    const requestsToMakeGrouped = {}

    Object.keys(requests).forEach(toPodId => {
      requests[toPodId].forEach(data => {
        const request = data.request
        const pod = data.pod
        const hashKey = toPodId + request.endpoint

        if (!requestsToMakeGrouped[hashKey]) {
          requestsToMakeGrouped[hashKey] = {
            toPod: pod,
            endpoint: request.endpoint,
            ids: [], // request ids, to delete them from the DB in the future
            datas: [] // requests data,
          }
        }

        requestsToMakeGrouped[hashKey].ids.push(request.id)
        requestsToMakeGrouped[hashKey].datas.push(request.request)
      })
    })

    return requestsToMakeGrouped
  }

  flush (callback) {
    db.Request.removeAll(err => {
      if (err) logger.error('Cannot flush the requests.', { error: err })

      return callback(err)
    })
  }
}
