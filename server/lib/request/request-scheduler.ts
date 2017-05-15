const db = require('../../initializers/database')
import { BaseRequestScheduler } from './base-request-scheduler'
import { logger } from '../../helpers'
import {
  REQUESTS_LIMIT_PODS,
  REQUESTS_LIMIT_PER_POD
} from '../../initializers'

class RequestScheduler extends BaseRequestScheduler {
  constructor () {
    super()

    // We limit the size of the requests
    this.limitPods = REQUESTS_LIMIT_PODS
    this.limitPerPod = REQUESTS_LIMIT_PER_POD

    this.description = 'requests'
  }

  getRequestModel () {
    return db.Request
  }

  getRequestToPodModel () {
    return db.RequestToPod
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

  afterRequestsHook () {
    // Flush requests with no pod
    this.getRequestModel().removeWithEmptyTo(err => {
      if (err) logger.error('Error when removing requests with no pods.', { error: err })
    })
  }
}

// ---------------------------------------------------------------------------

export {
  RequestScheduler
}
