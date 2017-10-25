import * as Sequelize from 'sequelize'

import { database as db } from '../../initializers/database'
import { AbstractRequestScheduler, RequestsObjects } from './abstract-request-scheduler'
import { logger } from '../../helpers'
import { REQUESTS_LIMIT_PODS, REQUESTS_LIMIT_PER_POD } from '../../initializers'
import { RequestsGrouped } from '../../models'
import { RequestEndpoint, RemoteVideoRequest } from '../../../shared'

export type RequestSchedulerOptions = {
  type: string
  endpoint: RequestEndpoint
  data: Object
  toIds: number[]
  transaction: Sequelize.Transaction
}

class RequestScheduler extends AbstractRequestScheduler<RequestsGrouped> {
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

  buildRequestsObjects (requestsGrouped: RequestsGrouped) {
    const requestsToMakeGrouped: RequestsObjects<RemoteVideoRequest> = {}

    for (const toPodId of Object.keys(requestsGrouped)) {
      for (const data of requestsGrouped[toPodId]) {
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
      }
    }

    return requestsToMakeGrouped
  }

  async createRequest ({ type, endpoint, data, toIds, transaction }: RequestSchedulerOptions) {
    // If there are no destination pods abort
    if (toIds.length === 0) return undefined

    const createQuery = {
      endpoint,
      request: {
        type: type,
        data: data
      }
    }

    const dbRequestOptions: Sequelize.CreateOptions = {
      transaction
    }

    const request = await db.Request.create(createQuery, dbRequestOptions)
    await request.setPods(toIds, dbRequestOptions)
  }

  // ---------------------------------------------------------------------------

  afterRequestsHook () {
    // Flush requests with no pod
    this.getRequestModel().removeWithEmptyTo()
      .catch(err => logger.error('Error when removing requests with no pods.', err))
  }
}

// ---------------------------------------------------------------------------

export {
  RequestScheduler
}
