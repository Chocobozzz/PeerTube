import { isEmpty } from 'lodash'
import * as Promise from 'bluebird'

import { database as db } from '../../initializers/database'
import { logger, makeSecureRequest } from '../../helpers'
import { AbstractRequestClass, AbstractRequestToPodClass, PodInstance } from '../../models'
import {
  API_VERSION,
  REQUESTS_IN_PARALLEL,
  REQUESTS_INTERVAL
} from '../../initializers'

interface RequestsObjects<U> {
  [ id: string ]: {
    toPod: PodInstance
    endpoint: string
    ids: number[] // ids
    datas: U[]
  }
}

abstract class AbstractRequestScheduler <T> {
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

  abstract getRequestModel (): AbstractRequestClass<T>
  abstract getRequestToPodModel (): AbstractRequestToPodClass
  abstract buildRequestsObjects (requestsGrouped: T): RequestsObjects<any>

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

  remainingRequestsCount () {
    return this.getRequestModel().countTotalRequests()
  }

  flush () {
    return this.getRequestModel().removeAll()
  }

  // ---------------------------------------------------------------------------

  // Make a requests to friends of a certain type
  protected makeRequest (toPod: PodInstance, requestEndpoint: string, requestsToMake: any) {
    const params = {
      toPod: toPod,
      method: 'POST' as 'POST',
      path: '/api/' + API_VERSION + '/remote/' + requestEndpoint,
      data: requestsToMake // Requests we need to make
    }

    // Make multiple retry requests to all of pods
    // The function fire some useful callbacks
    return makeSecureRequest(params)
      .then(({ response, body }) => {
        if (response.statusCode !== 200 && response.statusCode !== 201 && response.statusCode !== 204) {
          throw new Error('Status code not 20x : ' + response.statusCode)
        }
      })
      .catch(err => {
        logger.error('Error sending secure request to %s pod.', toPod.host, err)

        throw err
      })
  }

    // Make all the requests of the scheduler
  protected makeRequests () {
    return this.getRequestModel().listWithLimitAndRandom(this.limitPods, this.limitPerPod)
      .then((requestsGrouped: T) => {
        // We want to group requests by destinations pod and endpoint
        const requestsToMake = this.buildRequestsObjects(requestsGrouped)

        // If there are no requests, abort
        if (isEmpty(requestsToMake) === true) {
          logger.info('No "%s" to make.', this.description)
          return { goodPods: [], badPods: [] }
        }

        logger.info('Making "%s" to friends.', this.description)

        const goodPods: number[] = []
        const badPods: number[] = []

        return Promise.map(Object.keys(requestsToMake), hashKey => {
          const requestToMake = requestsToMake[hashKey]
          const toPod: PodInstance = requestToMake.toPod

          return this.makeRequest(toPod, requestToMake.endpoint, requestToMake.datas)
            .then(() => {
              logger.debug('Removing requests for pod %s.', requestToMake.toPod.id, { requestsIds: requestToMake.ids })
              goodPods.push(requestToMake.toPod.id)

              this.afterRequestHook()

              // Remove the pod id of these request ids
              return this.getRequestToPodModel().removeByRequestIdsAndPod(requestToMake.ids, requestToMake.toPod.id)
            })
            .catch(err => {
              badPods.push(requestToMake.toPod.id)
              logger.info('Cannot make request to %s.', toPod.host, err)
            })
        }, { concurrency: REQUESTS_IN_PARALLEL }).then(() => ({ goodPods, badPods }))
      })
      .then(({ goodPods, badPods }) => {
        this.afterRequestsHook()

        // All the requests were made, we update the pods score
        return db.Pod.updatePodsScore(goodPods, badPods)
      })
      .catch(err => logger.error('Cannot get the list of "%s".', this.description, { error: err.stack }))
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
  AbstractRequestScheduler,
  RequestsObjects
}
