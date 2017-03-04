'use strict'

const BaseRequestScheduler = require('./base-request-scheduler')
const constants = require('../initializers/constants')
const db = require('../initializers/database')

module.exports = class RequestVideoEventScheduler extends BaseRequestScheduler {
  constructor () {
    super()

    // We limit the size of the requests
    this.limitPods = constants.REQUESTS_VIDEO_EVENT_LIMIT_PODS
    this.limitPerPod = constants.REQUESTS_VIDEO_EVENT_LIMIT_PER_POD

    this.description = 'video event requests'
  }

  getRequestModel () {
    return db.RequestVideoEvent
  }

  getRequestToPodModel () {
    return db.RequestVideoEvent
  }

  buildRequestObjects (eventsToProcess) {
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
    Object.keys(eventsToProcess).forEach(toPodId => {
      eventsToProcess[toPodId].forEach(eventToProcess => {
        if (!eventsPerVideoPerPod[toPodId]) eventsPerVideoPerPod[toPodId] = {}

        if (!requestsToMakeGrouped[toPodId]) {
          requestsToMakeGrouped[toPodId] = {
            toPod: eventToProcess.pod,
            endpoint: constants.REQUEST_VIDEO_EVENT_ENDPOINT,
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

  // { type, videoId, count?, transaction? }
  createRequest (options, callback) {
    const type = options.type
    const videoId = options.videoId
    const transaction = options.transaction
    let count = options.count

    if (count === undefined) count = 1

    const dbRequestOptions = {}
    if (transaction) dbRequestOptions.transaction = transaction

    const createQuery = {
      type,
      count,
      videoId
    }

    return db.RequestVideoEvent.create(createQuery, dbRequestOptions).asCallback(callback)
  }
}
