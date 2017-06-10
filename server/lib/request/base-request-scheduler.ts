import * as eachLimit from 'async/eachLimit'

import { database as db } from '../../initializers/database'
import { logger, makeSecureRequest } from '../../helpers'
import { PodInstance } from '../../models'
import {
  API_VERSION,
  REQUESTS_IN_PARALLEL,
  REQUESTS_INTERVAL
} from '../../initializers'

abstract class BaseRequestScheduler {
  requestInterval: number
  limitPods: number
  limitPerPod: number

  protected lastRequestTimestamp: number
  protected timer: NodeJS.Timer
  protected description: string

  constructor () {
    this.lastRequestTimestamp = 0
    this.timer = null
    this.requestInterval = REQUESTS_INTERVAL
  }

  abstract getRequestModel ()
  abstract getRequestToPodModel ()
  abstract buildRequestObjects (requests: any)

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

    return REQUESTS_INTERVAL - (Date.now() - this.lastRequestTimestamp)
  }

  remainingRequestsCount (callback: (err: Error, total: number) => void) {
    return this.getRequestModel().countTotalRequests(callback)
  }

  flush (callback: (err: Error) => void) {
    this.getRequestModel().removeAll(callback)
  }

  // ---------------------------------------------------------------------------

  // Make a requests to friends of a certain type
  protected makeRequest (toPod: PodInstance, requestEndpoint: string, requestsToMake: Object, callback) {
    if (!callback) callback = function () { /* empty */ }

    const params = {
      toPod: toPod,
      sign: true, // Prove our identity
      method: 'POST' as 'POST',
      path: '/api/' + API_VERSION + '/remote/' + requestEndpoint,
      data: requestsToMake // Requests we need to make
    }

    // Make multiple retry requests to all of pods
    // The function fire some useful callbacks
    makeSecureRequest(params, (err, res) => {
      if (err || (res.statusCode !== 200 && res.statusCode !== 201 && res.statusCode !== 204)) {
        err = err ? err.message : 'Status code not 20x : ' + res.statusCode
        logger.error('Error sending secure request to %s pod.', toPod.host, { error: err })

        return callback(err)
      }

      return callback(null)
    })
  }

    // Make all the requests of the scheduler
  protected makeRequests () {
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

      eachLimit(Object.keys(requestsToMakeGrouped), REQUESTS_IN_PARALLEL, (hashKey, callbackEach) => {
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

  protected afterRequestHook () {
   // Nothing to do, let children reimplement it
  }

  protected afterRequestsHook () {
   // Nothing to do, let children reimplement it
  }
}

// ---------------------------------------------------------------------------

export {
  BaseRequestScheduler
}
