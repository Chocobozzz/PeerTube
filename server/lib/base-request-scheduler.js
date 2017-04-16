'use strict'

const eachLimit = require('async/eachLimit')

const constants = require('../initializers/constants')
const db = require('../initializers/database')
const logger = require('../helpers/logger')
const requests = require('../helpers/requests')

module.exports = class BaseRequestScheduler {
  constructor (options) {
    this.lastRequestTimestamp = 0
    this.timer = null
    this.requestInterval = constants.REQUESTS_INTERVAL
  }

  activate () {
    logger.info('Requests scheduler activated.')
    this.lastRequestTimestamp = Date.now()

    this.timer = setInterval(() => {
      this.lastRequestTimestamp = Date.now()
      this.makeRequests()
    }, this.requestInterval)
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

  remainingRequestsCount (callback) {
    return this.getRequestModel().countTotalRequests(callback)
  }

  // ---------------------------------------------------------------------------

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

        return callback(err)
      }

      return callback(null)
    })
  }

    // Make all the requests of the scheduler
  makeRequests () {
    this.getRequestModel().listWithLimitAndRandom(this.limitPods, this.limitPerPod, (err, requests) => {
      if (err) {
        logger.error('Cannot get the list of "%s".', this.description, { err: err })
        return // Abort
      }

      // If there are no requests, abort
      if (requests.length === 0) {
        logger.info('No "%s" to make.', this.description)
        return
      }

      // We want to group requests by destinations pod and endpoint
      const requestsToMakeGrouped = this.buildRequestObjects(requests)

      logger.info('Making "%s" to friends.', this.description)

      const goodPods = []
      const badPods = []

      eachLimit(Object.keys(requestsToMakeGrouped), constants.REQUESTS_IN_PARALLEL, (hashKey, callbackEach) => {
        const requestToMake = requestsToMakeGrouped[hashKey]
        const toPod = requestToMake.toPod

        this.makeRequest(toPod, requestToMake.endpoint, requestToMake.datas, (err) => {
          if (err) {
            badPods.push(requestToMake.toPod.id)
            return callbackEach()
          }

          logger.debug('Removing requests for pod %s.', requestToMake.toPod.id, { requestsIds: requestToMake.ids })
          goodPods.push(requestToMake.toPod.id)

          // Remove the pod id of these request ids
          this.getRequestToPodModel().removeByRequestIdsAndPod(requestToMake.ids, requestToMake.toPod.id, callbackEach)

          this.afterRequestHook()
        })
      }, () => {
        // All the requests were made, we update the pods score
        db.Pod.updatePodsScore(goodPods, badPods)

        this.afterRequestsHook()
      })
    })
  }

  flush (callback) {
    this.getRequestModel().removeAll(callback)
  }

  afterRequestHook () {
   // Nothing to do, let children reimplement it
  }

  afterRequestsHook () {
   // Nothing to do, let children reimplement it
  }
}
