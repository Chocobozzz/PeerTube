// import * as express from 'express'
// import * as Bluebird from 'bluebird'
// import * as Sequelize from 'sequelize'
//
// import { database as db } from '../../../initializers/database'
// import {
//   REQUEST_ENDPOINT_ACTIONS,
//   REQUEST_ENDPOINTS,
//   REQUEST_VIDEO_EVENT_TYPES,
//   REQUEST_VIDEO_QADU_TYPES
// } from '../../../initializers'
// import {
//   checkSignature,
//   signatureValidator,
//   remoteVideosValidator,
//   remoteQaduVideosValidator,
//   remoteEventsVideosValidator
// } from '../../../middlewares'
// import { logger, retryTransactionWrapper, resetSequelizeInstance } from '../../../helpers'
// import { quickAndDirtyUpdatesVideoToFriends, fetchVideoChannelByHostAndUUID } from '../../../lib'
// import { PodInstance, VideoFileInstance } from '../../../models'
// import {
//   RemoteVideoRequest,
//   RemoteVideoCreateData,
//   RemoteVideoUpdateData,
//   RemoteVideoRemoveData,
//   RemoteVideoReportAbuseData,
//   RemoteQaduVideoRequest,
//   RemoteQaduVideoData,
//   RemoteVideoEventRequest,
//   RemoteVideoEventData,
//   RemoteVideoChannelCreateData,
//   RemoteVideoChannelUpdateData,
//   RemoteVideoChannelRemoveData,
//   RemoteVideoAccountRemoveData,
//   RemoteVideoAccountCreateData
// } from '../../../../shared'
// import { VideoInstance } from '../../../models/video/video-interface'
//
// const ENDPOINT_ACTIONS = REQUEST_ENDPOINT_ACTIONS[REQUEST_ENDPOINTS.VIDEOS]
//
// // Functions to call when processing a remote request
// // FIXME: use RemoteVideoRequestType as id type
// const functionsHash: { [ id: string ]: (...args) => Promise<any> } = {}
// functionsHash[ENDPOINT_ACTIONS.ADD_VIDEO] = addRemoteVideoRetryWrapper
// functionsHash[ENDPOINT_ACTIONS.UPDATE_VIDEO] = updateRemoteVideoRetryWrapper
// functionsHash[ENDPOINT_ACTIONS.REMOVE_VIDEO] = removeRemoteVideoRetryWrapper
// functionsHash[ENDPOINT_ACTIONS.ADD_CHANNEL] = addRemoteVideoChannelRetryWrapper
// functionsHash[ENDPOINT_ACTIONS.UPDATE_CHANNEL] = updateRemoteVideoChannelRetryWrapper
// functionsHash[ENDPOINT_ACTIONS.REMOVE_CHANNEL] = removeRemoteVideoChannelRetryWrapper
// functionsHash[ENDPOINT_ACTIONS.REPORT_ABUSE] = reportAbuseRemoteVideoRetryWrapper
// functionsHash[ENDPOINT_ACTIONS.ADD_ACCOUNT] = addRemoteVideoAccountRetryWrapper
// functionsHash[ENDPOINT_ACTIONS.REMOVE_ACCOUNT] = removeRemoteVideoAccountRetryWrapper
//
// const remoteVideosRouter = express.Router()
//
// remoteVideosRouter.post('/',
//   signatureValidator,
//   checkSignature,
//   remoteVideosValidator,
//   remoteVideos
// )
//
// remoteVideosRouter.post('/qadu',
//   signatureValidator,
//   checkSignature,
//   remoteQaduVideosValidator,
//   remoteVideosQadu
// )
//
// remoteVideosRouter.post('/events',
//   signatureValidator,
//   checkSignature,
//   remoteEventsVideosValidator,
//   remoteVideosEvents
// )
//
// // ---------------------------------------------------------------------------
//
// export {
//   remoteVideosRouter
// }
//
// // ---------------------------------------------------------------------------
//
// function remoteVideos (req: express.Request, res: express.Response, next: express.NextFunction) {
//   const requests: RemoteVideoRequest[] = req.body.data
//   const fromPod = res.locals.secure.pod
//
//   // We need to process in the same order to keep consistency
//   Bluebird.each(requests, request => {
//     const data = request.data
//
//     // Get the function we need to call in order to process the request
//     const fun = functionsHash[request.type]
//     if (fun === undefined) {
//       logger.error('Unknown remote request type %s.', request.type)
//       return
//     }
//
//     return fun.call(this, data, fromPod)
//   })
//   .catch(err => logger.error('Error managing remote videos.', err))
//
//   // Don't block the other pod
//   return res.type('json').status(204).end()
// }
//
// function remoteVideosQadu (req: express.Request, res: express.Response, next: express.NextFunction) {
//   const requests: RemoteQaduVideoRequest[] = req.body.data
//   const fromPod = res.locals.secure.pod
//
//   Bluebird.each(requests, request => {
//     const videoData = request.data
//
//     return quickAndDirtyUpdateVideoRetryWrapper(videoData, fromPod)
//   })
//   .catch(err => logger.error('Error managing remote videos.', err))
//
//   return res.type('json').status(204).end()
// }
//
// function remoteVideosEvents (req: express.Request, res: express.Response, next: express.NextFunction) {
//   const requests: RemoteVideoEventRequest[] = req.body.data
//   const fromPod = res.locals.secure.pod
//
//   Bluebird.each(requests, request => {
//     const eventData = request.data
//
//     return processVideosEventsRetryWrapper(eventData, fromPod)
//   })
//   .catch(err => logger.error('Error managing remote videos.', err))
//
//   return res.type('json').status(204).end()
// }
//
// async function processVideosEventsRetryWrapper (eventData: RemoteVideoEventData, fromPod: PodInstance) {
//   const options = {
//     arguments: [ eventData, fromPod ],
//     errorMessage: 'Cannot process videos events with many retries.'
//   }
//
//   await retryTransactionWrapper(processVideosEvents, options)
// }
//
// async function processVideosEvents (eventData: RemoteVideoEventData, fromPod: PodInstance) {
//   await db.sequelize.transaction(async t => {
//     const sequelizeOptions = { transaction: t }
//     const videoInstance = await fetchLocalVideoByUUID(eventData.uuid, t)
//
//     let columnToUpdate
//     let qaduType
//
//     switch (eventData.eventType) {
//     case REQUEST_VIDEO_EVENT_TYPES.VIEWS:
//       columnToUpdate = 'views'
//       qaduType = REQUEST_VIDEO_QADU_TYPES.VIEWS
//       break
//
//     case REQUEST_VIDEO_EVENT_TYPES.LIKES:
//       columnToUpdate = 'likes'
//       qaduType = REQUEST_VIDEO_QADU_TYPES.LIKES
//       break
//
//     case REQUEST_VIDEO_EVENT_TYPES.DISLIKES:
//       columnToUpdate = 'dislikes'
//       qaduType = REQUEST_VIDEO_QADU_TYPES.DISLIKES
//       break
//
//     default:
//       throw new Error('Unknown video event type.')
//     }
//
//     const query = {}
//     query[columnToUpdate] = eventData.count
//
//     await videoInstance.increment(query, sequelizeOptions)
//
//     const qadusParams = [
//       {
//         videoId: videoInstance.id,
//         type: qaduType
//       }
//     ]
//     await quickAndDirtyUpdatesVideoToFriends(qadusParams, t)
//   })
//
//   logger.info('Remote video event processed for video with uuid %s.', eventData.uuid)
// }
//
// async function quickAndDirtyUpdateVideoRetryWrapper (videoData: RemoteQaduVideoData, fromPod: PodInstance) {
//   const options = {
//     arguments: [ videoData, fromPod ],
//     errorMessage: 'Cannot update quick and dirty the remote video with many retries.'
//   }
//
//   await retryTransactionWrapper(quickAndDirtyUpdateVideo, options)
// }
//
// async function quickAndDirtyUpdateVideo (videoData: RemoteQaduVideoData, fromPod: PodInstance) {
//   let videoUUID = ''
//
//   await db.sequelize.transaction(async t => {
//     const videoInstance = await fetchVideoByHostAndUUID(fromPod.host, videoData.uuid, t)
//     const sequelizeOptions = { transaction: t }
//
//     videoUUID = videoInstance.uuid
//
//     if (videoData.views) {
//       videoInstance.set('views', videoData.views)
//     }
//
//     if (videoData.likes) {
//       videoInstance.set('likes', videoData.likes)
//     }
//
//     if (videoData.dislikes) {
//       videoInstance.set('dislikes', videoData.dislikes)
//     }
//
//     await videoInstance.save(sequelizeOptions)
//   })
//
//   logger.info('Remote video with uuid %s quick and dirty updated', videoUUID)
// }
//
// async function reportAbuseRemoteVideoRetryWrapper (reportData: RemoteVideoReportAbuseData, fromPod: PodInstance) {
//   const options = {
//     arguments: [ reportData, fromPod ],
//     errorMessage: 'Cannot create remote abuse video with many retries.'
//   }
//
//   await retryTransactionWrapper(reportAbuseRemoteVideo, options)
// }
//
// async function reportAbuseRemoteVideo (reportData: RemoteVideoReportAbuseData, fromPod: PodInstance) {
//   logger.debug('Reporting remote abuse for video %s.', reportData.videoUUID)
//
//   await db.sequelize.transaction(async t => {
//     const videoInstance = await fetchLocalVideoByUUID(reportData.videoUUID, t)
//     const videoAbuseData = {
//       reporterUsername: reportData.reporterUsername,
//       reason: reportData.reportReason,
//       reporterPodId: fromPod.id,
//       videoId: videoInstance.id
//     }
//
//     await db.VideoAbuse.create(videoAbuseData)
//
//   })
//
//   logger.info('Remote abuse for video uuid %s created', reportData.videoUUID)
// }
//
// async function fetchLocalVideoByUUID (id: string, t: Sequelize.Transaction) {
//   try {
//     const video = await db.Video.loadLocalVideoByUUID(id, t)
//
//     if (!video) throw new Error('Video ' + id + ' not found')
//
//     return video
//   } catch (err) {
//     logger.error('Cannot load owned video from id.', { error: err.stack, id })
//     throw err
//   }
// }
//
// async function fetchVideoByHostAndUUID (podHost: string, uuid: string, t: Sequelize.Transaction) {
//   try {
//     const video = await db.Video.loadByHostAndUUID(podHost, uuid, t)
//     if (!video) throw new Error('Video not found')
//
//     return video
//   } catch (err) {
//     logger.error('Cannot load video from host and uuid.', { error: err.stack, podHost, uuid })
//     throw err
//   }
// }
