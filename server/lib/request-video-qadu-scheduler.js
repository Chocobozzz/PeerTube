'use strict'

const BaseRequestScheduler = require('./base-request-scheduler')
const constants = require('../initializers/constants')
const db = require('../initializers/database')
const logger = require('../helpers/logger')

module.exports = class RequestVideoQaduScheduler extends BaseRequestScheduler {

  constructor () {
    super()

    // We limit the size of the requests
    this.limitPods = constants.REQUESTS_VIDEO_QADU_LIMIT_PODS
    this.limitPerPod = constants.REQUESTS_VIDEO_QADU_LIMIT_PER_POD

    this.description = 'video QADU requests'
  }

  getRequestModel () {
    return db.RequestVideoQadu
  }

  getRequestToPodModel () {
    return db.RequestVideoQadu
  }

  buildRequestObjects (requests) {
    const requestsToMakeGrouped = {}

    Object.keys(requests).forEach(toPodId => {
      requests[toPodId].forEach(data => {
        const request = data.request
        const video = data.video
        const pod = data.pod
        const hashKey = toPodId

        if (!requestsToMakeGrouped[hashKey]) {
          requestsToMakeGrouped[hashKey] = {
            toPod: pod,
            endpoint: constants.REQUEST_ENDPOINTS.QADU,
            ids: [], // request ids, to delete them from the DB in the future
            datas: [], // requests data
            videos: {}
          }
        }

        if (!requestsToMakeGrouped[hashKey].videos[video.id]) {
          requestsToMakeGrouped[hashKey].videos[video.id] = {}
        }

        const videoData = requestsToMakeGrouped[hashKey].videos[video.id]

        switch (request.type) {
          case constants.REQUEST_VIDEO_QADU_TYPES.LIKES:
            videoData.likes = video.likes
            break

          case constants.REQUEST_VIDEO_QADU_TYPES.DISLIKES:
            videoData.likes = video.dislikes
            break

          case constants.REQUEST_VIDEO_QADU_TYPES.VIEWS:
            videoData.views = video.views
            break

          default:
            logger.error('Unknown request video QADU type %s.', request.type)
            return
        }

        // Do not forget the remoteId so the remote pod can identify the video
        videoData.remoteId = video.id
        requestsToMakeGrouped[hashKey].ids.push(request.id)
        requestsToMakeGrouped[hashKey].videos[video.id] = videoData
      })
    })

    Object.keys(requestsToMakeGrouped).forEach(hashKey => {
      Object.keys(requestsToMakeGrouped[hashKey].videos).forEach(videoId => {
        const videoData = requestsToMakeGrouped[hashKey].videos[videoId]

        requestsToMakeGrouped[hashKey].datas.push({
          data: videoData
        })
      })

      // We don't need it anymore, it was just to build our datas array
      delete requestsToMakeGrouped[hashKey].videos
    })

    return requestsToMakeGrouped
  }

  // { type, videoId, transaction? }
  createRequest (options, callback) {
    const type = options.type
    const videoId = options.videoId
    const transaction = options.transaction

    const dbRequestOptions = {}
    if (transaction) dbRequestOptions.transaction = transaction

    // Send the update to all our friends
    db.Pod.listAllIds(options.transaction, function (err, podIds) {
      if (err) return callback(err)

      const queries = []
      podIds.forEach(podId => {
        queries.push({ type, videoId, podId })
      })

      return db.RequestVideoQadu.bulkCreate(queries, dbRequestOptions).asCallback(callback)
    })
  }
}
