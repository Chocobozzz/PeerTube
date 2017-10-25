import * as Sequelize from 'sequelize'

import { database as db } from '../../initializers/database'
import { AbstractRequestScheduler, RequestsObjects } from './abstract-request-scheduler'
import { logger } from '../../helpers'
import {
  REQUESTS_VIDEO_QADU_LIMIT_PODS,
  REQUESTS_VIDEO_QADU_LIMIT_PER_POD,
  REQUEST_VIDEO_QADU_ENDPOINT,
  REQUEST_VIDEO_QADU_TYPES
} from '../../initializers'
import { RequestsVideoQaduGrouped, PodInstance } from '../../models'
import { RemoteQaduVideoRequest, RequestVideoQaduType } from '../../../shared'

// We create a custom interface because we need "videos" attribute for our computations
interface RequestsObjectsCustom<U> extends RequestsObjects<U> {
  [ id: string ]: {
    toPod: PodInstance
    endpoint: string
    ids: number[] // ids
    datas: U[]

    videos: {
      [ uuid: string ]: {
        uuid: string
        likes?: number
        dislikes?: number
        views?: number
      }
    }
  }
}

export type RequestVideoQaduSchedulerOptions = {
  type: RequestVideoQaduType
  videoId: number
  transaction?: Sequelize.Transaction
}

class RequestVideoQaduScheduler extends AbstractRequestScheduler<RequestsVideoQaduGrouped> {
  constructor () {
    super()

    // We limit the size of the requests
    this.limitPods = REQUESTS_VIDEO_QADU_LIMIT_PODS
    this.limitPerPod = REQUESTS_VIDEO_QADU_LIMIT_PER_POD

    this.description = 'video QADU requests'
  }

  getRequestModel () {
    return db.RequestVideoQadu
  }

  getRequestToPodModel () {
    return db.RequestVideoQadu
  }

  buildRequestsObjects (requests: RequestsVideoQaduGrouped) {
    const requestsToMakeGrouped: RequestsObjectsCustom<RemoteQaduVideoRequest> = {}

    for (const toPodId of Object.keys(requests)) {
      for (const data of requests[toPodId]) {
        const request = data.request
        const video = data.video
        const pod = data.pod
        const hashKey = toPodId

        if (!requestsToMakeGrouped[hashKey]) {
          requestsToMakeGrouped[hashKey] = {
            toPod: pod,
            endpoint: REQUEST_VIDEO_QADU_ENDPOINT,
            ids: [], // request ids, to delete them from the DB in the future
            datas: [], // requests data
            videos: {}
          }
        }

        // Maybe another attribute was filled for this video
        let videoData = requestsToMakeGrouped[hashKey].videos[video.id]
        if (!videoData) videoData = { uuid: null }

        switch (request.type) {
        case REQUEST_VIDEO_QADU_TYPES.LIKES:
          videoData.likes = video.likes
          break

        case REQUEST_VIDEO_QADU_TYPES.DISLIKES:
          videoData.dislikes = video.dislikes
          break

        case REQUEST_VIDEO_QADU_TYPES.VIEWS:
          videoData.views = video.views
          break

        default:
          logger.error('Unknown request video QADU type %s.', request.type)
          return
        }

        // Do not forget the uuid so the remote pod can identify the video
        videoData.uuid = video.uuid
        requestsToMakeGrouped[hashKey].ids.push(request.id)

        // Maybe there are multiple quick and dirty update for the same video
        // We use this hash map to dedupe them
        requestsToMakeGrouped[hashKey].videos[video.id] = videoData
      }
    }

    // Now we deduped similar quick and dirty updates, we can build our requests data
    for (const hashKey of Object.keys(requestsToMakeGrouped)) {
      for (const videoUUID of Object.keys(requestsToMakeGrouped[hashKey].videos)) {
        const videoData = requestsToMakeGrouped[hashKey].videos[videoUUID]

        requestsToMakeGrouped[hashKey].datas.push({
          data: videoData
        })
      }

      // We don't need it anymore, it was just to build our data array
      delete requestsToMakeGrouped[hashKey].videos
    }

    return requestsToMakeGrouped
  }

  async createRequest ({ type, videoId, transaction }: RequestVideoQaduSchedulerOptions) {
    const dbRequestOptions: Sequelize.BulkCreateOptions = {}
    if (transaction) dbRequestOptions.transaction = transaction

    // Send the update to all our friends
    const podIds = await db.Pod.listAllIds(transaction)
    const queries = []
    for (const podId of podIds) {
      queries.push({ type, videoId, podId })
    }

    await db.RequestVideoQadu.bulkCreate(queries, dbRequestOptions)
    return undefined
  }
}

// ---------------------------------------------------------------------------

export {
  RequestVideoQaduScheduler
}
