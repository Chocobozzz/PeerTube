import * as Sequelize from 'sequelize'

import { database as db } from '../../initializers/database'
import { AbstractRequestScheduler } from './abstract-request-scheduler'
import {
  REQUESTS_VIDEO_EVENT_LIMIT_PODS,
  REQUESTS_VIDEO_EVENT_LIMIT_PER_POD,
  REQUEST_VIDEO_EVENT_ENDPOINT
} from '../../initializers'
import { RequestsVideoEventGrouped } from '../../models'
import { RequestVideoEventType } from '../../../shared'

export type RequestVideoEventSchedulerOptions = {
  type: RequestVideoEventType
  videoId: string
  count?: number
  transaction?: Sequelize.Transaction
}

class RequestVideoEventScheduler extends AbstractRequestScheduler<RequestsVideoEventGrouped> {
  constructor () {
    super()

    // We limit the size of the requests
    this.limitPods = REQUESTS_VIDEO_EVENT_LIMIT_PODS
    this.limitPerPod = REQUESTS_VIDEO_EVENT_LIMIT_PER_POD

    this.description = 'video event requests'
  }

  getRequestModel () {
    return db.RequestVideoEvent
  }

  getRequestToPodModel () {
    return db.RequestVideoEvent
  }

  buildRequestObjects (eventRequests: RequestsVideoEventGrouped) {
    const requestsToMakeGrouped = {}

    /* Example:
        {
          pod1: {
            video1: { views: 4, likes: 5 },
            video2: { likes: 5 }
          }
        }
    */
    const eventsPerVideoPerPod = {}

    // We group video events per video and per pod
    // We add the counts of the same event types
    Object.keys(eventRequests).forEach(toPodId => {
      eventRequests[toPodId].forEach(eventToProcess => {
        if (!eventsPerVideoPerPod[toPodId]) eventsPerVideoPerPod[toPodId] = {}

        if (!requestsToMakeGrouped[toPodId]) {
          requestsToMakeGrouped[toPodId] = {
            toPod: eventToProcess.pod,
            endpoint: REQUEST_VIDEO_EVENT_ENDPOINT,
            ids: [], // request ids, to delete them from the DB in the future
            datas: [] // requests data
          }
        }
        requestsToMakeGrouped[toPodId].ids.push(eventToProcess.id)

        const eventsPerVideo = eventsPerVideoPerPod[toPodId]
        const remoteId = eventToProcess.video.remoteId
        if (!eventsPerVideo[remoteId]) eventsPerVideo[remoteId] = {}

        const events = eventsPerVideo[remoteId]
        if (!events[eventToProcess.type]) events[eventToProcess.type] = 0

        events[eventToProcess.type] += eventToProcess.count
      })
    })

    // Now we build our requests array per pod
    Object.keys(eventsPerVideoPerPod).forEach(toPodId => {
      const eventsForPod = eventsPerVideoPerPod[toPodId]

      Object.keys(eventsForPod).forEach(remoteId => {
        const eventsForVideo = eventsForPod[remoteId]

        Object.keys(eventsForVideo).forEach(eventType => {
          requestsToMakeGrouped[toPodId].datas.push({
            data: {
              remoteId,
              eventType,
              count: eventsForVideo[eventType]
            }
          })
        })
      })
    })

    return requestsToMakeGrouped
  }

  createRequest ({ type, videoId, count, transaction }: RequestVideoEventSchedulerOptions) {
    if (count === undefined) count = 1

    const dbRequestOptions: Sequelize.CreateOptions = {}
    if (transaction) dbRequestOptions.transaction = transaction

    const createQuery = {
      type,
      count,
      videoId
    }

    return db.RequestVideoEvent.create(createQuery, dbRequestOptions)
  }
}

// ---------------------------------------------------------------------------

export {
  RequestVideoEventScheduler
}
